"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useState, useEffect } from "react"

// Típusdefiníció
interface Deployment {
  id: string;
  version: string;
  status: string;
  slot: string;
}

// API válasz típusok
interface HistoryItem {
  id: string;
  service: string;
  version: string;
  status: string;
  timestamp: number; // Unix timestamp
  slot: string;
}

export function RecentDeployments() {
  const [recentDeployments, setRecentDeployments] = useState<Deployment[]>([
    {
      id: "deploy-1",
      version: "release-1.2.3",
      status: "success",
      slot: "A",
    },
    {
      id: "deploy-2",
      version: "release-1.1.0",
      status: "success",
      slot: "B",
    },
    {
      id: "deploy-3",
      version: "release-1.0.5",
      status: "failed",
      slot: "A",
    }
  ]);
  
  useEffect(() => {
  // Deployment history lekérése
  fetch('http://localhost:8100/deployment/history')
    .then(res => res.json())
    .then((data: HistoryItem[]) => {
      console.log('History data:', data);
      // Ellenőrizzük, hogy a data egy tömb-e
      if (Array.isArray(data)) {
        // Adatok átalakítása a komponens által várt formátumra
        const deployments = data.map((d: HistoryItem) => ({
          id: d.id,
          version: d.version,  // Ez már a GitHub tag
          timestamp: new Date(d.timestamp * 1000).toISOString(),
          status: d.status,
          slot: d.slot
        }));
        
        setRecentDeployments(deployments);
      } else {
        console.error('Invalid history data format:', data);
        setRecentDeployments([]);
      }
    })
    .catch(err => {
      console.error('Error fetching deployment history:', err);
      setRecentDeployments([]);
    });
}, []);


  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Deployments</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {recentDeployments.map((deployment) => (
          <div key={deployment.id} className="flex items-center justify-between border-b pb-2 last:border-0 last:pb-0">
            <div>
              <div className="font-medium">{deployment.version}</div>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-sm">Slot {deployment.slot}</div>
              <Badge variant={deployment.status === "success" ? "outline" : "destructive"}>
                {deployment.status === "success" ? "Success" : "Failed"}
              </Badge>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
