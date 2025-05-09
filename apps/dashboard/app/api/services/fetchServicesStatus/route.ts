
const API_BASE_URL = 'http://deployment-engine:8000';


export async function GET() {
    try {
      const response = await fetch(`${API_BASE_URL}/services`);
        console.log(JSON.stringify(response))
        
        if (!response.ok) {
          return Response.json(`Failed to fetch services status: ${response.statusText}`);
        }
        
        return Response.json(await response.json())
      } catch (error) {
        return Response.json(JSON.stringify(error))
      }
}