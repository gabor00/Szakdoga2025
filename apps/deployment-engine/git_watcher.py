# apps/deployment-engine/git_watcher.py
import os
import asyncio
import logging
from git import Repo
from typing import List, Dict, Optional
from datetime import datetime
from config import REPO_PATH, POLL_INTERVAL

logger = logging.getLogger(__name__)

class GitWatcher:
    def __init__(self, repo_path: str = REPO_PATH):
        """Initialize Git repository watcher."""
        self.repo_path = repo_path
        self.repo = Repo(repo_path)
        self.latest_releases = {}
        
    def get_release_tags(self) -> List[str]:
        """Get all release tags from the repository."""
        tags = []
        for tag in self.repo.tags:
            if tag.name.startswith('release-'):
                tags.append(tag.name)
        return sorted(tags, key=lambda x: [int(y) for y in x.replace('release-', '').split('.')])
    
    def get_release_details(self, tag: str) -> Dict:
        """Get details about a specific release tag."""
        try:
            tag_obj = self.repo.tags[tag]
            commit = tag_obj.commit
            return {
                'tag': tag,
                'hash': commit.hexsha,
                'author': commit.author.name,
                'date': datetime.fromtimestamp(commit.committed_date),
                'message': commit.message.strip(),
                'changes': self._get_changes_in_commit(commit)
            }
        except (IndexError, KeyError):
            logger.error(f"Tag {tag} not found in repository")
            return {}
        
    def _get_changes_in_commit(self, commit) -> Dict[str, bool]:
        """Determine which microservices changed in this commit."""
        # Get parent commit to compare
        parent = commit.parents[0] if commit.parents else None
        
        changes = {
            'm1': False,
            'm2': False,
            'm3': False,
            'dashboard': False,
            'deployment-engine': False
        }
        
        if not parent:
            # If no parent, consider all services changed
            return {k: True for k in changes.keys()}
        
        diff_index = parent.diff(commit)
        
        for diff_item in diff_index:
            file_path = diff_item.a_path
            
            # Check which microservice the changed file belongs to
            for service in changes.keys():
                if file_path.startswith(f"apps/{service}/"):
                    changes[service] = True
                    break
                    
        return changes
    
    def get_latest_release(self) -> Optional[Dict]:
        """Get details about the latest release tag."""
        tags = self.get_release_tags()
        if not tags:
            return None
        latest_tag = tags[-1]
        return self.get_release_details(latest_tag)
    
    async def watch_for_releases(self, callback):
        """Watch for new releases and trigger callback when found."""
        while True:
            try:
                self.repo.remote().fetch()
                latest_release = self.get_latest_release()
                
                if latest_release and latest_release['tag'] not in self.latest_releases:
                    self.latest_releases[latest_release['tag']] = latest_release
                    await callback(latest_release)
                    
            except Exception as e:
                logger.error(f"Error watching git repository: {str(e)}")
                
            await asyncio.sleep(POLL_INTERVAL)