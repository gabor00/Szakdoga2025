'use server'

import { type GitHubTag, type Release } from './types'

export async function fetchReleases(): Promise<Release[]> {
  try {    const response = await fetch('https://api.github.com/repos/gabor00/Szakdoga2025/tags', {
    cache: 'force-cache',  
    next: { 
        revalidate: 600 // Cache for 10 minutes (600 seconds)
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const tagsData = await response.json() as GitHubTag[];
    return tagsData.map((tag: GitHubTag) => ({
      tag: tag.name,
      commit: tag.commit.sha.substring(0, 8),
      status: "available",
      date: new Date().toISOString(),
      author: "Unknown",
      changes: [
        { service: "microservice1", type: "changed" },
        { service: "microservice2", type: "changed" },
        { service: "microservice3", type: "changed" }
      ]
    }));
  } catch (error) {
    console.error("Error fetching releases:", error);
    return [];
  }
}

export async function fetchData(packageName: string) { 
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
        throw new Error('GITHUB_TOKEN is not set in environment variables');
    }

    try {
        const response = await fetch(
            `https://api.github.com/orgs/gabor00/packages/container/${packageName}/versions`,
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json',
                },
                cache: 'force-cache', // Force cache for 10 minutes
                next: { 
                    revalidate: 600 // Cache for 10 minutes
                }
            }
        );

        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error('Error fetching package data:', error);
        throw error;
    }
}

export async function deployRelease(service: string, version: string, slot: 'blue' | 'green') {
  try {
    const response = await fetch('http://szakdoga2025-deployment-engine:8000/deploy', {
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
    console.error('Error during deployment:', error);
    throw error;
  }
}
