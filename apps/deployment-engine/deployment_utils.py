import docker
import logging
import time
from typing import Dict, Any

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Docker client
client = docker.from_env()

def deploy_to_slot(service: str, version: str, slot: str) -> Dict[str, Any]:
    """
    Deploy a specific version of a service to a slot
    
    Args:
        service: The service name (e.g., 'm1', 'm2')
        version: The version tag to deploy
        slot: The slot to deploy to (e.g., 'blue', 'green')
        
    Returns:
        Dict containing deployment status and details
    """
    logger.info(f"Deploying {service} version {version} to {slot} slot")
    
    try:
        # Create a unique name for the container based on service, slot, and version
        container_name = f"{service}-{slot}-{version}"
        
        # Pull the image (assuming image names follow a pattern like 'm1:v1.0.0')
        image_name = f"{service}:{version}"
        logger.info(f"Pulling image: {image_name}")
        client.images.pull(image_name)
        
        # Check if there's an existing container for this slot and remove it
        try:
            old_container = client.containers.get(f"{service}-{slot}")
            logger.info(f"Stopping and removing existing container: {old_container.name}")
            old_container.stop()
            old_container.remove()
        except docker.errors.NotFound:
            logger.info(f"No existing container found for {service}-{slot}")
        
        # Determine the port based on the service
        # This would be better driven by configuration
        ports = {}
        if service == "m1":
            ports = {'8000/tcp': 8000}
        elif service == "m2":
            ports = {'8080/tcp': 8080}
        elif service == "m3":
            ports = {'8000/tcp': 8000}
            
        # Create labels for Traefik
        labels = {
            f"traefik.http.routers.{service}-{slot}.rule": f"PathPrefix('/{service}')",
            f"traefik.http.services.{service}-{slot}.loadbalancer.server.port": "8000"
        }
        
        # Create and start the new container
        logger.info(f"Creating new container: {container_name}")
        container = client.containers.run(
            image=image_name,
            name=container_name,
            detach=True,
            ports=ports,
            labels=labels,
            network="app_network"  # Make sure this network exists
        )
        
        # Wait for container to be ready
        time.sleep(5)  # In production, you'd want a more sophisticated health check
        
        return {
            "status": "success",
            "service": service,
            "version": version,
            "slot": slot,
            "container_id": container.id,
            "container_name": container_name
        }
        
    except Exception as e:
        logger.error(f"Deployment failed: {str(e)}")
        raise

def switch_traffic(service: str, production_slot: str, staging_slot: str, staging_percentage: int) -> Dict[str, Any]:
    """
    Switch traffic between production and staging slots
    
    Args:
        service: The service name
        production_slot: The current production slot ('blue' or 'green')
        staging_slot: The current staging slot ('blue' or 'green')
        staging_percentage: Percentage of traffic to route to staging (0-100)
        
    Returns:
        Dict containing traffic switch status and details
    """
    logger.info(f"Switching traffic for {service}: {staging_percentage}% to {staging_slot}, {100-staging_percentage}% to {production_slot}")
    
    try:
        # In a real implementation, this would update Traefik or your load balancer configuration
        # For example, updating Traefik dynamic configuration or calling its API
        
        # For demonstration, we'll just log what would happen
        if staging_percentage == 0:
            logger.info(f"Routing 100% of traffic to {production_slot} slot")
        elif staging_percentage == 100:
            logger.info(f"Routing 100% of traffic to {staging_slot} slot")
        else:
            logger.info(f"Setting up weighted routing: {100-staging_percentage}% to {production_slot}, {staging_percentage}% to {staging_slot}")
            
        # In a real implementation with Traefik:
        # 1. Create a middleware for the weighted routing
        # 2. Update the service rule to use this middleware
        # 3. Apply the configuration
        
        return {
            "status": "success",
            "service": service,
            "production_slot": production_slot,
            "production_percentage": 100 - staging_percentage,
            "staging_slot": staging_slot,
            "staging_percentage": staging_percentage
        }
        
    except Exception as e:
        logger.error(f"Traffic switch failed: {str(e)}")
        raise