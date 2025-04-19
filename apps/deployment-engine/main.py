from fastapi import FastAPI, HTTPException, BackgroundTasks, Depends
from fastapi.middleware.cors import CORSMiddleware
import os
import uvicorn
import logging
from typing import Dict, List, Optional
import docker
import git
import json
import time
from pydantic import BaseModel

# Logging beállítása
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Deployment Engine",
    description="Mikroszolgáltatás deployment kezelő rendszer",
    version="0.1.0"
)

# CORS beállítások
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Produkciós környezetben specifikusabb beállítás javasolt
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# A szolgáltatások és a hozzájuk tartozó slotok állapota
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

# Git repo elérési út 
GIT_REPO_PATH = os.getenv("GIT_REPO_PATH", "/app/repo")

# Pydantic modellek
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

# Helper funkciók
def get_available_slot(service: str) -> Optional[str]:
    """Visszaadja az elérhető slotot egy szolgáltatáshoz"""
    slots = service_states[service]
    if slots["blue"] == "idle":
        return "blue"
    elif slots["green"] == "idle":
        return "green"
    return None

def get_git_releases() -> List[Dict]:
    """Git repositoryból kinyeri a release tageket"""
    try:
        repo = git.Repo(GIT_REPO_PATH)
        tags = []
        
        for tag in repo.tags:
            if tag.name.startswith("release-"):
                commit = tag.commit
                tags.append({
                    "tag": tag.name,
                    "version": tag.name.replace("release-", ""),
                    "commit_hash": str(commit),
                    "commit_date": time.strftime("%Y-%m-%d %H:%M:%S", time.gmtime(commit.committed_date)),
                    "commit_message": commit.message.strip(),
                    "author": f"{commit.author.name} <{commit.author.email}>"
                })
        
        # Rendezés verzió szerint csökkenő sorrendben
        tags.sort(key=lambda x: x["version"], reverse=True)
        return tags
    except Exception as e:
        logger.error(f"Hiba a Git release-ek lekérdezésekor: {e}")
        return []

def detect_changed_services(tag: str) -> List[str]:
    """Meghatározza, hogy mely szolgáltatások változtak az adott tag-ben"""
    try:
        repo = git.Repo(GIT_REPO_PATH)
        
        # Tag objektum lekérése
        tag_obj = next((t for t in repo.tags if t.name == tag), None)
        if not tag_obj:
            return []
            
        # Előző tag keresése (egyszerűsített logika)
        all_tags = sorted([t.name for t in repo.tags if t.name.startswith("release-")])
        current_index = all_tags.index(tag)
        previous_tag = all_tags[current_index - 1] if current_index > 0 else None
        
        if not previous_tag:
            # Ha ez az első tag, minden szolgáltatást megjelölünk
            return ["m1", "m2", "m3"]
        
        # Változott fájlok lekérése
        prev_tag_obj = next((t for t in repo.tags if t.name == previous_tag), None)
        diff_index = prev_tag_obj.commit.diff(tag_obj.commit)
        
        # Ellenőrizzük, hogy melyik szolgáltatások mappáiban történt változás
        changed_services = set()
        for diff_item in diff_index:
            path = diff_item.a_path or diff_item.b_path
            if "apps/m1" in path:
                changed_services.add("m1")
            elif "apps/m2" in path:
                changed_services.add("m2")
            elif "apps/m3" in path:
                changed_services.add("m3")
        
        return list(changed_services)
    
    except Exception as e:
        logger.error(f"Hiba a változott szolgáltatások észlelésekor: {e}")
        return []

async def deploy_service(service: str, version: str, slot: str, background_tasks: BackgroundTasks):
    """Szolgáltatás deploy-olása az adott slotra"""
    try:
        # Slot állapot frissítése
        service_states[service][slot] = "deploying"
        deployment_id = f"{service}-{version}-{slot}-{int(time.time())}"
        deployment_statuses[deployment_id] = {"status": "in_progress", "message": "Deployment elindult"}
        
        # Itt történne a valódi build és deploy folyamat
        # Most csak szimulálom a folyamatot
        logger.info(f"Deployment indítása: {service} v{version} a {slot} slotra")
        
        # Docker image build és futtatás szimuláció
        time.sleep(2)  # Szimuláljuk a build időt
        
        # A container futtatása (valós implementációban)
        # container = docker_client.containers.run(
        #     f"{service}:{version}",
        #     name=f"{service}-{slot}",
        #     detach=True,
        #     environment={"DEPLOYMENT_SLOT": slot, "SERVICE_VERSION": version},
        #     network="traefik-network",
        #     labels={
        #         "traefik.enable": "true",
        #         f"traefik.http.routers.{service}-{slot}.rule": f"PathPrefix(`/api/{service}`)",
        #         f"traefik.http.services.{service}-{slot}.loadbalancer.server.port": "8000"
        #     }
        # )
        
        # Sikeres deploy esetén
        service_states[service][slot] = "active"
        if not service_states[service]["active_slot"]:
            service_states[service]["active_slot"] = slot
        service_states[service]["version"] = version
        
        deployment_statuses[deployment_id] = {"status": "success", "message": f"{service} v{version} sikeresen deploy-olva a {slot} slotra"}
        logger.info(f"Sikeres deployment: {service} v{version} a {slot} slotra")
        
    except Exception as e:
        # Hiba esetén
        service_states[service][slot] = "failed"
        deployment_statuses[deployment_id] = {"status": "failed", "message": str(e)}
        logger.error(f"Deployment hiba: {service} v{version} a {slot} slotra - {e}")

# API végpontok
@app.get("/")
async def root():
    """Alap végpont a service állapotáról"""
    return {
        "service": "deployment-engine",
        "status": "running",
        "docker_client": "connected" if docker_client else "disconnected"
    }

@app.get("/releases", summary="Elérhető release verziók lekérdezése")
async def get_releases():
    """Visszaadja az összes elérhető release-t a Git repository-ból"""
    releases = get_git_releases()
    return {"releases": releases}

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

@app.post("/deploy", summary="Szolgáltatás deploy-olása")
async def deploy(request: DeploymentRequest, background_tasks: BackgroundTasks):
    """Egy adott szolgáltatás megadott verziójának deploy-olása"""
    if request.service not in service_states:
        raise HTTPException(status_code=404, detail=f"A {request.service} szolgáltatás nem található")
    
    # Elérhető slot keresése
    available_slot = get_available_slot(request.service)
    if not available_slot:
        raise HTTPException(status_code=409, detail=f"Nincs elérhető slot a {request.service} számára, először fel kell szabadítani egy slotot")
    
    # Deployment indítása háttérben
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
    
    # A másik slot meghatározása
    inactive_slot = "green" if current_active == "blue" else "blue"
    
    if service_states[service][inactive_slot] != "active":
        raise HTTPException(status_code=400, detail=f"A {service} szolgáltatás {inactive_slot} slotja nem aktív, nem lehet rollback-et végrehajtani")
    
    # Aktív slot átváltása
    service_states[service]["active_slot"] = inactive_slot
    
    # Traefik konfigurációjának frissítése itt történne
    
    return {
        "message": f"A {service} szolgáltatás sikeresen visszaállítva a {inactive_slot} slotra"
    }

@app.post("/slot-config", summary="Forgalom elosztás beállítása")
async def configure_slots(request: SlotConfigurationRequest):
    """Beállítja a forgalom elosztását a blue és green slotok között"""
    if request.service not in service_states:
        raise HTTPException(status_code=404, detail=f"A {service} szolgáltatás nem található")
    
    if request.blue_percentage + request.green_percentage != 100:
        raise HTTPException(status_code=400, detail="A blue és green százalékok összegének 100-nak kell lennie")
    
    # Itt történne a Traefik konfigurációjának módosítása
    # Ez egy komplex feladat, ami a Traefik API vagy konfigurációs fájlok módosítását igényli
    
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
    
    # Itt történne a container újraindítása
    # docker_client.containers.get(f"{service}-{slot}").restart()
    
    logger.info(f"A {service} szolgáltatás {slot} slotja újraindítva")
    
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
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)