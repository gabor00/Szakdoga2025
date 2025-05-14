from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import logging
from typing import Optional
import docker
import time
from pydantic import BaseModel
import asyncio
import requests
from requests.exceptions import RequestException


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
    "microservice1": {"blue": "idle", "green": "idle", "version": None},
    "microservice2": {"blue": "idle", "green": "idle", "version": None},
    "microservice3": {"blue": "idle", "green": "idle", "version": None}
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
        container_name = f"szakdoga2025-{service}-{slot}"
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
    deployment_id = f"{service}-{version}-{slot}-{int(time.time())}"
    try:
        service_states[service][slot] = "deploying"
        deployment_statuses[deployment_id] = {"status": "in_progress", "message": "Deployment elindult"}
        logger.info(f"Deployment indítása: {service} v{version} a {slot} slotra")
        
        # Konténer indítása
        start_container(service, version, slot)
        
        # Várjunk egy kicsit, hogy a konténer elinduljon
        await asyncio.sleep(5)
        
        # Ellenőrizzük, hogy a konténer fut-e és válaszol-e
        container_name = f"szakdoga2025-{service}-{slot}"
        health_check_success = False
        
        try:
            # Explicit port megadása (8000) a szolgáltatásnévvel
            response = requests.get(f"http://{container_name}:8000/health", timeout=2)
            health_check_success = response.status_code == 200
        except RequestException as e:
            logger.warning(f"Health check hiba: {e}")
            health_check_success = False
        
        if health_check_success:
            # Sikeres deploy esetén
            service_states[service][slot] = "active"
            if not service_states[service]["active_slot"]:
                service_states[service]["active_slot"] = slot
            service_states[service]["version"] = version
            
            deployment_statuses[deployment_id] = {"status": "success", "message": f"{service} v{version} sikeresen deploy-olva a {slot} slotra"}
            logger.info(f"Sikeres deployment: {service} v{version} a {slot} slotra")
        else:
            # Ha a konténer nem válaszol, akkor hiba
            service_states[service][slot] = "failed"
            deployment_statuses[deployment_id] = {"status": "failed", "message": f"A {service} konténer nem válaszol a health check kérésekre"}
            logger.error(f"Deployment hiba: {service} v{version} a {slot} slotra - konténer nem válaszol")
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
    # Először lekérjük a diagnosztikai adatokat
    diagnostics_data = await run_diagnostics()
    diagnostics_info = diagnostics_data.get("diagnostics", {})
    
    # Traefik konfigurációs fájl beolvasása
    try:
        import yaml
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
    
    result = []
    for service, state in service_states.items():
        blue_key = f"szakdoga2025-{service}-blue"
        green_key = f"szakdoga2025-{service}-green"
        
        blue_info = diagnostics_info.get(blue_key, {})
        green_info = diagnostics_info.get(green_key, {})
        
        # Állapot meghatározása a diagnosztikai adatok alapján
        blue_status = "active" if blue_info.get("running") and blue_info.get("health_check") else "idle"
        green_status = "active" if green_info.get("running") and green_info.get("health_check") else "idle"
        
        # Ha az állapot active, de a konténer nem fut, akkor frissítsük
        if state["blue"] == "active" and blue_status != "active":
            state["blue"] = blue_status
        elif blue_status == "active" and state["blue"] != "active":
            state["blue"] = blue_status
            
        if state["green"] == "active" and green_status != "active":
            state["green"] = green_status
        elif green_status == "active" and state["green"] != "active":
            state["green"] = green_status
        
        # Súlyok lekérése a Traefik konfigurációból
        blue_weight = 0
        green_weight = 0
        if service in weights:
            blue_weight = weights[service].get("blue", 0)
            green_weight = weights[service].get("green", 0)
        
        result.append({
            "service": service,
            "blue_slot": state["blue"],
            "green_slot": state["green"],
            "version": state["version"],
            "blue_running": blue_info.get("running", False),
            "green_running": green_info.get("running", False),
            "blue_weight": blue_weight,
            "green_weight": green_weight
        })
    
    return {"services": result}


def check_service_health(service: str, slot: str) -> bool:
    """Ellenőrzi egy szolgáltatás egészségi állapotát"""
    container_name = f"szakdoga2025-{service}-{slot}"
    try:
        response = requests.get(f"http://{container_name}:8000/health", timeout=2)
        return response.status_code == 200
    except:
        return False
    
@app.get("/diagnostics", summary="Hálózati diagnosztika")
async def run_diagnostics():
    """Diagnosztikai információk a konténerekről és a hálózati kapcsolatokról"""
    results = {}
    for service in service_states:
        for slot in ["blue", "green"]:
            container_name = f"szakdoga2025-{service}-{slot}"
            try:
                # Ellenőrizzük, hogy a konténer létezik-e
                container_exists = False
                container_running = False
                container_ip = None
                
                try:
                    if docker_client:
                        container = docker_client.containers.get(container_name)
                        container_exists = True
                        container_running = container.status == "running"
                        if container_running:
                            networks = container.attrs['NetworkSettings']['Networks']
                            if 'traefik-network' in networks:
                                container_ip = networks['szakdoga2025_traefik-network']['IPAddress']
                except Exception as e:
                    logger.warning(f"Nem sikerült lekérdezni a {container_name} konténer adatait: {e}")
                
                # Próbáljunk kapcsolódni a konténerhez a 8000-es porton
                health_check = check_service_health(service, slot)
                
                results[container_name] = {
                    "exists": container_exists,
                    "running": container_running,
                    "ip_address": container_ip,
                    "health_check": health_check
                }
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

# Módosított /deploy végpont
@app.post("/deploy", summary="Szolgáltatás deploy-olása")
async def deploy(request: DeploymentRequest, background_tasks: BackgroundTasks):
    """Egy adott szolgáltatás megadott verziójának deploy-olása"""
    try:
        if request.service not in service_states:
            raise HTTPException(status_code=404, detail=f"A {request.service} szolgáltatás nem található")

        # Ellenőrizzük a release létezését
        if not any(r['tag'] == request.version for r in await get_releases()):
            raise HTTPException(status_code=404, detail="A megadott release verzió nem létezik")

        available_slot = get_available_slot(request.service)
        if not available_slot:
            raise HTTPException(status_code=409, detail=f"Nincs elérhető slot a {request.service} számára")

        deployment_id = f"{request.service}-{request.version}-{available_slot}-{int(time.time())}"
        deployment_statuses[deployment_id] = {
            "status": "pending",
            "message": "Deployment várólistára helyezve"
        }

        background_tasks.add_task(
            deploy_service, 
            request.service, 
            request.version, 
            available_slot, 
            deployment_id
        )

        return {
            "message": f"Deployment elindult a {request.service} számára a {available_slot} slotra",
            "deployment_id": deployment_id
        }

    except HTTPException as he:
        raise
    except Exception as e:
        logger.error(f"Váratlan hiba: {str(e)}")
        raise HTTPException(status_code=500, detail="Belső szerverhiba")

# Új /rollback végpont
@app.post("/rollback/{service}", summary="Szolgáltatás visszaállítása")
async def rollback(service: str):
    """Visszaállítja egy szolgáltatás előző verziójára"""
    try:
        if service not in service_states:
            raise HTTPException(status_code=404, detail=f"A {service} szolgáltatás nem található")

        # Implementáld a tényleges rollback logikát itt
        # Példa: docker_manager.rollback_service(service)
        
        return {
            "message": f"A {service} szolgáltatás sikeresen visszaállítva",
            "details": {
                "previous_version": service_states[service]["version"],
                "new_version": "v0.1.2" # Frissítsd a tényleges verzióval
            }
        }
        
    except Exception as e:
        logger.error(f"Rollback hiba: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Rollback sikertelen: {str(e)}")

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
        
        # PyYAML használata a YAML fájl módosításához
        import yaml
        
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


@app.post("/restart/szakdoga2025-{service}-{slot}", summary="Szolgáltatás újraindítása")
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
        container = docker_client.containers.get(f"szakdoga2025-{service}-{slot}")
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
