#apps/deployment-engine/git_watcher.py

import logging
import requests
from typing import List, Dict, Optional
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
        """Initialize GitWatcher with GitHub repository URL."""
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

    def get_release_details(self, tag: str) -> Dict:
        """Egy adott tag részleteinek lekérése GitHub API-n keresztül"""
        try:
            # GitHub API hívás a tag commit adatainak lekéréséhez
            api_url = f"{self.api_base_url}/git/refs/tags/{tag}"
            response = requests.get(api_url)
            
            if response.status_code != 200:
                logger.error(f"GitHub API hiba (tag): {response.status_code} - {response.text}")
                return {}
                
            tag_data = response.json()
            commit_sha = tag_data.get("object", {}).get("sha", "")
            
            # Commit adatok lekérése
            if commit_sha:
                commit_url = f"{self.api_base_url}/commits/{commit_sha}"
                commit_response = requests.get(commit_url)
                
                if commit_response.status_code == 200:
                    commit_data = commit_response.json()
                    
                    # Változások meghatározása
                    changes = {service: True for service in SERVICES}
                    
                    return {
                        'tag': tag,
                        'hash': commit_sha,
                        'author': commit_data.get("commit", {}).get("author", {}).get("name", ""),
                        'date': commit_data.get("commit", {}).get("author", {}).get("date", ""),
                        'message': commit_data.get("commit", {}).get("message", ""),
                        'changes': changes
                    }
            
            return {
                'tag': tag,
                'hash': "",
                'author': "",
                'date': "",
                'message': "",
                'changes': {service: True for service in SERVICES}
            }
        except Exception as e:
            logger.error(f"Hiba a tag részletek lekérésekor: {str(e)}")
            return {}

    def get_latest_release(self) -> Optional[Dict]:
        """A legfrissebb release lekérése"""
        try:
            tags = self.get_release_tags()
            if not tags:
                return None
            
            latest_tag = tags[-1]
            return self.get_release_details(latest_tag)
        except Exception as e:
            logger.error(f"Hiba a legfrissebb release lekérésekor: {str(e)}")
            return None

    def get_service_patch_status(self, service: str) -> Dict:
        """Egy szolgáltatás patch állapotának lekérése"""
        try:
            # Mivel nincs lokális repo, csak API-n keresztül tudunk információt szerezni
            return {
                "service": service,
                "uncommitted_changes": False,  # Nincs lokális változás
                "behind_remote": 0  # Nincs lokális repo, ami le lenne maradva
            }
        except Exception as e:
            logger.error(f"Hiba a service patch állapot lekérésekor: {str(e)}")
            return {"service": service, "error": str(e)}

    def get_all_services_patch_status(self) -> List[Dict]:
        """Az összes szolgáltatás patch állapotának lekérése"""
        return [self.get_service_patch_status(s) for s in SERVICES]

    async def watch_for_releases(self, callback):
        """Figyeli az új release-eket és meghívja a callback függvényt"""
        logger.info("Release figyelés elindítva...")
        
        while True:
            try:
                latest_release = self.get_latest_release()
                
                if latest_release and latest_release['tag'] not in self.latest_releases:
                    logger.info(f"Új release észlelve: {latest_release['tag']}")
                    self.latest_releases[latest_release['tag']] = latest_release
                    await callback(latest_release)
                else:
                    logger.debug("Nincs új release")
            except Exception as e:
                logger.error(f"Hiba a GitHub API figyelésekor: {str(e)}")
            
            import asyncio
            logger.debug(f"Várakozás 60 másodpercig...")
            await asyncio.sleep(60)
