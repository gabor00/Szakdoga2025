import { NextApiRequest, NextApiResponse } from "next";

// Base URL for deployment API
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://deployment-engine:8000';


export async function GET() {
    try {
        const response = await fetch(`${API_BASE_URL}/releases`);
        console.log(JSON.stringify(response))
        
        if (!response.ok) {
          return Response.json(`Failed to fetch releases: ${response.statusText}`);
        }
        
        return Response.json(await response.json())
      } catch (error) {
        return Response.json(error)
      }
    
    
  }