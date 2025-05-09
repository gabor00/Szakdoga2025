from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os
import uvicorn
from api.endpoints import health

app = FastAPI(
    title="Microservice 2",
    description="Első mikroszolgáltatás a monorepo rendszerben",
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

# API routing
app.include_router(health.router, prefix="/api", tags=["health"])

# Egyéb route-ok és beállítások
@app.get("/")
async def root():
    """Alap végpont, amely információt szolgáltat a mikroszolgáltatásról."""
    return {
        "service": "m2",
        "version": os.getenv("SERVICE_VERSION", "dev"),
        "status": "running"
    }

# FastAPI példa
@app.get("/health")
async def health_check():
    return {"status": "ok"}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)