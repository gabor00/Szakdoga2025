# apps/deployment-engine/routers/deployment.py
from fastapi import APIRouter, HTTPException, BackgroundTasks
from typing import Dict, List, Optional
from pydantic import BaseModel
import logging
from docker_manager import DockerManager
from git_watcher import GitWatcher

logger = logging.getLogger(__name__)
router = APIRouter()

docker_manager = DockerManager()
git_watcher = GitWatcher()

# Models
class DeploymentRequest(BaseModel):
    service_name: str
    tag: str
    slot: Optional[str] = None  # If None, the inactive slot will be used

class TrafficDistribution(BaseModel):
    service_name: str
    blue_weight: int
    green_weight: int

class RestartRequest(BaseModel):
    service_name: str
    slot: str

# Helper functions
async def deploy_service_background(service_name: str, tag: str, slot: Optional[str] = None):
    """Background task to deploy a service."""
    try:
        # If slot not specified, get inactive slot
        if not slot:
            slot = docker_manager.get_inactive_slot(service_name)
        
        # Build image
        image_name = docker_manager.build_image(service_name, tag)
        if not image_name:
            logger.error(f"Failed to build image for {service_name}:{tag}")
            return
        
        # Deploy to slot
        result = docker_manager.deploy_to_slot(service_name, image_name, slot)
        if not result:
            logger.error(f"Failed to deploy {image_name} to {service_name} {slot} slot")
            return
        
        logger.info(f"Successfully deployed {image_name} to {service_name} {slot} slot")
    except Exception as e:
        logger.error(f"Error in deployment background task: {str(e)}")

# Routes
@router.get("/releases", response_model=List[Dict])
async def get_releases():
    """Get all release tags from the repository."""
    tags = git_watcher.get_release_tags()
    return [git_watcher.get_release_details(tag) for tag in tags]

@router.get("/releases/latest", response_model=Dict)
async def get_latest_release():
    """Get details about the latest release."""
    latest = git_watcher.get_latest_release()
    if not latest:
        raise HTTPException(status_code=404, detail="No releases found")
    return latest

@router.get("/services", response_model=Dict)
async def get_services_status():
    """Get status of all services."""
    return docker_manager.get_all_services_status()

@router.get("/services/{service_name}", response_model=Dict)
async def get_service_status(service_name: str):
    """Get status of a specific service."""
    return docker_manager.get_service_status(service_name)

@router.post("/deploy")
async def deploy_service(request: DeploymentRequest, background_tasks: BackgroundTasks):
    """Deploy a service to the specified or inactive slot."""
    if request.service_name not in ["m1", "m2", "m3"]:
        raise HTTPException(status_code=400, detail="Invalid service name")
    
    # Validate tag exists
    tags = git_watcher.get_release_tags()
    if request.tag not in tags:
        raise HTTPException(status_code=400, detail=f"Tag {request.tag} not found")
    
    # Validate slot if specified
    if request.slot and request.slot not in ["blue", "green"]:
        raise HTTPException(status_code=400, detail="Slot must be 'blue' or 'green'")
    
    # Run deployment in background
    background_tasks.add_task(
        deploy_service_background, 
        request.service_name, 
        request.tag, 
        request.slot
    )
    
    return {"message": f"Deployment of {request.service_name}:{request.tag} scheduled"}

@router.post("/traffic")
async def update_traffic_distribution(request: TrafficDistribution):
    """Update traffic distribution between blue and green slots."""
    if request.service_name not in ["m1", "m2", "m3"]:
        raise HTTPException(status_code=400, detail="Invalid service name")
    
    if request.blue_weight < 0 or request.green_weight < 0:
        raise HTTPException(status_code=400, detail="Weights must be non-negative")
    
    if request.blue_weight + request.green_weight == 0:
        raise HTTPException(status_code=400, detail="At least one weight must be positive")
    
    result = docker_manager.update_traefik_config(
        request.service_name, 
        request.blue_weight, 
        request.green_weight
    )
    
    if not result:
        raise HTTPException(status_code=500, detail="Failed to update traffic distribution")
    
    return {"message": f"Traffic distribution updated for {request.service_name}"}

@router.post("/restart")
async def restart_service(request: RestartRequest):
    """Restart a service in the specified slot."""
    if request.service_name not in ["m1", "m2", "m3"]:
        raise HTTPException(status_code=400, detail="Invalid service name")
    
    if request.slot not in ["blue", "green"]:
        raise HTTPException(status_code=400, detail="Slot must be 'blue' or 'green'")
    
    result = docker_manager.restart_service(request.service_name, request.slot)
    
    if not result:
        raise HTTPException(status_code=500, detail="Failed to restart service")
    
    return {"message": f"Service {request.service_name} restarted in {request.slot} slot"}