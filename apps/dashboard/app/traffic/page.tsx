"use client"

//apps/dashboard/app/traffic/page.tsx

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ArrowDownUp, Save } from "lucide-react"

interface Slot {
  id: string;
  version: string;
  traffic: number;
  status: string;
}

interface Service {
  id: string;
  name: string;
  slots: Slot[];
}

export default function TrafficPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [trafficValues, setTrafficValues] = useState<Record<string, Record<string, number>>>({});
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);

  useEffect(() => {
    // Adatok lekérése a backendről
     fetch('http://localhost:8100/traffic')
    .then(res => res.json())
    .then(data => {
      console.log('Traffic data:', data);
      // Ellenőrizzük, hogy a data egy tömb-e
      if (Array.isArray(data)) {
        setServices(data);
        
        // Traffic értékek inicializálása
        const initialTraffic = data.reduce(
          (acc: Record<string, Record<string, number>>, service: Service) => {
            if (service.slots && service.slots.length >= 2) {
              acc[service.id] = {
                "slot-a": service.slots[0].traffic,
                "slot-b": service.slots[1].traffic,
              };
            }
            return acc;
          },
          {}
        );
        setTrafficValues(initialTraffic);
      } else {
        console.error('Invalid traffic data format:', data);
        setServices([]);
        setTrafficValues({});
      }
    })
    .catch(err => {
      console.error('Error fetching traffic data:', err);
      setServices([]);
      setTrafficValues({});
    });
  }, []);

  const handleTrafficChange = (serviceId: string, slotId: string, value: number[]) => {
    const newValue = value[0];
    const otherSlotId = slotId === "slot-a" ? "slot-b" : "slot-a";
    setTrafficValues({
      ...trafficValues,
      [serviceId]: {
        [slotId]: newValue,
        [otherSlotId]: 100 - newValue,
      },
    });
  };

  const handleApplyTraffic = () => {
    setConfirmDialogOpen(true);
  };

  const handleConfirmApply = () => {
    // Minden szolgáltatáshoz külön kérés
    const promises = services.map(service => {
      return fetch('http://localhost:8100/slot-config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          service: service.name,
          blue_percentage: trafficValues[service.id]["slot-a"],
          green_percentage: trafficValues[service.id]["slot-b"]
        }),
      });
    });

    Promise.all(promises)
      .then(() => {
        console.log('Traffic configuration applied');
        setConfirmDialogOpen(false);
      })
      .catch(err => console.error('Error applying traffic configuration:', err));
  };

  const hasChanges = () => {
    return services.some(
      (service) =>
        service.slots[0].traffic !== trafficValues[service.id]["slot-a"] ||
        service.slots[1].traffic !== trafficValues[service.id]["slot-b"]
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Traffic Management</h1>
        <Button onClick={handleApplyTraffic} disabled={!hasChanges()} className="flex items-center gap-2">
          <Save className="h-4 w-4" />
          Apply Configuration
        </Button>
      </div>

      <div className="grid gap-4">
        {services.map((service) => (
          <Card key={service.id}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle>{service.name}</CardTitle>
                <Badge variant={service.slots.some((s) => s.status !== "healthy") ? "destructive" : "outline"}>
                  {service.slots.some((s) => s.status !== "healthy") ? "Warning" : "Healthy"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Slot</TableHead>
                    <TableHead>Version</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[40%]">Traffic</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {service.slots.map((slot) => (
                    <TableRow key={slot.id}>
                      <TableCell>Slot {slot.id === "slot-a" ? "A" : "B"}</TableCell>
                      <TableCell>{slot.version}</TableCell>
                      <TableCell>
                        <Badge variant={slot.status === "healthy" ? "outline" : "destructive"}>
                          {slot.status === "healthy" ? "Healthy" : "Warning"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-4">
                          <Slider
                            value={[trafficValues[service.id][slot.id]]}
                            onValueChange={(value) => handleTrafficChange(service.id, slot.id, value)}
                            className="flex-1"
                          />
                          <span className="w-12 text-right">{trafficValues[service.id][slot.id]}%</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="mt-4 flex justify-between items-center">
                <p className="text-sm text-muted-foreground">
                  {trafficValues[service.id]["slot-a"] === 0 || trafficValues[service.id]["slot-b"] === 0
                    ? "Single slot active"
                    : "Traffic split between slots"}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const currentA = trafficValues[service.id]["slot-a"];
                    const currentB = trafficValues[service.id]["slot-b"];
                    setTrafficValues({
                      ...trafficValues,
                      [service.id]: {
                        "slot-a": currentB,
                        "slot-b": currentA,
                      },
                    });
                  }}
                  className="flex items-center gap-2"
                >
                  <ArrowDownUp className="h-4 w-4" />
                  Swap Traffic
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apply Traffic Configuration</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to apply these traffic changes? This will affect the live traffic distribution
              between deployment slots.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmApply}>Apply Changes</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
