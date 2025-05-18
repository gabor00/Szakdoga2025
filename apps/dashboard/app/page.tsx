"use client"

//Apps/dashboard/app/page.tsx

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {  AlertDialog,  AlertDialogAction,  AlertDialogCancel,  AlertDialogContent,  AlertDialogDescription,
    AlertDialogFooter,  AlertDialogHeader,  AlertDialogTitle,} from "@/components/ui/alert-dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ArrowDownUp, History, RotateCcw } from "lucide-react"

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

interface HistoryItem {
  id: string;
  service: string;
  version: string;
  slot: string;
  timestamp: number;
  status: string;
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

interface ServicesResponse {
  "slot-a": SlotData[];
  "slot-b": SlotData[];
}


export default function DeploymentsPage() {
  const [deployments, setDeployments] = useState<DeploymentsState>({
    "slot-a": [],
    "slot-b": []
  });
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [rollbackDialogOpen, setRollbackDialogOpen] = useState(false);
  const [selectedDeployment, setSelectedDeployment] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    // Adatok lekérése a backendről
     fetch('http://localhost:8100/services')
    .then(res => res.json())
    .then((data: ServicesResponse) => {
      console.log('Services data:', data);
      // Ellenőrizzük, hogy a data tartalmazza-e a várt adatokat
      if (data && data["slot-a"] && data["slot-b"]) {
        setDeployments(data);
      } else {
        console.error('Invalid services data format:', data);
        setDeployments({
          "slot-a": [],
          "slot-b": []
        });
      }
    })
    .catch(err => {
      console.error('Error fetching deployments:', err);
      setDeployments({
        "slot-a": [],
        "slot-b": []
      });
    });
      
  // Deployment history lekérése
  fetch('http://localhost:8100/deployment/history')
    .then(res => res.json())
    .then(data => {
      console.log('History data:', data);
      setHistory(Array.isArray(data) ? data : []);
    })
    .catch(err => {
      console.error('Error fetching history:', err);
      setHistory([]);
    });
  }, []);

  const handleRollback = (deploymentId: string) => {
    setSelectedDeployment(deploymentId);
    setRollbackDialogOpen(true);
  };

  const handleConfirmRollback = () => {
    if (!selectedDeployment) return;
    
    // Deployment ID-ból kinyerjük a service nevet
    const parts = selectedDeployment.split('-');
    const service = parts[0];
    
    // Rollback kérés küldése
    fetch(`http://localhost:8100/rollback/${service}`, {
      method: 'POST',
    })
      .then(res => res.json())
      .then(data => {
        console.log('Rollback response:', data);
        
        // Frissítsük az adatokat a rollback után
        fetch('http://localhost:8100/services')
          .then(res => res.json())
          .then(data => setDeployments(data))
          .catch(err => console.error('Error refreshing deployments:', err));
      })
      .catch(err => console.error('Error during rollback:', err));
    
    setRollbackDialogOpen(false);
  };

  const handleSwapSlots = () => {
    // Implement your slot swap logic here
    console.log("Swapping deployment slots");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Deployments</h1>
        <Button onClick={handleSwapSlots} variant="outline" className="flex items-center gap-2">
          <ArrowDownUp className="h-4 w-4" />
          Swap Slots
        </Button>
      </div>

      <Tabs defaultValue="current">
        <TabsList>
          <TabsTrigger value="current">Current Deployments</TabsTrigger>
          <TabsTrigger value="history">Deployment History</TabsTrigger>
        </TabsList>
        <TabsContent value="current" className="space-y-4">
          {["slot-a", "slot-b"].map((slotId) => {
            const slotDeployments = deployments[slotId as keyof typeof deployments];
            if (!slotDeployments || slotDeployments.length === 0) {
              return (
                <Card key={slotId}>
                  <CardContent className="p-6">
                    <div className="text-center p-4">
                      <h3 className="text-lg font-medium">Slot {slotId === "slot-a" ? "A" : "B"}</h3>
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
                      <h3 className="text-lg font-medium">Slot {slotId === "slot-a" ? "A" : "B"}</h3>
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
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {slot.services?.map((service) => (
                        <TableRow key={service.name}>
                          <TableCell>{service.name}</TableCell>
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
                        </TableRow>
                      ))}

                    </TableBody>
                  </Table>
                  <div className="mt-4 flex justify-end">
                    <Button
                      onClick={() => handleRollback(slot.id)}
                      variant="outline"
                      size="sm"
                      disabled={slot.status === "inactive"}
                      className="flex items-center gap-2"
                    >
                      <RotateCcw className="h-4 w-4" />
                      Rollback
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>
        <TabsContent value="history">
          <Card>
            <CardContent className="p-6">
              {isLoading ? (
                <div className="text-center p-8">
                  <p>Loading deployment history...</p>
                </div>
              ) : history && history.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Service</TableHead>
                      <TableHead>Version</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Slot</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history.map((deployment) => (
                      <TableRow key={deployment.id}>
                        <TableCell>{deployment.service}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-mono">
                            {deployment.version}
                          </Badge>
                        </TableCell>
                        <TableCell>{new Date(deployment.timestamp * 1000).toLocaleString()}</TableCell>
                        <TableCell>Slot {deployment.slot}</TableCell>
                        <TableCell>
                          <Badge variant={deployment.status === "success" ? "outline" : "destructive"}>
                            {deployment.status === "success" ? "Success" : "Failed"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            onClick={() => handleRollback(deployment.id)}
                            variant="ghost"
                            size="sm"
                            disabled={deployment.status !== "success" || isLoading}
                            className="flex items-center gap-2"
                          >
                            <History className="h-4 w-4" />
                            Restore
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center p-4">
                  <p className="text-muted-foreground">No deployment history found</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <AlertDialog open={rollbackDialogOpen} onOpenChange={setRollbackDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Rollback</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to rollback to this deployment? This will revert all services to their previous
              versions.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setRollbackDialogOpen(false)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmRollback}>Confirm Rollback</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

