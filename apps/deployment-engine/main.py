from fastapi import FastAPI, HTTPException
import docker
from deployment_utils import deploy_to_slot, switch_traffic
import health_check

app = FastAPI()
client = docker.from_env()

# In-memory state for simplicity (in production, use persistent storage)
service_slots = {}  # Tracks active/inactive slots for each service
service_versions = {}  # Tracks versions deployed to each slot

def get_inactive_slot(service):
    """Returns the inactive slot for a service"""
    slots = service_slots.get(service, {"active": "blue", "inactive": "green"})
    return slots["inactive"]

def get_production_slot(service):
    """Returns the production slot for a service"""
    slots = service_slots.get(service, {"active": "blue", "inactive": "green"})
    return slots["active"]

def get_staging_slot(service):
    """Returns the staging slot for a service"""
    slots = service_slots.get(service, {"active": "blue", "inactive": "green"})
    return slots["inactive"]

@app.post("/deploy/{service}/{version}")
def deploy(service: str, version: str):
    """Deploy a specific version of a service to its inactive slot"""
    inactive_slot = get_inactive_slot(service)
    try:
        deploy_to_slot(service, version, inactive_slot)
        
        # Update our tracking of versions
        if service not in service_versions:
            service_versions[service] = {}
        service_versions[service][inactive_slot] = version
        
        return {"message": f"Deployed {service} version {version} to {inactive_slot} slot"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Deployment failed: {str(e)}")

@app.post("/traffic-split/{service}")
def split_traffic(service: str, percentage: int):
    """Split traffic between production and staging slots"""
    if percentage < 0 or percentage > 100:
        raise HTTPException(status_code=400, detail="Percentage must be between 0 and 100")
    
    production_slot = get_production_slot(service)
    staging_slot = get_staging_slot(service)
    
    try:
        switch_traffic(service, production_slot, staging_slot, percentage)
        return {"message": f"Traffic split for {service}: {percentage}% to staging, {100-percentage}% to production"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Traffic split failed: {str(e)}")

@app.post("/promote/{service}")
def promote(service: str):
    """Promote the staging slot to production"""
    if service not in service_slots:
        service_slots[service] = {"active": "blue", "inactive": "green"}
    
    # Swap active and inactive slots
    active = service_slots[service]["active"]
    inactive = service_slots[service]["inactive"]
    service_slots[service]["active"] = inactive
    service_slots[service]["inactive"] = active
    
    return {
        "message": f"Promoted {service} staging to production",
        "new_production_slot": service_slots[service]["active"],
        "new_staging_slot": service_slots[service]["inactive"]
    }

@app.post("/rollback/{service}")
def rollback(service: str):
    """Roll back to the previous version of a service"""
    if service not in service_slots:
        raise HTTPException(status_code=400, detail=f"No deployment history for service {service}")
    
    # Simply swap slots back (in a real system, you might want more complex rollback logic)
    return promote(service)

@app.get("/status")
def get_status():
    """Get the current deployment status of all services"""
    status = {}
    
    for service in service_slots:
        active_slot = service_slots[service]["active"]
        inactive_slot = service_slots[service]["inactive"]
        
        status[service] = {
            "production": {
                "slot": active_slot,
                "version": service_versions.get(service, {}).get(active_slot, "unknown")
            },
            "staging": {
                "slot": inactive_slot,
                "version": service_versions.get(service, {}).get(inactive_slot, "unknown")
            }
        }
    
    return status

@app.get("/health-check/{service}")
def check_service_health(service: str):
    """Check health of a specific service"""
    service_url = f"http://{service}:8000"  # Adjust port as needed based on your service
    is_healthy = health_check.check_health(service_url)
    
    if is_healthy:
        return {"status": "healthy"}
    else:
        return {"status": "unhealthy"}