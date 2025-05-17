#apps/deployment-engine/git_watcher.py

import os
import asyncio
import logging
import sys
from git import Repo, exc
from typing import List, Dict, Optional
from datetime import datetime
import requests

# Relatív útvonal használata a projekt gyökeréhez
# BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
REPO_URL = "https://github.com/gabor00/Szakdoga2025"
REPO_PATH = "/app/repo/cloned-repo"
# Alternatív megoldás: közvetlen útvonal
# REPO_PATH = "https://github.com/gabor00/Szakdoga2025"
POLL_INTERVAL = 60

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
    def __init__(self, repo_url: str = REPO_URL, repo_path: str = REPO_PATH):
        self.repo_url = repo_url
        self.repo_path = repo_path
        logger.info(f"Inicializálás: {self.repo_url}")
        
        # Ellenőrizzük, hogy létezik-e már a repo, ha nem, klónozzuk
        if not os.path.exists(self.repo_path):
            os.makedirs(os.path.dirname(self.repo_path), exist_ok=True)
            logger.info(f"Repo klónozása: {self.repo_url} -> {self.repo_path}")
            try:
                Repo.clone_from(self.repo_url, self.repo_path)
                logger.info("Repository sikeresen klónozva")
            except Exception as e:
                logger.critical(f"Hiba a repo klónozásakor: {str(e)}")
                raise
        
        self._validate_repo_path()
        self.repo = self._initialize_repo()
        self.latest_releases = {}

    def _validate_repo_path(self):
        """Ellenőrzi, hogy az útvonal létezik-e és git repo-e"""
        if not os.path.exists(self.repo_path):
            error_msg = f"Repo path not found: {self.repo_path}"
            logger.critical(error_msg)
            raise FileNotFoundError(error_msg)
        
        git_dir = os.path.join(self.repo_path, ".git")
        if not os.path.isdir(git_dir):
            error_msg = f"Not a git repo: {self.repo_path} (no .git directory)"
            logger.critical(error_msg)
            raise exc.InvalidGitRepositoryError(error_msg)
        
        logger.info(f"Repo útvonal validálva: {self.repo_path}")

    def _initialize_repo(self):
        """Git repo inicializálása hibakezeléssel"""
        try:
            repo = Repo(self.repo_path)
            logger.info(f"Git repo sikeresen inicializálva. Aktív branch: {repo.active_branch}")
            return repo
        except exc.NoSuchPathError as e:
            logger.critical(f"Kritikus hiba az útvonalban: {str(e)}")
            raise
        except exc.InvalidGitRepositoryError as e:
            logger.critical(f"Érvénytelen git repo: {str(e)}")
            raise
        except Exception as e:
            logger.critical(f"Váratlan hiba a repo inicializálásakor: {str(e)}")
            raise

    def get_release_tags(self) -> List[str]:
        """Az összes release tag lekérése GitHub API-n keresztül"""
        try:
            # GitHub API használata a releases lekéréséhez
            repo_parts = self.repo_url.split('/')
            owner = repo_parts[-2]
            repo = repo_parts[-1]
        
            # GitHub API hívás
            api_url = f"https://api.github.com/repos/{owner}/{repo}/tags"  # Változás: /releases helyett /tags
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
            # GitHub API használata a tag részletek lekéréséhez
            repo_parts = self.repo_url.split('/')
            owner = repo_parts[-2]
            repo = repo_parts[-1]
        
            # GitHub API hívás a tag commit adatainak lekéréséhez
            api_url = f"https://api.github.com/repos/{owner}/{repo}/git/refs/tags/{tag}"
            response = requests.get(api_url)
        
            if response.status_code != 200:
                logger.error(f"GitHub API hiba (tag): {response.status_code} - {response.text}")
                return {}
            
            tag_data = response.json()
            commit_sha = tag_data.get("object", {}).get("sha", "")
        
            # Commit adatok lekérése
            if commit_sha:
                commit_url = f"https://api.github.com/repos/{owner}/{repo}/commits/{commit_sha}"
                commit_response = requests.get(commit_url)
            
                if commit_response.status_code == 200:
                    commit_data = commit_response.json()
                
                    # Változások meghatározása
                    changes = {service: False for service in SERVICES}
                
                    # Feltételezzük, hogy minden szolgáltatás változott
                    for service in SERVICES:
                        changes[service] = True
                
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
    
    def _get_changes_from_release_body(self, body: str) -> Dict[str, bool]:
        """Kinyeri a változásokat a release leírásából"""
        changes = {service: False for service in SERVICES}
        
        # Feltételezzük, hogy a release body tartalmazza a változásokat
        # Például: "Changes: m1, m2" formátumban
        if "Changes:" in body:
            changes_part = body.split("Changes:")[1].strip()
            changed_services = [s.strip() for s in changes_part.split(",")]
            
            for service in changed_services:
                if service in changes:
                    changes[service] = True
        
        return changes

    def _get_changes_in_commit(self, commit) -> Dict[str, bool]:
        """Meghatározza, mely szolgáltatások változtak a commitban"""
        try:
            parent = commit.parents[0] if commit.parents else None
            changes = {service: False for service in SERVICES}
            
            if not parent:
                return {k: True for k in changes}
            
            diff_index = parent.diff(commit)
            
            for diff_item in diff_index:
                file_path = diff_item.a_path or diff_item.b_path
                for service in changes.keys():
                    if file_path and file_path.startswith(f"apps/{service}/"):
                        changes[service] = True
            
            return changes
        except Exception as e:
            logger.error(f"Hiba a commit változások elemzésekor: {str(e)}")
            return {service: False for service in SERVICES}

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
            service_path = os.path.join(self.repo_path, "apps", service)
            if not os.path.isdir(service_path):
                return {"service": service, "error": "Service directory not found"}
            
            repo = self.repo
            
            # Uncommitted changes
            changed_files = [item.a_path or item.b_path for item in repo.index.diff(None)]
            uncommitted_changes = any(f.startswith(f"apps/{service}/") for f in changed_files)
            
            # Remote behind
            try:
                repo.remote().fetch()
                local = repo.commit()
                remote = repo.commit('origin/' + repo.active_branch.name)
                behind = repo.git.rev_list('--left-right', '--count', f'{local}...{remote}')
                behind_count = int(behind.split()[1])
            except Exception as e:
                logger.warning(f"Nem sikerült ellenőrizni a remote állapotot: {str(e)}")
                behind_count = None
            
            return {
                "service": service,
                "uncommitted_changes": uncommitted_changes,
                "behind_remote": behind_count
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
                self.repo.remote().fetch()
                latest_release = self.get_latest_release()
                
                if latest_release and latest_release['tag'] not in self.latest_releases:
                    logger.info(f"Új release észlelve: {latest_release['tag']}")
                    self.latest_releases[latest_release['tag']] = latest_release
                    await callback(latest_release)
                else:
                    logger.debug("Nincs új release")
            except Exception as e:
                logger.error(f"Hiba a git repository figyelésekor: {str(e)}")
            
            logger.debug(f"Várakozás {POLL_INTERVAL} másodpercig...")
            await asyncio.sleep(POLL_INTERVAL)

# Ha közvetlenül futtatjuk a fájlt, teszteljük a repo elérhetőségét
if __name__ == "__main__":
    try:
        print(f"Git repo elérési út: {os.path.abspath(REPO_PATH)}")
        print(f".git mappa létezik: {os.path.isdir(os.path.join(REPO_PATH, '.git'))}")
        
        watcher = GitWatcher()
        latest = watcher.get_latest_release()
        
        if latest:
            print(f"Legfrissebb release: {latest['tag']} ({latest['date']})")
        else:
            print("Nincs elérhető release")
        
        print("\nSzolgáltatások állapota:")
        for status in watcher.get_all_services_patch_status():
            print(f" - {status['service']}: {'OK' if 'error' not in status else status['error']}")
    except Exception as e:
        print(f"Hiba: {str(e)}")
        sys.exit(1)
