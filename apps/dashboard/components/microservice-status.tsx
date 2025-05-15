"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { RefreshCw, AlertTriangle } from "lucide-react"
import { useState, useEffect } from "react"

// Típusdefiníció
interface Microservice {
  id: string;
  name: string;
  status: string;
  version: string;
  slot: string;
  traffic: number;
  lastDeployed: string;
}

// API válasz típusok
interface ServiceSlot {
  id: string;
  version: string;
  traffic: number;
  status: string;
}

interface TrafficService {
  id: string;
  name: string;
  slots: ServiceSlot[];
}

export function MicroserviceStatus() {
  const [microservices, setMicroservices] = useState<Microservice[]>([
    {
      id: "ms-1",
      name: "Auth Service",
      status: "healthy",
      version: "1.2.3",
      slot: "A",
      traffic: 100,
      lastDeployed: "2023-05-10T14:30:00Z",
    },
    {
      id: "ms-2",
      name: "API Gateway",
      status: "healthy",
      version: "2.0.1",
      slot: "A",
      traffic: 100,
      lastDeployed: "2023-05-09T10:15:00Z",
    },
    {
      id: "ms-3",
      name: "Data Service",
      status: "warning",
      version: "0.9.5",
      slot: "A",
      traffic: 100,
      lastDeployed: "2023-05-08T16:45:00Z",
    }
  ]);
  
  useEffect(() => {
    // Adatok lekérése a backendről
    fetch('http://localhost:8100/traffic')
      .then(res => res.json())
      .then((data: TrafficService[]) => {
        // Adatok átalakítása a komponens által várt formátumra
        const services = data.map((service: TrafficService) => ({
          id: service.id,
          name: service.name,
          status: service.slots[0].status,
          version: service.slots[0].version,
          slot: service.slots[0].id === "slot-a" ? "A" : "B",
          traffic: service.slots[0].traffic,
          lastDeployed: new Date().toISOString() // Ez az adat nem jön a backendről, így most használunk egy placeholder-t
        }));
        
        setMicroservices(services);
      })
      .catch(err => console.error('Error fetching microservices:', err));
  }, []);

  // Event handlers
  const handleRefresh = () => {
    // Implement refresh logic
    console.log("Refreshing microservice status");
    
    // Adatok újra lekérése
    fetch('http://localhost:8100/traffic')
      .then(res => res.json())
      .then((data: TrafficService[]) => {
        // Adatok átalakítása a komponens által várt formátumra
        const services = data.map((service: TrafficService) => ({
          id: service.id,
          name: service.name,
          status: service.slots[0].status,
          version: service.slots[0].version,
          slot: service.slots[0].id === "slot-a" ? "A" : "B",
          traffic: service.slots[0].traffic,
          lastDeployed: new Date().toISOString()
        }));
        
        setMicroservices(services);
      })
      .catch(err => console.error('Error refreshing microservices:', err));
  };

  // Update the handleRestart function to include more functionality since we don't have a dedicated health page
  const handleRestart = (id: string) => {
    // Implement restart logic
    console.log(`Restarting microservice ${id}`);
    
    // Szolgáltatás újraindítása
    const service = microservices.find(ms => ms.id === id);
    if (service) {
      fetch(`http://localhost:8100/restart/szakdoga2025-${service.name.toLowerCase().replace(' ', '-')}-${service.slot === "A" ? "blue" : "green"}`, {
        method: 'POST',
      })
        .then(res => res.json())
        .then(data => console.log('Restart response:', data))
        .catch(err => console.error('Error restarting service:', err));
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Microservice Status</CardTitle>
        <Button variant="outline" size="icon" onClick={handleRefresh}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {microservices.map((service) => (
          <div key={service.id} className="border rounded p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="font-medium">{service.name}</h3>
                <Badge variant={service.status === "healthy" ? "outline" : "destructive"}>
                  {service.status === "healthy" ? "Healthy" : "Warning"}
                </Badge>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleRestart(service.id)}
                className="h-7 px-2"
              >
                Restart
              </Button>
            </div>
            <div className="text-sm text-muted-foreground">
              Version {service.version} • Slot {service.slot} • {service.traffic}% Traffic
            </div>
            <div className="flex items-center gap-2">
              <Progress value={service.status === "healthy" ? 100 : 60} className="h-2" />
              {service.status !== "healthy" && (
                <AlertTriangle className="h-4 w-4 text-destructive" />
              )}
            </div>
            <div className="text-xs text-muted-foreground">
              Last deployed: {new Date(service.lastDeployed).toLocaleString()}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
