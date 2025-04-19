// apps/dashboard/services/api.ts
import { toast } from '../components/ui/use-toast';

// Base URL for deployment API
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

// Error handler
const handleApiError = (error: unknown) => {
  console.error('API Error:', error);
  let errorMessage = 'Unknown error occurred';
  
  if (error instanceof Error) {
    errorMessage = error.message;
  } else if (typeof error === 'string') {
    errorMessage = error;
  }
  
  toast({
    title: 'API Error',
    description: errorMessage,
    variant: 'destructive',
  });
  
  throw new Error(errorMessage);
};

// Fetch releases
export async function fetchReleases() {
  try {
    const response = await fetch(`${API_BASE_URL}/releases`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch releases: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    return handleApiError(error);
  }
}

// Fetch latest release
export async function fetchLatestRelease() {
  try {
    const response = await fetch(`${API_BASE_URL}/releases/latest`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch latest release: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    return handleApiError(error);
  }
}

// Fetch services status
export async function fetchServicesStatus() {
  try {
    const response = await fetch(`${API_BASE_URL}/services`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch services status: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    return handleApiError(error);
  }
}

// Fetch single service status
export async function fetchServiceStatus(serviceName: string) {
  try {
    const response = await fetch(`${API_BASE_URL}/services/${serviceName}`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch service status: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    return handleApiError(error);
  }
}

// Deploy service
export async function deployService(serviceName: string, tag: string, slot?: string) {
  try {
    const response = await fetch(`${API_BASE_URL}/deploy`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        service_name: serviceName,
        tag,
        slot,
      }),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: response.statusText }));
      throw new Error(`Failed to deploy service: ${errorData.detail || response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    return handleApiError(error);
  }
}

// Update traffic distribution
export async function updateTrafficDistribution(serviceName: string, blueWeight: number, greenWeight: number) {
  try {
    const response = await fetch(`${API_BASE_URL}/traffic`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        service_name: serviceName,
        blue_weight: blueWeight,
        green_weight: greenWeight,
      }),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: response.statusText }));
      throw new Error(`Failed to update traffic: ${errorData.detail || response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    return handleApiError(error);
  }
}

// Restart service
export async function restartService(serviceName: string, slot: string) {
  try {
    const response = await fetch(`${API_BASE_URL}/restart`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        service_name: serviceName,
        slot,
      }),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: response.statusText }));
      throw new Error(`Failed to restart service: ${errorData.detail || response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    return handleApiError(error);
  }
}