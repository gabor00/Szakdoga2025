from fastapi import APIRouter, Response, status
import os
import platform
import time

router = APIRouter()

start_time = time.time()

@router.get("/health", summary="Egészségi állapot ellenőrzése")
async def health_check():
    """
    Visszaadja a szolgáltatás állapotát, verzióját és alapvető információit.
    Az állapotellenőrzés a következőkhöz használható:
    - Kubernetes livenessProbe és readinessProbe
    - Monitoring szolgáltatások
    - Load balancer ellenőrzések
    """
    return {
        "status": "healthy",
        "service": "m2",
        "version": os.getenv("SERVICE_VERSION", "dev"),
        "hostname": platform.node(),
        "uptime_seconds": round(time.time() - start_time),
        "slot": os.getenv("DEPLOYMENT_SLOT", "unknown")
    }