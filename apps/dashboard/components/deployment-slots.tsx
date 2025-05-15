"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useState, useEffect } from "react"

// Típusdefiníciók
interface Service {
  name: string;
  version: string;
  status: string;
}

interface Slot {
  id: string;
  name: string;
  status: string;
  traffic: number;
  version: string;
  services: Service[];
}

interface DeploymentSlotsProps {
  detailed?: boolean
}

// API válasz típusok
interface ServiceData {
  id: string;
  name: string;
  status: string;
  traffic: number;
  version: string;
  health: string;
}

interface ServicesResponse {
  "slot-a": ServiceData[];
  "slot-b": ServiceData[];
}

export function DeploymentSlots({ detailed = false }: DeploymentSlotsProps) {
  const [slots, setSlots] = useState<Slot[]>([
    {
      id: "slot-a",
      name: "Slot A",
      status: "active",
      traffic: 100,
      version: "release-1.2.3",
      services: [
        { name: "microservice1", version: "1.2.3", status: "healthy" },
        { name: "microservice2", version: "2.0.1", status: "healthy" },
        { name: "microservice3", version: "0.9.5", status: "warning" },
      ],
    },
    {
      id: "slot-b",
      name: "Slot B",
      status: "inactive",
      traffic: 0,
      version: "release-1.1.0",
      services: [
        { name: "Smicroservice1", version: "1.1.2", status: "healthy" },
        { name: "microservice3", version: "1.9.0", status: "healthy" },
        { name: "microservice3", version: "0.8.5", status: "healthy" },
      ],
    }
  ]);
  
  const [trafficValues, setTrafficValues] = useState<{[key: string]: number}>({
    "slot-a": 100,
    "slot-b": 0,
  });
  
  useEffect(() => {
    // Adatok lekérése a backendről
    fetch('http://localhost:8100/services')
      .then(res => res.json())
      .then((data: ServicesResponse) => {
        // Adatok átalakítása a komponens által várt formátumra
        const slotA = data["slot-a"].map((s: ServiceData) => ({
          id: "slot-a",
          name: "Slot A",
          status: s.status === "active" ? "active" : "inactive",
          traffic: s.traffic,
          version: s.version,
          services: [{ name: s.name, version: s.version, status: s.health }]
        }));
        
        const slotB = data["slot-b"].map((s: ServiceData) => ({
          id: "slot-b",
          name: "Slot B",
          status: s.status === "active" ? "active" : "inactive",
          traffic: s.traffic,
          version: s.version,
          services: [{ name: s.name, version: s.version, status: s.health }]
        }));
        
        setSlots([...slotA, ...slotB]);
        
        // Traffic értékek inicializálása
        if (slotA.length > 0 && slotB.length > 0) {
          setTrafficValues({
            "slot-a": slotA[0].traffic,
            "slot-b": slotB[0].traffic
          });
        }
      })
      .catch(err => console.error('Error fetching slots:', err));
  }, []);

  // Event handlers
  const handleTrafficChange = (slotId: string, value: number[]) => {
    const newValue = value[0];
    const otherSlotId = slotId === "slot-a" ? "slot-b" : "slot-a";
    setTrafficValues({
      ...trafficValues,
      [slotId]: newValue,
      [otherSlotId]: 100 - newValue,
    });
    // Implement your traffic change logic here
    console.log(`Changed traffic for ${slotId} to ${newValue}%`);
  };

  const handleApplyTraffic = () => {
    // Implement your apply traffic logic here
    console.log("Applying traffic configuration:", trafficValues);
    
    // Küldés a backendnek
    fetch('http://localhost:8100/slot-config', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        service: slots[0].services[0].name,
        blue_percentage: trafficValues["slot-a"],
        green_percentage: trafficValues["slot-b"]
      }),
    })
      .then(res => res.json())
      .then(data => console.log('Traffic configuration applied:', data))
      .catch(err => console.error('Error applying traffic configuration:', err));
  };

  const handleSwapSlots = () => {
    // Implement your slot swap logic here
    console.log("Swapping deployment slots");
  };

  if (!detailed) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Deployment Slots</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          {slots.map((slot) => (
            <div key={slot.id} className="flex items-center justify-between p-2 border rounded">
              <div>
                <div className="font-medium">{slot.name}</div>
                <div className="text-sm text-muted-foreground">{slot.version}</div>
              </div>
              <Badge variant={slot.traffic > 0 ? "default" : "outline"}>
                {slot.traffic}% Traffic
              </Badge>
            </div>
          ))}
          <Button onClick={handleSwapSlots} className="w-full">Swap Slots</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Deployment Slots</h2>
        <Button onClick={handleSwapSlots} variant="outline">Swap Slots</Button>
      </div>
      {slots.map((slot) => (
        <Card key={slot.id}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle>{slot.name}</CardTitle>
              <Badge variant={slot.status === "active" ? "default" : "outline"}>
                {slot.status === "active" ? "Active" : "Inactive"}
              </Badge>
            </div>
            <div className="text-sm text-muted-foreground">{slot.version}</div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <h4 className="font-medium">Traffic Allocation</h4>
                  <span className="text-sm">{trafficValues[slot.id]}%</span>
                </div>
                <Slider
                  value={[trafficValues[slot.id]]}
                  min={0}
                  max={100}
                  step={10}
                  onValueChange={(value) => handleTrafficChange(slot.id, value)}
                />
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Service</TableHead>
                    <TableHead>Version</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {slot.services.map((service) => (
                    <TableRow key={service.name}>
                      <TableCell>{service.name}</TableCell>
                      <TableCell>{service.version}</TableCell>
                      <TableCell>
                        <Badge variant={service.status === "healthy" ? "outline" : "destructive"}>
                          {service.status === "healthy" ? "Healthy" : "Warning"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Button onClick={handleApplyTraffic} className="w-full">Apply Traffic Configuration</Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
