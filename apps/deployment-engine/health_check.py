import requests
import logging
from typing import List, Dict

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Service registry - in production this would likely come from a configuration file or database
services: Dict[str, Dict] = {
    "m1": {"url": "http://m1:8001", "threshold": 3},
    "m2": {"url": "http://m2:8002", "threshold": 3},
    "m3": {"url": "http://m3:8003", "threshold": 3}
}

# Keep track of consecutive failures
failure_counts: Dict[str, int] = {}

def check_health(service_url: str) -> bool:
    """Check if a service is healthy by calling its health endpoint"""
    try:
        response = requests.get(f"{service_url}/health", timeout=5)
        return response.status_code == 200
    except Exception as e:
        logger.error(f"Health check failed for {service_url}: {str(e)}")
        return False

def monitor_services() -> Dict[str, str]:
    """Monitor all services and restart them if necessary"""
    results = {}
    
    for service_name, config in services.items():
        service_url = config["url"]
        failure_threshold = config["threshold"]
        
        # Initialize failure count if needed
        if service_name not in failure_counts:
            failure_counts[service_name] = 0
            
        is_healthy = check_health(service_url)
        
        if is_healthy:
            # Reset failure count if service is healthy
            failure_counts[service_name] = 0
            results[service_name] = "healthy"
        else:
            # Increment failure count
            failure_counts[service_name] += 1
            results[service_name] = f"unhealthy (failures: {failure_counts[service_name]})"
            
            # If we've exceeded the threshold, restart the service
            if failure_counts[service_name] >= failure_threshold:
                logger.warning(f"Service {service_name} exceeded failure threshold. Restarting...")
                restart_service(service_name)
                results[service_name] += " - restarting"
    
    return results

def restart_service(service: str) -> bool:
    """Restart a specific service"""
    try:
        # In a real environment, this would use Docker SDK or Kubernetes API
        # to restart the service container or pod
        logger.info(f"Attempting to restart service: {service}")
        
        # Example implementation (adapt to your environment):
        # import docker
        # client = docker.from_env()
        # container = client.containers.get(service)
        # container.restart()
        
        # Reset failure count after attempting restart
        failure_counts[service] = 0
        return True
    except Exception as e:
        logger.error(f"Failed to restart service {service}: {str(e)}")
        return False