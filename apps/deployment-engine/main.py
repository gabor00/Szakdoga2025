#apps/deployment-engine/main.py

from fastapi import FastAPI, HTTPException, BackgroundTasks, Body
from fastapi.middleware.cors import CORSMiddleware
import os
import uvicorn
import logging
from typing import Optional
import time
from pydantic import BaseModel
import asyncio
import requests
from requests.exceptions import RequestException
from git_watcher import GitWatcher
from docker_manager import DockerManager
import yaml

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
    description="Mikroszolgáltatás deployment kezelő rendszer"
)

# CORS beállítások
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Produkciós környezetben szűkítsd!
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

try:
    docker_manager = DockerManager()
    docker_manager.init_network()
    logger.info("Docker kliens sikeresen inicializálva")
except Exception as e:
    logger.error(f"Hiba a Docker kliens inicializálásakor: {e}")
    docker_manager = None

GIT_REPO_URL = os.getenv("GIT_REPO_URL")

try:
    git_watcher = GitWatcher(GIT_REPO_URL)
    logger.info(f"Git Watcher sikeresen inicializálva: {GIT_REPO_URL}")
except Exception as e:
    logger.critical(f"Hiba a Git Watcher inicializálásakor: {str(e)}")
    # Nem állítjuk le a szervert, de a git-függő funkciók nem fognak működni
    git_watcher = None

# ------------------- PYDANTIC MODELLEK -------------------
# Szolgáltatások állapota
class ServiceState:
    def __init__(self, status: str, version: Optional[str] = None):
        self.status = status
        self.version = version
    status : str
    version : Optional[str]

class DeploymentRequest(BaseModel):
    service: str
    version: str
    slot: Optional[str] = None
    traffic_percentage: Optional[int] = 100

class SlotConfigurationRequest(BaseModel):
    service: str
    blue_percentage: int
    green_percentage: int

class RestartRequest(BaseModel):
    service: str
    slot: str

# ------------------- HELPER FÜGGVÉNYEK -------------------

async def deploy_service_with_github_image(service: str, version: str, slot: str):
    """GitHub registry-ből származó image deploy-olása átnevezéssel"""
    try:
        service_states[service][slot].status = "deploying"
        
        logger.info(f"Deployment indítása: {service} v{version} a {slot} slotra")
        
        deploy_succes = docker_manager.deploy_service_with_github_image(service, slot, version)

        if not deploy_succes:
            service_states[service][slot].status = "failed"
            return

        await asyncio.sleep(5)
        
        health_check_success = check_service_health(service, slot)
        
        if health_check_success:
            service_states[service][slot].status = "active"
            service_states[service][slot].version = version
            logger.info(f"Sikeres deployment: {service} v{version} a {slot} slotra")
        else:
            service_states[service][slot].status = "failed"
            logger.error(f"Deployment hiba: {service} v{version} a {slot} slotra - konténer nem válaszol")
    except Exception as e:
        service_states[service][slot].status = "failed"
        logger.error(f"Deployment hiba: {service} v{version} a {slot} slotra - {e}")

def check_service_health(service: str, slot: str) -> bool:
    """Ellenőrzi egy szolgáltatás egészségi állapotát"""
    container_name = f"szakdoga2025-{service}-{slot}"
    try:
        response = requests.get(f"http://{container_name}:8000/health", timeout=2)
        return response.status_code == 200
    except:
        return False
    
async def run_diagnostics():
    """Diagnosztikai információk a konténerekről és a hálózati kapcsolatokról"""
    results = {}
    
    for service in service_states:
        for slot in ["blue", "green"]:
            container_name = f"szakdoga2025-{service}-{slot}"
            
            try:
                container_info = docker_manager.get_container_info(container_name)
                if not container_info["exists"]:
                    results[container_name] = {
                        "exists": False,
                        "running": False,
                        "ip_address": None,
                        "health_check": False
                    }
                    continue
                # Próbáljunk kapcsolódni a konténerhez a 8000-es porton
                health_check = check_service_health(service, slot)
                
                container_info["health_check"] = health_check
                results[container_name] = container_info

            except Exception as e:
                logger.error(f"Hiba a {container_name} diagnosztikájakor: {e}")
                results[container_name] = {
                    "exists": False,
                    "running": False,
                    "ip_address": None,
                    "health_check": False,
                    "error": str(e)
                }
    
    return {"diagnostics": results}


service_states = {

    "microservice1": {"blue" : ServiceState(status="idle", version=docker_manager.get_image_version("microservice1", "blue")), "green" : ServiceState(status="idle", version=docker_manager.get_image_version("microservice1", "green"))},
    "microservice2": {"blue" : ServiceState(status="idle", version=docker_manager.get_image_version("microservice2", "blue")), "green" : ServiceState(status="idle", version=docker_manager.get_image_version("microservice2", "green"))},
    "microservice3": {"blue" : ServiceState(status="idle", version=docker_manager.get_image_version("microservice3", "blue")), "green" : ServiceState(status="idle", version=docker_manager.get_image_version("microservice3", "green"))}
}

# ------------------- API VÉGPONTOK -------------------

@app.get("/")
async def root():
    """Alap végpont a service állapotáról"""
    return {
        "service": "deployment-engine",
        "status": "running",
        "docker_manager": "connected" if docker_manager else "disconnected",
        "git_watcher": "connected" if git_watcher else "disconnected",
        "repo_path": GIT_REPO_URL
    }


@app.get("/services", summary="Szolgáltatások állapotának lekérdezése")
async def get_services_status():
    """Visszaadja az összes szolgáltatás aktuális állapotát"""
    # Először lekérjük a diagnosztikai adatokat
    diagnostics_data = await run_diagnostics()
    diagnostics_info = diagnostics_data.get("diagnostics", {})
    
    # Traefik konfigurációs fájl beolvasása
    try:
        config_file = "/etc/traefik/dynamic/services.yml"
        with open(config_file, 'r') as file:
            config = yaml.safe_load(file)
        # Súlyok kinyerése a konfigurációból
        weights = {}
        for service_name, service_config in config["http"]["services"].items():
            if service_name.startswith("szakdoga2025-") and "weighted" in service_config:
                service_short_name = service_name.replace("szakdoga2025-", "")
                weights[service_short_name] = {}
                for weighted_service in service_config["weighted"]["services"]:
                    if weighted_service["name"].endswith("-blue"):
                        weights[service_short_name]["blue"] = weighted_service["weight"]
                    elif weighted_service["name"].endswith("-green"):
                        weights[service_short_name]["green"] = weighted_service["weight"]
    except Exception as e:
        logger.error(f"Hiba a Traefik konfigurációs fájl olvasásakor: {e}")
        weights = {}

    # Frontend-kompatibilis formátum
    result = {
        "slot-a": [],
        "slot-b": []
    }
    
    # Szolgáltatások csoportosítása slot-ok szerint
    slot_a_services = []
    slot_b_services = []
    
    for service, state in service_states.items():
        blue_key = f"szakdoga2025-{service}-blue"
        green_key = f"szakdoga2025-{service}-green"
        blue_info = diagnostics_info.get(blue_key, {})
        green_info = diagnostics_info.get(green_key, {})
        
        # Konténer információk lekérése a verzió számára
        try:
            blue_version = docker_manager.get_image_version(service, "blue")
            green_version = docker_manager.get_image_version(service, "green")
            if blue_version is None:    
                blue_version = "unknown"
            if green_version is None:
                green_version = "unknown"

        except Exception as e:
            logger.error(f"Hiba a konténer információk lekérésekor: {e}")
            blue_version = state["blue"].version
            green_version = state["green"].version
        
        # Szolgáltatások hozzáadása a megfelelő slot-hoz
        slot_a_services.append({
            "name": blue_key,
            "version": blue_version,
            "status": "healthy" if blue_info.get("health_check", False) else "warning"
        })
        
        slot_b_services.append({
            "name": green_key,
            "version": green_version,
            "status": "healthy" if green_info.get("health_check", False) else "warning"
        })
    
    # Slot A (blue) adat
    result["slot-a"] = [{
        "id": "slot-a",
        "name": "Blue",
        "status": "active" if any(s["status"] == "healthy" for s in slot_a_services) else "inactive",
        "traffic": sum(weights.get(service, {}).get("blue", 0) for service in service_states) // len(service_states) if service_states else 0,
        "version": next((s["version"] for s in slot_a_services if s["version"] != "unknown"), "unknown"),
        "services": slot_a_services
    }]
    
    # Slot B (green) adat
    result["slot-b"] = [{
        "id": "slot-b",
        "name": "Green",
        "status": "active" if any(s["status"] == "healthy" for s in slot_b_services) else "inactive",
        "traffic": sum(weights.get(service, {}).get("green", 0) for service in service_states) // len(service_states) if service_states else 0,
        "version": next((s["version"] for s in slot_b_services if s["version"] != "unknown"), "unknown"),
        "services": slot_b_services
    }]
    
    return result



@app.get("/traffic", summary="Forgalom elosztás lekérdezése")
async def get_traffic_config():
    """Visszaadja a forgalom elosztás konfigurációját"""
    try:
        # Traefik konfigurációs fájl beolvasása
        config_file = "/etc/traefik/dynamic/services.yml"
        with open(config_file, 'r') as file:
            config = yaml.safe_load(file)
        
        # Szolgáltatások és súlyok kinyerése
        result = []
        for service_name, service_config in config["http"]["services"].items():
            if service_name.startswith("szakdoga2025-") and "weighted" in service_config:
                service_short_name = service_name.replace("szakdoga2025-", "")
                
                # Slot súlyok kinyerése
                slot_a_weight = 0
                slot_b_weight = 0
                for weighted_service in service_config["weighted"]["services"]:
                    if weighted_service["name"].endswith("-blue"):
                        slot_a_weight = weighted_service["weight"]
                    elif weighted_service["name"].endswith("-green"):
                        slot_b_weight = weighted_service["weight"]
                
                # Diagnosztikai adatok lekérése az állapothoz
                diagnostics_data = await run_diagnostics()
                diagnostics_info = diagnostics_data.get("diagnostics", {})
                
                blue_key = f"szakdoga2025-{service_short_name}-blue"
                green_key = f"szakdoga2025-{service_short_name}-green"
                
                blue_info = diagnostics_info.get(blue_key, {})
                green_info = diagnostics_info.get(green_key, {})
                
                # Szolgáltatás hozzáadása az eredményhez
                result.append({
                    "id": f"ms-{service_short_name}",
                    "name": service_short_name,
                    "slots": [
                        {
                            "id": "blue",
                            "version": service_states[service_short_name]["blue"].version,
                            "traffic": slot_a_weight,
                            "status": "healthy" if blue_info.get("health_check", False) else "warning"
                        },
                        {
                            "id": "green",
                            "version": service_states[service_short_name]["green"].version,
                            "traffic": slot_b_weight,
                            "status": "healthy" if green_info.get("health_check", False) else "warning"
                        }
                    ]
                })
        
        return result
    except Exception as e:
        logger.error(f"Hiba a traffic konfiguráció lekérdezésekor: {str(e)}")
        return []


@app.post("/deploy", summary="Szolgáltatás deploy-olása")
async def deploy(request: DeploymentRequest, background_tasks: BackgroundTasks):
    """Egy adott szolgáltatás megadott verziójának deploy-olása"""
    try:
        if request.service not in service_states:
            raise HTTPException(status_code=404, detail=f"A {request.service} szolgáltatás nem található")
        
        # Ellenőrizzük a tag létezését a GitHub-on, ha elérhető a Git Watcher
        if git_watcher:
            tags = git_watcher.get_release_tags()
            if request.version not in tags:
                logger.warning(f"A megadott tag ({request.version}) nem található a Git Watcher-ben, de folytatjuk a deploymentet")
        else:
            logger.warning("Git Watcher szolgáltatás nem elérhető, tag ellenőrzés kihagyva")
    
        slot = request.slot 
        deployment_id = f"{request.service}-{request.version}-{slot}-{int(time.time())}"
        
        # Szolgáltatás nevének átalakítása a megfelelő GitHub Package névre
        github_package_name = request.service.replace("microservice", "m")
        
        # GitHub Package Registry-ből való image használata
        repo_parts = GIT_REPO_URL.split('/')
        owner = repo_parts[-2]
        image_name = f"ghcr.io/{owner}/{github_package_name}:{request.version}"
        
        logger.info(f"Deployment indítása: {request.service} v{request.version} a {slot} slotra, image: {image_name}")
        
        background_tasks.add_task(
            deploy_service_with_github_image,
            request.service,
            request.version,
            slot
        )
        
        return {
            "message": f"Deployment elindult a {request.service} számára a {slot} slotra",
            "deployment_id": deployment_id
        }
    except HTTPException as he:
        raise
    except Exception as e:
        logger.error(f"Váratlan hiba: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Belső szerverhiba: {str(e)}")


@app.post("/slot-config", summary="Forgalom elosztás beállítása")
async def configure_slots(request: SlotConfigurationRequest):
    """Beállítja a forgalom elosztását a blue és green slotok között"""
    if request.service not in service_states:
        raise HTTPException(status_code=404, detail=f"A {request.service} szolgáltatás nem található")
    
    if request.blue_percentage + request.green_percentage != 100:
        raise HTTPException(status_code=400, detail="A blue és green százalékok összegének 100-nak kell lennie")
    
    try:
        # Traefik konfigurációs fájl útvonala
        config_dir = "/etc/traefik/dynamic"
        config_file = f"{config_dir}/services.yml"
        
        # Fájl betöltése
        with open(config_file, 'r') as file:
            config = yaml.safe_load(file)
        
        # A megfelelő szolgáltatás súlyozásának módosítása
        service_name = f"szakdoga2025-{request.service}"
        
        # Ellenőrizzük, hogy létezik-e a szolgáltatás
        if service_name not in config["http"]["services"]:
            raise HTTPException(status_code=404, detail=f"A {service_name} szolgáltatás nem található a konfigurációban")
        
        # Súlyok módosítása a weighted services alatt
        weighted_services = config["http"]["services"][service_name]["weighted"]["services"]
        
        # Blue és green szolgáltatások súlyának módosítása
        for service in weighted_services:
            if service["name"] == f"{service_name}-blue":
                service["weight"] = request.blue_percentage
            elif service["name"] == f"{service_name}-green":
                service["weight"] = request.green_percentage
        
        # Konfiguráció mentése
        with open(config_file, 'w') as file:
            yaml.safe_dump(config, file, default_flow_style=False, sort_keys=False)
        
        logger.info(f"Traefik konfiguráció frissítve: blue {request.blue_percentage}%, green {request.green_percentage}%")
        
        return {
            "message": f"A {request.service} szolgáltatás forgalom elosztása sikeresen beállítva"
        }
    except Exception as e:
        logger.error(f"Hiba a Traefik konfiguráció frissítésekor: {e}")
        raise HTTPException(status_code=500, detail=f"Hiba a Traefik konfiguráció frissítésekor: {str(e)}")
    


@app.post("/restart", summary="Szolgáltatás újraindítása")
async def restart_service(request: RestartRequest):
    """Újraindítja a megadott szolgáltatás adott slotját."""
    if not docker_manager:
        raise HTTPException(status_code=500, detail="Docker manager nem elérhető")
    success = docker_manager.restart_service(request.service, request.slot)
    if success:
        return {"message": f"{request.service} {request.slot} slot újraindítva"}
    else:
        raise HTTPException(status_code=500, detail=f"Nem sikerült újraindítani: {request.service} {request.slot}")

@app.post("/start", summary="Szolgáltatás leállítása")
async def start_service(request: RestartRequest):
    """Leállítja a megadott szolgáltatás adott slotját."""
    if not docker_manager:
        raise HTTPException(status_code=500, detail="Docker manager nem elérhető")
    success = docker_manager.start_container(request.service, request.slot)
    if success:
        return {"message": f"{request.service} {request.slot} slot leállítva"}
    else:
        raise HTTPException(status_code=500, detail=f"Nem sikerült leállítani: {request.service} {request.slot}")
    

@app.post("/stop", summary="Szolgáltatás leállítása")
async def stop_service(request: RestartRequest):
    """Leállítja a megadott szolgáltatás adott slotját."""
    if not docker_manager:
        raise HTTPException(status_code=500, detail="Docker manager nem elérhető")
    success = docker_manager.stop_container(request.service, request.slot)
    if success:
        return {"message": f"{request.service} {request.slot} slot leállítva"}
    else:
        raise HTTPException(status_code=500, detail=f"Nem sikerült leállítani: {request.service} {request.slot}")
    

if __name__ == "__main__":
    # Ellenőrizzük a Git Watcher állapotát indulás előtt
    if not git_watcher:
        logger.warning("A Git Watcher nem érhető el, a git-függő funkciók nem fognak működni!")
    
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
