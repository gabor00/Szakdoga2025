
const API_BASE_URL = 'http://deployment-engine:8000';


export async function GET(serviceName: string, tag: string, slot?: string) {
    try {
      const response = await fetch(`${API_BASE_URL}/releases/deploy`, {
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
        console.log(JSON.stringify(response))
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ detail: response.statusText }));
            return Response.json(`Failed to deploy service: ${errorData.detail || response.statusText}`);
        }
        
        return Response.json(await response.json())
      } catch (error) {
        return Response.json(error)
      }
}