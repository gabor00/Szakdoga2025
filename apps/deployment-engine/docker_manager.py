# apps/deployment-engine/docker_manager.py

import os
import logging
import docker
from typing import Dict, List, Optional
from docker.errors import DockerException

logger = logging.getLogger(__name__)

GIT_REPO_URL = os.getenv("GIT_REPO_URL")
NETWORK_NAME = "szakdoga2025_traefik-network"

class DockerManager:
    def __init__(self):
        """Initialize Docker client."""
        self.client = docker.from_env()

    def init_network(self):
        try:
            networks = self.client.networks.list(names=[NETWORK_NAME])
            if not networks:
                logger.info(f"Létrehozom a {NETWORK_NAME} hálózatot")
                self.client.networks.create(NETWORK_NAME, driver="bridge")
            else:
                logger.info(f"A {NETWORK_NAME} hálózat már létezik")
        except Exception as e:
            logger.error(f"Hiba a hálózat létrehozásakor: {str(e)}")

    def deploy_service_with_github_image(self, service: str, slot: str, version: str) -> bool:
        """Szolgáltatás telepítése GitHub image-ből."""
        new_image_name = f"szakdoga2025-{service}-{slot}"
        
        try:
            repo_parts = GIT_REPO_URL.split('/')
            owner = repo_parts[-2]
            github_package_name = service.replace("microservice", "m")
            package_image_name = f"ghcr.io/{owner}/{github_package_name}:{version}"
            
            logger.info(f"Pulling image: {package_image_name}")
            self.client.images.pull(package_image_name)
            logger.info(f"Image sikeresen letöltve: {package_image_name}")
        except Exception as e:
            logger.error(f"Hiba az image letöltésekor: {str(e)}")
            return False
        
        try:
            image = self.client.images.get(package_image_name)
            image.tag(new_image_name, tag=version)
            logger.info(f"Image átnevezve: {new_image_name}:{version}")
        except Exception as e:
            logger.error(f"Hiba az image átnevezésekor: {str(e)}")
            return False
        
        try:
            self.delete_container(service, slot)
            
            container_name = f"szakdoga2025-{service}-{slot}"
            
            labels = {
                "service": service,
                "slot": slot,
                "traefik.enable": "true",
                f"traefik.http.routers.{container_name}.rule": f"PathPrefix(`/api/{service}`)",
                f"traefik.http.routers.{container_name}.service": container_name,
                f"traefik.http.services.{container_name}.loadbalancer.server.port": "8000",
                "com.docker.compose.project": "szakdoga2025", 
                "szakdoga2025.group": "true"                  
            }
            
            container = self.client.containers.run(
                image=f"{new_image_name}:{version}",
                name=container_name,
                labels=labels,
                detach=True,
                network=NETWORK_NAME,
                restart_policy={"Name": "unless-stopped"},
                environment={
                    "SERVICE_NAME": service,
                    "DEPLOYMENT_SLOT": slot,
                    "SERVICE_VERSION": version,
                    "PROJECT": "szakdoga2025"  # Projekt név környezeti változóként
                }
            )
            logger.info(f"Konténer elindítva: {container_name} ID: {container.id}")
            return True
        except Exception as e:
            logger.error(f"Hiba a konténer indításakor: {str(e)}")
            return False
        
    def get_container_info(self, container_name: str) -> Dict:
        try:
            container = self.client.containers.get(container_name)
            container_exists = True
            container_running = container.status == "running"
            container_ip = None
            if container_running:
                networks = container.attrs['NetworkSettings']['Networks']
                if 'traefik-network' in networks:
                    container_ip = networks[NETWORK_NAME]['IPAddress']
            return {
                "exists": container_exists,
                "running": container_running,
                "ip_address": container_ip if container_running else None,
            }
        except Exception as e:
            logger.warning(f"Nem sikerült lekérdezni a {container_name} konténer adatait: {e}")
            return {
                "exists": False,
                "running": False,
                "ip_address": None,
            }
                

    def get_image_version(self, service: str, slot: str) -> Optional[str]:
        """Visszaadja a konténer image verzióját"""
        container_name = f"szakdoga2025-{service}-{slot}"
        try:
            container = self.client.containers.get(container_name)
            if container and container.image.tags:
                return container.image.tags[0].split(":")[-1]
        except docker.errors.NotFound:
            logger.warning(f"A {container_name} konténer nem található")
        except Exception as e:
            logger.error(f"Hiba a verzió lekérdezésekor: {e}")
        return None

    def get_service_status(self, service_name: str) -> Dict:
        """Konténer állapotának lekérése."""
        containers = self.client.containers.list(
            all=True,
            filters={
                "label": [f"service={service_name}"]
            }
        )
        
        blue_container = next((c for c in containers if c.labels.get('slot') == 'blue'), None)
        green_container = next((c for c in containers if c.labels.get('slot') == 'green'), None)
        
        return {
            'blue': {
                'id': blue_container.id if blue_container else None,
                'status': blue_container.status if blue_container else 'not_found',
                'image': blue_container.image.tags[0] if blue_container and blue_container.image.tags else None,
                'created': blue_container.attrs['Created'] if blue_container else None,
                'health': 'healthy' if blue_container and blue_container.status == 'running' else 'warning',
                'traffic': 0  # Alapértelmezett érték, később frissítjük
            },
            'green': {
                'id': green_container.id if green_container else None,
                'status': green_container.status if green_container else 'not_found',
                'image': green_container.image.tags[0] if green_container and green_container.image.tags else None,
                'created': green_container.attrs['Created'] if green_container else None,
                'health': 'healthy' if green_container and green_container.status == 'running' else 'warning',
                'traffic': 0  # Alapértelmezett érték, később frissítjük
            }
        }


    def restart_service(self, service_name: str, slot: str) -> bool:
        """Szolgáltatás újraindítása."""
        try:
            container_name = f"szakdoga2025-{service_name}-{slot}"
            container = self.client.containers.get(container_name)
            logger.info(f"Konténer újraindítása {container_name}")
            container.restart(timeout=10)
            return True
        except DockerException as e:
            logger.error(f"Hiba az újraindításban {service_name} {slot} slot: {str(e)}")
            return False
        
    def delete_container(self, service_name: str, slot: str) -> bool:
        """Konténer törlése."""
        try:
            container_name = f"szakdoga2025-{service_name}-{slot}"
            try:
                container = self.client.containers.get(container_name)
                logger.info(f"Konténer törlése {container_name}")
                container.stop(timeout=10)
                logger.info(f"Konténer törlése {container_name}")
                container.remove()
                return True
            except docker.errors.NotFound:
                logger.info(f"Konténer {container_name} nem található, nincs mit törölni")
                return True
        except Exception as e:
            logger.error(f"Hiba a leállításban {service_name}-{slot}: {str(e)}")
            return False

    def stop_container(self, service_name: str, slot: str) -> bool:
        """Konténer leállítása, ha fut."""
        try:
            container_name = f"szakdoga2025-{service_name}-{slot}"
            container = self.client.containers.get(container_name)
            if container.status == "running":
                logger.info(f"Konténer leállítása {container_name}")
                container.stop(timeout=10)
                return True
            else:
                logger.info(f"Konténer {container_name} nem fut, nincs mit leállítani")
                return True
        except Exception as e:
            logger.error(f"Hiba a leálításban {service_name}-{slot}: {str(e)}")
            return False
        
    def start_container(self, service_name: str, slot: str) -> bool:
        """Konténer indítása, ha leállt."""
        try:
            container_name = f"szakdoga2025-{service_name}-{slot}"
            container = self.client.containers.get(container_name)
            if container.status != "running":
                logger.info(f"Konténer indítása {container_name}")
                container.start()
                return True
            else:
                logger.info(f"Konténer {container_name} nemm található, nincs mit indítani")
                return True
        except Exception as e:
            logger.error(f"Hiba az indításban {service_name}-{slot}: {str(e)}")
            return False