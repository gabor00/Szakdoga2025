import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    """Alkalmazás beállítások konfigurációja.
    
    A beállítások környezeti változókból töltődnek be, 
    amelyek az alapértelmezett értékeket felülírhatják.
    """
    # Alap beállítások
    APP_NAME: str = "m1"
    API_PREFIX: str = "/api"
    DEBUG: bool = os.getenv("DEBUG", "False").lower() in ("true", "1", "t")
    
    # Verzió információk
    VERSION: str = os.getenv("SERVICE_VERSION", "dev")
    
    # Deployment beállítások
    DEPLOYMENT_SLOT: str = os.getenv("DEPLOYMENT_SLOT", "blue")
    
    # Egyéb beállítások
    # Itt további beállításokat lehet konfigurálni: adatbázis kapcsolatok, API kulcsok, stb.
    
    class Config:
        case_sensitive = False
        env_file = ".env"

# Globális beállítások objektum
settings = Settings()