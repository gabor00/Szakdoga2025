
const API_BASE_URL = 'http://deployment-engine:8000';


export async function GET(serviceName: string, slot: string) {
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
        console.log(JSON.stringify(response))
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ detail: response.statusText }));
            return Response.json(`Failed to restart service: ${errorData.detail || response.statusText}`);
        }
        
        return Response.json(await response.json())
      } catch (error) {
        return Response.json(error)
      }
}