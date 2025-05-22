from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os
import uvicorn

app = FastAPI(
    title="Microservice 3",
    description="Harmadik mikroszolgáltatás a monorepo rendszerben"
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    """Alap végpont, amely információt szolgáltat a mikroszolgáltatásról."""
    return {
        "service": "m3",
        "version": os.getenv("SERVICE_VERSION", "dev"),
        "status": "running",
        "dep-slot": os.getenv("DEPLOYMENT_SLOT")
    }

@app.get("/health")
async def health_check():
    return {"status": "ok"}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)