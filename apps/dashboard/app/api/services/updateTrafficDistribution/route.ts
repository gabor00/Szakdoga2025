
const API_BASE_URL = 'http://172.18.0.6:8000';


export async function GET(serviceName: string, blueWeight: number, greenWeight: number) {
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
        console.log(JSON.stringify(response))
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ detail: response.statusText }));
            return Response.json(`Failed to update traffic: ${errorData.detail || response.statusText}`);
        }
        
        return Response.json(await response.json())
      } catch (error) {
        return Response.json(error)
      }
}