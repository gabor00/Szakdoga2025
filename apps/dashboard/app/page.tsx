"use client"

//Apps/dashboard/app/page.tsx

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button";
import { RefreshCw, Play, Pause } from "lucide-react";
import { restartService, stopContainer, startContainer, fetchServices } from "./actions";
import { useRouter } from "next/navigation"


// Típusdefiníciók
interface Service {
  name: string;
  version: string;
  status: string;
}

interface Deployment {
  id: string;
  version: string;
  services: Service[];
  traffic: number;
  status: string;
}

interface DeploymentsState {
  "slot-a": Deployment[];
  "slot-b": Deployment[];
}

// API válasz típusok
interface ServiceItem {
  name: string;
  version: string;
  status: string;
}

interface SlotData {
  id: string;
  name: string;
  status: string;
  traffic: number;
  version: string;
  services: ServiceItem[];
}

export interface ServicesResponse {
  "slot-a": SlotData[];
  "slot-b": SlotData[];
}


export default function DeploymentsPage() {
  const [deployments, setDeployments] = useState<DeploymentsState>({
    "slot-a": [],
    "slot-b": []
  });
  const [loading, setLoading] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    // Adatok lekérése a backendről
    fetchServices().then((data: ServicesResponse) => {
      console.log('Szolgáltatás adat:', data);
      // Ellenőrizzük, hogy a data tartalmazza-e a várt adatokat
      if (data && data["slot-a"] && data["slot-b"]) {
        setDeployments(data);
      } else {
        console.error('Nem megfelelő adat formátum', data);
        setDeployments({
          "slot-a": [],
          "slot-b": []
        });
      }
    })
    .catch(err => {
      console.error('Hiba a lekérésben', err);
      setDeployments({
        "slot-a": [],
        "slot-b": []
      });
    });
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Deployments</h1>
      </div>

      <Tabs defaultValue="current">
        <TabsList>
          <TabsTrigger value="current">Current Deployments</TabsTrigger>
          <div className="flex space-x-3">
                     <a 
                       href="http://microservice1.com" 
                       target="_blank" 
                       rel="noopener noreferrer"
                       className="px-3 py-2 text-sm rounded-md bg-secondary hover:bg-secondary/80 transition-colors"
                     >
                       Microservice1
                     </a>
                     <a 
                       href="http://microservice2.com" 
                       target="_blank" 
                       rel="noopener noreferrer"
                       className="px-3 py-2 text-sm rounded-md bg-secondary hover:bg-secondary/80 transition-colors"
                     >
                       Microservice2
                     </a>
                     <a 
                       href="http://microservice3.com" 
                       target="_blank" 
                       rel="noopener noreferrer"
                       className="px-3 py-2 text-sm rounded-md bg-secondary hover:bg-secondary/80 transition-colors"
                     >
                       Microservice3
                     </a>
                   </div>
        </TabsList>
        <TabsContent value="current" className="space-y-4">
          {['slot-a', 'slot-b'].map((slotId) => {
            const slotDeployments = deployments[slotId as keyof typeof deployments];
            if (!slotDeployments || slotDeployments.length === 0) {
              return (
                <Card key={slotId}>
                  <CardContent className="p-6">
                    <div className="text-center p-4">
                      <h3 className="text-lg font-medium">Slot {slotId === "slot-a" ? "Blue" : "Green"}</h3>
                      <p className="text-muted-foreground">No active deployment</p>
                    </div>
                  </CardContent>
                </Card>
              );
            }
            
            const slot = slotDeployments[0];
            return (
              <Card key={slotId}>
                <CardContent className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-lg font-medium">Slot {slotId === "slot-a" ? "Blue" : "Green"}</h3>
                      <p className="text-sm text-muted-foreground">{slot.version}</p>
                    </div>
                    <Badge variant={slot.traffic > 0 ? "default" : "outline"}>
                      {slot.traffic}% Traffic
                    </Badge>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Service</TableHead>
                        <TableHead>Version</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {slot.services?.map((service) => (
                        <TableRow key={service.name}>
                          <TableCell>{service.name} </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="font-mono">
                              {service.version !== "unknown" ? service.version : "N/A"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={service.status === "healthy" ? "outline" : "destructive"}>
                              {service.status === "healthy" ? "Healthy" : "Warning"}
                            </Badge>
                          </TableCell>
                          <TableCell className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={loading === `${service.name}-${slotId}-restart`}
                              onClick={async () => {
                                setLoading(`${service.name}-${slotId}-restart`);
                                try {
                                  await restartService(service.name, slotId === "slot-a" ? "blue" : "green");
                                  alert(`Restarted ${service.name} (${slotId === "slot-a" ? "blue" : "green"})`);
                                } catch (e: any) {
                                  alert(e.message || "Nem sikerült újraindítani");
                                } finally {
                                  setLoading(null);
                                  router.refresh();
                                }
                              }}
                              className="flex items-center gap-1"
                            >
                              <RefreshCw className="h-4 w-4 animate-spin" style={{ display: loading === `${service.name}-${slotId}-restart` ? "inline-block" : "none" }} />
                              Restart
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={loading === `${service.name}-${slotId}-start`}
                              onClick={async () => {
                                setLoading(`${service.name}-${slotId}-start`);
                                try {
                                  await startContainer(service.name, slotId === "slot-a" ? "blue" : "green");
                                  alert(`Elindult a ${service.name} (${slotId === "slot-a" ? "blue" : "green"})`);
                                } catch (e: any) {
                                  alert(e.message || "Nem sikerült elindítani");
                                } finally {
                                  setLoading(null);
                                  router.refresh();
                                }
                              }}
                              className="flex items-center gap-1"
                            >
                              <Play className="h-4 w-4" />
                              Start
                            </Button>                            
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={loading === `${service.name}-${slotId}-stop`}
                              onClick={async () => {
                                setLoading(`${service.name}-${slotId}-stop`);
                                try {
                                  await stopContainer(service.name, slotId === "slot-a" ? "blue" : "green");
                                  alert(`Stoped ${service.name} (${slotId === "slot-a" ? "blue" : "green"})`);
                                } catch (e: any) {
                                  alert(e.message || "Nem sikerült leállítani");
                                } finally {
                                  setLoading(null);
                                  router.refresh();
                                }
                              }}
                              className="flex items-center gap-1"
                            >
                              <Pause className="h-4 w-4" />
                              Stop
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>
      </Tabs>
    </div>
  );
}

