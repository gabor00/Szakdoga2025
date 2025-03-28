import subprocess

def get_git_tags():
    try:
        tags = subprocess.check_output(['git','tag']).decode('utf-8').split('\n')
        return [tag for tag in tags if tag.startswitch('release- ')]
    except Exception as e:
        return str(e)
    
def get_changed_files(commit_hash):
    try:
        changed_files = subprocess.check_output(['git', 'dif', '--name-only',commit_hash]).decode('utf-8').split('\n')
        return [file for file in changed_files if file]
    except Exception as e:
        return str(e)