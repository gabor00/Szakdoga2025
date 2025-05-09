from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
import os
import uvicorn
import logging
from typing import Dict, List, Optional
import docker
import time
from pydantic import BaseModel
import sys

from git_watcher import GitWatcher

# Logging beállítása
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler("deployment_engine.log")
    ]
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Deployment Engine",
    description="Mikroszolgáltatás deployment kezelő rendszer",
    version="0.1.0"
)

# CORS beállítások
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Produkciós környezetben szűkítsd!
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Szolgáltatások állapota
service_states = {
    "m1": {"blue": "idle", "green": "idle", "active_slot": None, "version": None},
    "m2": {"blue": "idle", "green": "idle", "active_slot": None, "version": None},
    "m3": {"blue": "idle", "green": "idle", "active_slot": None, "version": None}
}

# Deployment státuszok
deployment_statuses = {}

# Docker kliens inicializálása
try:
    docker_client = docker.from_env()
    logger.info("Docker kliens sikeresen inicializálva")
except Exception as e:
    logger.error(f"Hiba a Docker kliens inicializálásakor: {e}")
    docker_client = None

# Git repo elérési út - javított verzió
# BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
# GIT_REPO_PATH = os.path.abspath(os.path.join(BASE_DIR, ".."))
GIT_REPO_URL = "https://github.com/gabor00/Szakdoga2025"
GIT_REPO_PATH = "/app/repo/cloned-repo"

# Git Watcher inicializálása hibakezeléssel
try:
    git_watcher = GitWatcher(GIT_REPO_URL, GIT_REPO_PATH)
    logger.info(f"Git Watcher sikeresen inicializálva: {GIT_REPO_URL}")
except Exception as e:
    logger.critical(f"Hiba a Git Watcher inicializálásakor: {str(e)}")
    # Nem állítjuk le a szervert, de a git-függő funkciók nem fognak működni
    git_watcher = None

# ------------------- PYDANTIC MODELLEK -------------------
class DeploymentRequest(BaseModel):
    service: str
    version: str
    traffic_percentage: Optional[int] = 100

class SlotConfigurationRequest(BaseModel):
    service: str
    blue_percentage: int
    green_percentage: int

class ServiceStatusResponse(BaseModel):
    service: str
    blue_slot: str
    green_slot: str
    active_slot: Optional[str]
    version: Optional[str]

# ------------------- HELPER FÜGGVÉNYEK -------------------
def get_available_slot(service: str) -> Optional[str]:
    """Visszaadja az elérhető slotot egy szolgáltatáshoz"""
    slots = service_states[service]
    if slots["blue"] == "idle":
        return "blue"
    elif slots["green"] == "idle":
        return "green"
    return None

def start_container(service: str, version: str, slot: str):
    """Docker konténer indítása"""
    if not docker_client:
        raise HTTPException(status_code=500, detail="Docker kliens nem elérhető")
        
    try:
        image_name = f"{service}:{version}"
        container_name = f"{service}-{slot}"
        labels = {
            "traefik.enable": "true",
            f"traefik.http.routers.{service}-{slot}.rule": f"PathPrefix(`/api/{service}`)",
            f"traefik.http.services.{service}-{slot}.loadbalancer.server.port": "8000"
        }
        container = docker_client.containers.run(
            image_name,
            name=container_name,
            detach=True,
            environment={"DEPLOYMENT_SLOT": slot, "SERVICE_VERSION": version},
            network="traefik-network",
            labels=labels,
            restart_policy={"Name": "always"}
        )
        logger.info(f"Konténer elindítva: {container_name}")
        return container
    except docker.errors.ImageNotFound:
        logger.error(f"Docker image nem található: {image_name}")
        raise HTTPException(status_code=404, detail=f"Docker image nem található: {image_name}")
    except docker.errors.APIError as e:
        logger.error(f"Docker API hiba: {e}")
        raise HTTPException(status_code=500, detail=f"Docker API hiba: {str(e)}")
    except Exception as e:
        logger.error(f"Hiba a konténer indításakor: {e}")
        raise HTTPException(status_code=500, detail=f"Hiba a konténer indításakor: {str(e)}")

async def deploy_service(service: str, version: str, slot: str, background_tasks: BackgroundTasks):
    """Szolgáltatás deploy-olása az adott slotra"""
    deployment_id = f"{service}-{version}-{slot}-{int(time.time())}"
    try:
        service_states[service][slot] = "deploying"
        deployment_statuses[deployment_id] = {"status": "in_progress", "message": "Deployment elindult"}
        logger.info(f"Deployment indítása: {service} v{version} a {slot} slotra")
        
        # Sikeres deploy esetén
        service_states[service][slot] = "active"
        if not service_states[service]["active_slot"]:
            service_states[service]["active_slot"] = slot
        service_states[service]["version"] = version

        deployment_statuses[deployment_id] = {"status": "success", "message": f"{service} v{version} sikeresen deploy-olva a {slot} slotra"}
        logger.info(f"Sikeres deployment: {service} v{version} a {slot} slotra")

    except Exception as e:
        service_states[service][slot] = "failed"
        deployment_statuses[deployment_id] = {"status": "failed", "message": str(e)}
        logger.error(f"Deployment hiba: {service} v{version} a {slot} slotra - {e}")

# ------------------- API VÉGPONTOK -------------------

@app.get("/")
async def root():
    """Alap végpont a service állapotáról"""
    return {
        "service": "deployment-engine",
        "status": "running",
        "docker_client": "connected" if docker_client else "disconnected",
        "git_watcher": "connected" if git_watcher else "disconnected",
        "repo_path": GIT_REPO_PATH
    }

@app.get("/releases", summary="Elérhető release verziók lekérdezése")
async def get_releases():
    """Visszaadja az összes elérhető release-t a Git repository-ból"""
    if not git_watcher:
        raise HTTPException(status_code=503, detail="Git Watcher szolgáltatás nem elérhető")
    try:
        tags = git_watcher.get_release_tags()
        return [git_watcher.get_release_details(tag) for tag in tags]
    except Exception as e:
        logger.error(f"Hiba a release-ek lekérdezésekor: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Hiba a release-ek lekérdezésekor: {str(e)}")

@app.get("/releases/latest", summary="Legfrissebb release lekérdezése")
async def get_latest_release():
    if not git_watcher:
        raise HTTPException(status_code=503, detail="Git Watcher szolgáltatás nem elérhető")
    try:
        latest = git_watcher.get_latest_release()
        if not latest:
            raise HTTPException(status_code=404, detail="No releases found")
        return latest
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Hiba a legfrissebb release lekérdezésekor: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Hiba a legfrissebb release lekérdezésekor: {str(e)}")

@app.get("/services", summary="Szolgáltatások állapotának lekérdezése")
async def get_services_status():
    """Visszaadja az összes szolgáltatás aktuális állapotát"""
    result = []
    for service, state in service_states.items():
        result.append({
            "service": service,
            "blue_slot": state["blue"],
            "green_slot": state["green"],
            "active_slot": state["active_slot"],
            "version": state["version"]
        })
    return {"services": result}

@app.get("/services/patch-status", summary="Összes service patch státusz lekérdezése")
async def get_all_services_patch_status():
    if not git_watcher:
        raise HTTPException(status_code=503, detail="Git Watcher szolgáltatás nem elérhető")
    try:
        return git_watcher.get_all_services_patch_status()
    except Exception as e:
        logger.error(f"Hiba a patch státuszok lekérdezésekor: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Hiba a patch státuszok lekérdezésekor: {str(e)}")

@app.get("/services/{service}/patch-status", summary="Service patch státusz lekérdezése")
async def get_service_patch_status(service: str):
    if service not in service_states:
        raise HTTPException(status_code=404, detail=f"A {service} szolgáltatás nem található")
    if not git_watcher:
        raise HTTPException(status_code=503, detail="Git Watcher szolgáltatás nem elérhető")
    try:
        return git_watcher.get_service_patch_status(service)
    except Exception as e:
        logger.error(f"Hiba a {service} patch státusz lekérdezésekor: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Hiba a {service} patch státusz lekérdezésekor: {str(e)}")

@app.post("/deploy", summary="Szolgáltatás deploy-olása")
async def deploy(request: DeploymentRequest, background_tasks: BackgroundTasks):
    """Egy adott szolgáltatás megadott verziójának deploy-olása"""
    if request.service not in service_states:
        raise HTTPException(status_code=404, detail=f"A {request.service} szolgáltatás nem található")
    available_slot = get_available_slot(request.service)
    if not available_slot:
        raise HTTPException(status_code=409, detail=f"Nincs elérhető slot a {request.service} számára, először fel kell szabadítani egy slotot")
    logger.info(f"Deployment indítása: {request.service} {request.version} a {available_slot} slotra")
    deployment_id = f"{request.service}-{request.version}-{available_slot}-{int(time.time())}"
    background_tasks.add_task(deploy_service, request.service, request.version, available_slot, background_tasks)
    return {
        "message": f"Deployment elindult a {request.service} számára a {available_slot} slotra",
        "deployment_id": deployment_id
    }

@app.post("/rollback/{service}", summary="Szolgáltatás visszaállítása")
async def rollback(service: str):
    """Visszaállítja egy szolgáltatás aktív slotját az inaktívra (ha van)"""
    if service not in service_states:
        raise HTTPException(status_code=404, detail=f"A {service} szolgáltatás nem található")
    current_active = service_states[service]["active_slot"]
    if not current_active:
        raise HTTPException(status_code=400, detail=f"A {service} szolgáltatásnak nincs aktív slotja")
    inactive_slot = "green" if current_active == "blue" else "blue"
    if service_states[service][inactive_slot] != "active":
        raise HTTPException(status_code=400, detail=f"A {service} szolgáltatás {inactive_slot} slotja nem aktív, nem lehet rollback-et végrehajtani")
    service_states[service]["active_slot"] = inactive_slot
    # Traefik konfigurációjának frissítése itt történne
    return {
        "message": f"A {service} szolgáltatás sikeresen visszaállítva a {inactive_slot} slotra"
    }

@app.post("/slot-config", summary="Forgalom elosztás beállítása")
async def configure_slots(request: SlotConfigurationRequest):
    """Beállítja a forgalom elosztását a blue és green slotok között"""
    if request.service not in service_states:
        raise HTTPException(status_code=404, detail=f"A {request.service} szolgáltatás nem található")
    if request.blue_percentage + request.green_percentage != 100:
        raise HTTPException(status_code=400, detail="A blue és green százalékok összegének 100-nak kell lennie")
    # Traefik konfigurációjának módosítása itt történne
    return {
        "message": f"A {request.service} szolgáltatás forgalom elosztása sikeresen beállítva: blue {request.blue_percentage}%, green {request.green_percentage}%"
    }

@app.post("/restart/{service}/{slot}", summary="Szolgáltatás újraindítása")
async def restart_service(service: str, slot: str):
    """Újraindítja a megadott szolgáltatás megadott slotját"""
    if service not in service_states:
        raise HTTPException(status_code=404, detail=f"A {service} szolgáltatás nem található")
    if slot not in ["blue", "green"]:
        raise HTTPException(status_code=400, detail="A slot csak 'blue' vagy 'green' lehet")
    if service_states[service][slot] != "active":
        raise HTTPException(status_code=400, detail=f"A {service} szolgáltatás {slot} slotja nem aktív")
    
    if not docker_client:
        raise HTTPException(status_code=503, detail="Docker kliens nem elérhető")
        
    try:
        container = docker_client.containers.get(f"{service}-{slot}")
        container.restart()
        logger.info(f"A {service} szolgáltatás {slot} slotja újraindítva")
    except docker.errors.NotFound:
        logger.error(f"A {service}-{slot} konténer nem található")
        raise HTTPException(status_code=404, detail=f"A {service}-{slot} konténer nem található")
    except Exception as e:
        logger.error(f"Hiba a konténer újraindításakor: {e}")
        raise HTTPException(status_code=500, detail=f"Hiba a konténer újraindításakor: {e}")
    return {
        "message": f"A {service} szolgáltatás {slot} slotja sikeresen újraindítva"
    }

@app.get("/deployment/{deployment_id}", summary="Deployment státusz lekérdezése")
async def get_deployment_status(deployment_id: str):
    """Lekérdezi egy adott deployment státuszát"""
    if deployment_id not in deployment_statuses:
        raise HTTPException(status_code=404, detail=f"A {deployment_id} azonosítójú deployment nem található")
    return deployment_statuses[deployment_id]

if __name__ == "__main__":
    # Ellenőrizzük a Git Watcher állapotát indulás előtt
    if not git_watcher:
        logger.warning("A Git Watcher nem érhető el, a git-függő funkciók nem fognak működni!")
    
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
