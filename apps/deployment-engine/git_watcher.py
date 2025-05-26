

import logging
import requests
from typing import List
from datetime import datetime

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

# Szolgáltatások listája
SERVICES = ["m1", "m2", "m3", "dashboard", "deployment-engine"]

class GitWatcher:
    def __init__(self, repo_url: str):
        """GitWatcher inicializálása a megadott GitHub repository URL-lel."""
        self.repo_url = repo_url
        logger.info(f"GitWatcher inicializálása: {self.repo_url}")
        
        # Repo URL feldolgozása
        repo_parts = self.repo_url.split('/')
        self.owner = repo_parts[-2]
        self.repo = repo_parts[-1]
        
        # GitHub API alap URL
        self.api_base_url = f"https://api.github.com/repos/{self.owner}/{self.repo}"
        self.latest_releases = {}
        
        # Teszteljük a kapcsolatot
        try:
            response = requests.get(self.api_base_url)
            if response.status_code == 200:
                logger.info(f"Sikeres kapcsolódás a GitHub API-hoz: {self.api_base_url}")
            else:
                logger.error(f"Nem sikerült kapcsolódni a GitHub API-hoz: {response.status_code} - {response.text}")
        except Exception as e:
            logger.error(f"Hiba a GitHub API kapcsolódásakor: {str(e)}")
            raise

    def get_release_tags(self) -> List[str]:
        """Az összes release tag lekérése GitHub API-n keresztül"""
        try:
            # GitHub API hívás a tagek lekéréséhez
            api_url = f"{self.api_base_url}/tags"
            response = requests.get(api_url)
            
            if response.status_code != 200:
                logger.error(f"GitHub API hiba: {response.status_code} - {response.text}")
                return []
                
            tags_data = response.json()
            # Tag nevek kinyerése a válaszból
            tags = [tag["name"] for tag in tags_data]
            return sorted(tags)
        except Exception as e:
            logger.error(f"Hiba a tagek lekérésekor: {str(e)}")
            return []
