'use server'

import { type GitHubTag, type Release } from './types'

export async function fetchReleases(): Promise<Release[]> {
  try {    const response = await fetch('https://api.github.com/repos/gabor00/Szakdoga2025/tags', {
    cache: 'force-cache',  
    next: { 
        revalidate: 600 
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const tagsData = await response.json() as GitHubTag[];
    return tagsData.map((tag: GitHubTag) => ({
      tag: tag.name,
      commit: tag.commit.sha.substring(0, 8)
    }));
  } catch (error) {
    console.error("Hiba a lekérésben:", error);
    return [];
  }
}

export async function fetchData(packageName: string) { 
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
        throw new Error('GITHUB_TOKEN nincs beállítva a környezeti változók között.');
    }

    try {
        const response = await fetch(
            `https://api.github.com/users/gabor00/packages/container/${packageName}/versions`,
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json',
                },
                next: { 
                    revalidate: 0
                }
            }
        );

        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error('Hiba a lekérésben:', error);
        throw error;
    }
}

export async function deployRelease(service: string, version: string, slot: 'blue' | 'green') {
  try {
    const response = await fetch(`${process.env.DEPLOYMENT_ENGINE}/deploy`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        service,
        version,
        slot
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Hiba a deployment-ben:', error);
    throw error;
  }
}
