# apps/deployment-engine/docker_manager.py
import os
import logging
import docker
from typing import Dict, List, Optional
from docker.errors import DockerException

logger = logging.getLogger(__name__)

class DockerManager:
    def __init__(self):
        """Initialize Docker client."""
        self.client = docker.from_env()
        
    def build_image(self, service_name: str, tag: str) -> Optional[str]:
        """Build Docker image for a specific service."""
        try:
            service_path = f"./apps/{service_name}"
            image_name = f"{service_name}:{tag}"
            
            logger.info(f"Building image {image_name} from {service_path}")
            
            image, build_logs = self.client.images.build(
                path=service_path,
                tag=image_name,
                rm=True
            )
            
            for log in build_logs:
                if 'stream' in log:
                    logger.debug(log['stream'].strip())
            
            return image_name
        except DockerException as e:
            logger.error(f"Error building image for {service_name}: {str(e)}")
            return None
    
    def get_service_status(self, service_name: str) -> Dict:
        """Get status information about a service's containers."""
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
                'created': blue_container.attrs['Created'] if blue_container else None
            },
            'green': {
                'id': green_container.id if green_container else None,
                'status': green_container.status if green_container else 'not_found',
                'image': green_container.image.tags[0] if green_container and green_container.image.tags else None,
                'created': green_container.attrs['Created'] if green_container else None
            }
        }
    
    def get_inactive_slot(self, service_name: str) -> str:
        """Determine which slot (blue/green) is currently inactive."""
        status = self.get_service_status(service_name)
        
        # If blue is missing or stopped, use blue slot
        if status['blue']['status'] in ['not_found', 'exited', 'dead']:
            return 'blue'
        # If green is missing or stopped, use green slot
        elif status['green']['status'] in ['not_found', 'exited', 'dead']:
            return 'green'
        # If both are running, check container creation time and pick the older one
        else:
            if status['blue']['created'] < status['green']['created']:
                return 'blue'
            else:
                return 'green'
    
    def deploy_to_slot(self, service_name: str, image_name: str, slot: str) -> bool:
        """Deploy a service to the specified slot."""
        try:
            # Stop existing container in the slot if any
            self._stop_container(service_name, slot)
            
            # Deploy new container
            logger.info(f"Deploying {image_name} to {service_name} {slot} slot")
            
            # Define container parameters
            container_name = f"{service_name}-{slot}"
            labels = {
                "service": service_name,
                "slot": slot,
                "traefik.enable": "true",
                f"traefik.http.routers.{container_name}.rule": f"PathPrefix(`/api/{service_name}`)",
                f"traefik.http.routers.{container_name}.service": container_name,
                f"traefik.http.services.{container_name}.loadbalancer.server.port": "8000"
            }
            
            # Create and start the container
            container = self.client.containers.run(
                image=image_name,
                name=container_name,
                labels=labels,
                detach=True,
                network="microservices-network",
                restart_policy={"Name": "unless-stopped"},
                environment={
                    "SERVICE_NAME": service_name,
                    "SLOT": slot
                }
            )
            
            logger.info(f"Container {container.name} created with ID {container.id}")
            return True
            
        except DockerException as e:
            logger.error(f"Error deploying {service_name} to {slot} slot: {str(e)}")
            return False
    
    def _stop_container(self, service_name: str, slot: str) -> bool:
        """Stop and remove existing container in the slot."""
        container_name = f"{service_name}-{slot}"
        try:
            containers = self.client.containers.list(
                all=True,
                filters={"name": container_name}
            )
            
            if containers:
                container = containers[0]
                if container.status != 'exited':
                    logger.info(f"Stopping container {container_name}")
                    container.stop(timeout=10)
                
                logger.info(f"Removing container {container_name}")
                container.remove()
            
            return True
        except DockerException as e:
            logger.error(f"Error stopping container {container_name}: {str(e)}")
            return False
    
    def update_traefik_config(self, service_name: str, blue_weight: int, green_weight: int) -> bool:
        """Update Traefik configuration to balance traffic between slots."""
        try:
            # Create Traefik dynamic configuration
            blue_container_name = f"{service_name}-blue"
            green_container_name = f"{service_name}-green"
            
            # Update container labels for Traefik routing weights
            containers = self.client.containers.list(
                filters={"label": f"service={service_name}"}
            )
            
            for container in containers:
                if container.labels.get('slot') == 'blue':
                    container.update(labels={
                        **container.labels,
                        f"traefik.http.services.{blue_container_name}.loadbalancer.weight": str(blue_weight)
                    })
                elif container.labels.get('slot') == 'green':
                    container.update(labels={
                        **container.labels,
                        f"traefik.http.services.{green_container_name}.loadbalancer.weight": str(green_weight)
                    })
            
            return True
        except DockerException as e:
            logger.error(f"Error updating Traefik config for {service_name}: {str(e)}")
            return False
    
    def restart_service(self, service_name: str, slot: str) -> bool:
        """Restart a service in the specified slot."""
        try:
            container_name = f"{service_name}-{slot}"
            containers = self.client.containers.list(
                all=True,
                filters={"name": container_name}
            )
            
            if not containers:
                logger.error(f"Container {container_name} not found")
                return False
                
            container = containers[0]
            logger.info(f"Restarting container {container_name}")
            container.restart(timeout=10)
            return True
            
        except DockerException as e:
            logger.error(f"Error restarting {service_name} {slot} slot: {str(e)}")
            return False
            
    def get_all_services_status(self) -> Dict:
        """Get status information about all services."""
        services = ['m1', 'm2', 'm3']
        result = {}
        
        for service in services:
            result[service] = self.get_service_status(service)
            
        return result