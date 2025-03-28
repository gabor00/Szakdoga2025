import requests

def check_health(service_url):
    try:
        response = requests.get(f"{service_url}/health")
        return response.status_code == 200
    except:
        return False
    
def monitor_service():
    for service in services:
        if not check_health(service_url): restart_service(service)

def restart_service(service):
    # blabla logika
    pass