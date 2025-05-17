#apps/deployment-engine/main.py

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import logging
from typing import Optional, Dict, List
import docker
import time
from pydantic import BaseModel
import asyncio
import requests
from requests.exceptions import RequestException
from git_watcher import GitWatcher
from docker_manager import DockerManager

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
    allow_origins=["*"], # Produkciós környezetben szűkítsd!
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
    docker_manager = DockerManager()
    logger.info("Docker kliens sikeresen inicializálva")
except Exception as e:
    logger.error(f"Hiba a Docker kliens inicializálásakor: {e}")
    docker_client = None
    docker_manager = None

# Git repo elérési út - csak URL, nincs helyi klón
GIT_REPO_URL = "https://github.com/gabor00/Szakdoga2025"

# Git Watcher inicializálása hibakezeléssel
try:
    git_watcher = GitWatcher(GIT_REPO_URL)
    logger.info(f"Git Watcher sikeresen inicializálva: {GIT_REPO_URL}")
except Exception as e:
    logger.critical(f"Hiba a Git Watcher inicializálásakor: {str(e)}")
    # Nem állítjuk le a szervert, de a git-függő funkciók nem fognak működni
    git_watcher = None

# ------------------- PYDANTIC MODELLEK -------------------

class DeploymentRequest(BaseModel):
    service: str
    version: str
    slot: Optional[str] = None
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

async def deploy_service(service: str, version: str, slot: str, deployment_id: str):
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

async def deploy_service_with_github_image(service: str, image_name: str, version: str, slot: str, deployment_id: str):
    """GitHub registry-ből származó image deploy-olása"""
    try:
        service_states[service][slot] = "deploying"
        deployment_statuses[deployment_id] = {"status": "in_progress", "message": "Deployment elindult"}
        
        logger.info(f"Deployment indítása: {service} v{version} a {slot} slotra")
        
        # Szolgáltatás nevének átalakítása a megfelelő GitHub Package névre
        github_package_name = service.replace("microservice", "m")
        
        # Docker image pull a GitHub registry-ből a megfelelő package névvel
        try:
            # Az image_name helyett a github_package_name-et használjuk
            repo_parts = GIT_REPO_URL.split('/')
            owner = repo_parts[-2]
            package_image_name = f"ghcr.io/{owner}/{github_package_name}:{version}"
            
            logger.info(f"Pulling image: {package_image_name}")
            docker_client.images.pull(package_image_name)
            logger.info(f"Image sikeresen letöltve: {package_image_name}")
        except Exception as e:
            logger.error(f"Hiba az image letöltésekor: {str(e)}")
            service_states[service][slot] = "failed"
            deployment_statuses[deployment_id] = {"status": "failed", "message": f"Hiba az image letöltésekor: {str(e)}"}
            return
        
        # Konténer indítása - itt az eredeti service nevet használjuk
        success = docker_manager.deploy_to_slot(service, package_image_name, slot)
        
        if success:
            # Várjunk egy kicsit, hogy a konténer elinduljon
            await asyncio.sleep(5)
            
            # Ellenőrizzük, hogy a konténer fut-e és válaszol-e
            health_check_success = check_service_health(service, slot)
            
            if health_check_success:
                # Sikeres deploy esetén
                service_states[service][slot] = "active"
                service_states[service]["version"] = version
                deployment_statuses[deployment_id] = {"status": "success", "message": f"{service} v{version} sikeresen deploy-olva a {slot} slotra"}
                logger.info(f"Sikeres deployment: {service} v{version} a {slot} slotra")
            else:
                # Ha a konténer nem válaszol, akkor hiba
                service_states[service][slot] = "failed"
                deployment_statuses[deployment_id] = {"status": "failed", "message": f"A {service} konténer nem válaszol a health check kérésekre"}
                logger.error(f"Deployment hiba: {service} v{version} a {slot} slotra - konténer nem válaszol")
        else:
            service_states[service][slot] = "failed"
            deployment_statuses[deployment_id] = {"status": "failed", "message": "Hiba a konténer indításakor"}
            logger.error(f"Deployment hiba: {service} v{version} a {slot} slotra - konténer indítási hiba")
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
        "repo_path": GIT_REPO_URL
    }

@app.get("/releases", summary="Elérhető release verziók lekérdezése")
async def get_releases():
    """Visszaadja az összes elérhető release-t a GitHub repository-ból"""
    try:
        if not git_watcher:
            logger.warning("Git Watcher szolgáltatás nem elérhető, üres lista visszaadása")
            return []
        
        try:
            tags = git_watcher.get_release_tags()
            releases = []
            
            # Ha nincsenek tagek, adjunk vissza egy üres listát explicit módon
            if not tags:
                return []
                
            for tag in tags:
                release_details = git_watcher.get_release_details(tag)
                
                # Frontend-kompatibilis formátum
                changes = []
                for service, changed in release_details.get("changes", {}).items():
                    changes.append({
                        "service": service,
                        "type": "changed" if changed else "unchanged"
                    })
                
                # Ellenőrizzük, hogy ez a verzió már telepítve van-e valahol
                is_deployed = any(state.get("version") == tag for state in service_states.values())
                
                releases.append({
                    "tag": tag,
                    "commit": release_details.get("hash", "")[:8],
                    "status": "deployed" if is_deployed else "available",
                    "date": release_details.get("date", ""),
                    "author": release_details.get("author", ""),
                    "changes": changes
                })
            
            return releases
        except Exception as e:
            logger.error(f"Hiba a release-ek lekérdezésekor: {str(e)}")
            # Hiba esetén is adjunk vissza egy üres listát a frontend számára
            return []
    except Exception as e:
        logger.error(f"Hiba a release-ek lekérdezésekor: {str(e)}")
        return []

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
        
        # Állapot meghatározása a diagnosztikai adatok alapján
        blue_status = "active" if blue_info.get("running") and blue_info.get("health_check") else "idle"
        green_status = "active" if green_info.get("running") and green_info.get("health_check") else "idle"
        
        # Súlyok lekérése a Traefik konfigurációból
        blue_weight = weights.get(service, {}).get("blue", 0)
        green_weight = weights.get(service, {}).get("green", 0)
        
        # Szolgáltatások hozzáadása a megfelelő slot-hoz
        slot_a_services.append({
            "name": f"Szakdoga2025-{service}-blue",
            "version": state.get("version") or "unknown",
            "status": "healthy" if blue_info.get("health_check", False) else "warning"
        })
        
        slot_b_services.append({
            "name": f"Szakdoga2025-{service}-green",
            "version": state.get("version") or "unknown",
            "status": "healthy" if green_info.get("health_check", False) else "warning"
        })
    
    # Slot A (blue) adat
    result["slot-a"] = [{
        "id": "slot-a",
        "name": "Slot A",
        "status": "active" if any(s["status"] == "healthy" for s in slot_a_services) else "inactive",
        "traffic": sum(weights.get(service, {}).get("blue", 0) for service in service_states) // len(service_states) if service_states else 0,
        "version": next((state.get("version") for state in service_states.values() if state.get("version")), "unknown"),
        "services": slot_a_services
    }]
    
    # Slot B (green) adat
    result["slot-b"] = [{
        "id": "slot-b",
        "name": "Slot B",
        "status": "active" if any(s["status"] == "healthy" for s in slot_b_services) else "inactive",
        "traffic": sum(weights.get(service, {}).get("green", 0) for service in service_states) // len(service_states) if service_states else 0,
        "version": next((state.get("version") for state in service_states.values() if state.get("version")), "unknown"),
        "services": slot_b_services
    }]
    
    return result

@app.get("/traffic", summary="Forgalom elosztás lekérdezése")
async def get_traffic_config():
    """Visszaadja a forgalom elosztás konfigurációját"""
    try:
        # Traefik konfigurációs fájl beolvasása
        import yaml
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
                            "id": "slot-a",
                            "version": service_states.get(service_short_name, {}).get("version", "unknown"),
                            "traffic": slot_a_weight,
                            "status": "healthy" if blue_info.get("health_check", False) else "warning"
                        },
                        {
                            "id": "slot-b",
                            "version": service_states.get(service_short_name, {}).get("version", "unknown"),
                            "traffic": slot_b_weight,
                            "status": "healthy" if green_info.get("health_check", False) else "warning"
                        }
                    ]
                })
        
        return result
    except Exception as e:
        logger.error(f"Hiba a traffic konfiguráció lekérdezésekor: {str(e)}")
        return []

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
                raise HTTPException(status_code=404, detail=f"A megadott tag ({request.version}) nem létezik")
        else:
            logger.warning("Git Watcher nem elérhető, tag ellenőrzés kihagyva")
        
        # Ha a slot nincs megadva, akkor keressünk egy elérhető slotot
        slot = request.slot if request.slot else get_available_slot(request.service)
        if not slot:
            raise HTTPException(status_code=409, detail=f"Nincs elérhető slot a {request.service} számára")
        
        deployment_id = f"{request.service}-{request.version}-{slot}-{int(time.time())}"
        deployment_statuses[deployment_id] = {
            "status": "pending",
            "message": "Deployment várólistára helyezve"
        }
        
        # GitHub Package Registry-ből való image használata
        repo_parts = GIT_REPO_URL.split('/')
        owner = repo_parts[-2]
        image_name = f"ghcr.io/{owner}/{request.service}:{request.version}"
        
        background_tasks.add_task(
            deploy_service_with_github_image,
            request.service,
            image_name,
            request.version,
            slot,
            deployment_id
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

@app.post("/rollback/{service}", summary="Szolgáltatás visszaállítása")
async def rollback(service: str):
    """Visszaállítja egy szolgáltatás előző verziójára"""
    try:
        if service not in service_states:
            raise HTTPException(status_code=404, detail=f"A {service} szolgáltatás nem található")
        
        if not docker_manager:
            raise HTTPException(status_code=503, detail="Docker Manager nem elérhető")
        
        success = docker_manager.rollback_service(service)
        
        if not success:
            raise HTTPException(status_code=500, detail="Rollback sikertelen")
        
        # Frissítsük a szolgáltatás verzióját
        previous_version = service_states[service]["version"]
        # Itt kellene lekérni az új verziót a Docker konténerből
        new_version = "previous-version"  # Placeholder
        
        return {
            "message": f"A {service} szolgáltatás sikeresen visszaállítva",
            "details": {
                "previous_version": previous_version,
                "new_version": new_version
            }
        }
    except HTTPException:
        raise
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

@app.get("/deployment/history", summary="Deployment történet lekérdezése")
async def get_deployment_history():
    """Lekérdezi a deployment történetet"""
    try:
        history = []
        for deployment_id, status in deployment_statuses.items():
            parts = deployment_id.split('-')
            if len(parts) >= 4:
                service = parts[0]
                version = parts[1]
                slot = parts[2]
                timestamp = int(parts[3])
                
                history.append({
                    "id": deployment_id,
                    "service": service,
                    "version": version,
                    "slot": "A" if slot == "blue" else "B",
                    "timestamp": timestamp,
                    "status": status["status"]
                })
        
        # Rendezzük időrend szerint, a legújabbak elől
        history.sort(key=lambda x: x["timestamp"], reverse=True)
        return history
    except Exception as e:
        logger.error(f"Hiba a deployment history lekérdezésekor: {str(e)}")
        return []

if __name__ == "__main__":
    # Ellenőrizzük a Git Watcher állapotát indulás előtt
    if not git_watcher:
        logger.warning("A Git Watcher nem érhető el, a git-függő funkciók nem fognak működni!")
    
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
