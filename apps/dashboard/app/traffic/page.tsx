"use client"


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
import { fetchTraffic, updateTraffic } from "./actions"

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
    fetchTraffic().then(data => {
      console.log('Traffic data:', data);
      // Ellenőrizzük, hogy a data egy tömb-e
      if (Array.isArray(data)) {
        setServices(data);
        
        // Traffic értékek inicializálása
        const initialTraffic = data.reduce(
          (acc: Record<string, Record<string, number>>, service: Service) => {
            if (service.slots && service.slots.length >= 2) {
              acc[service.id] = {
                "blue": service.slots[0].traffic,
                "green": service.slots[1].traffic,
              };
            }
            return acc;
          },
          {}
        );
        setTrafficValues(initialTraffic);
      } else {
        console.error('Nem megfelelő traffic adat forma', data);
        setServices([]);
        setTrafficValues({});
      }
    })
    .catch(err => {
      console.error('Hiba a ekérésben', err);
      setServices([]);
      setTrafficValues({});
    });
  }, []);

  const handleTrafficChange = (serviceId: string, slotId: string, value: number[]) => {
    const newValue = value[0];
    const otherSlotId = slotId === "blue" ? "green" : "blue";
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
    const promises = services.map(service => 
      updateTraffic(service.name, trafficValues[service.id]["blue"], trafficValues[service.id]["green"])
    );

    Promise.all(promises)
      .then(() => {
        console.log('Traffic konfiguráció alkalmazva');
        setConfirmDialogOpen(false);
      })
      .catch(err => console.error('Hiba a traffic alkalmazásakor:', err));
  };

  const hasChanges = () => {
    return services.some(
      (service) =>
        service.slots[0].traffic !== trafficValues[service.id]["blue"] ||
        service.slots[1].traffic !== trafficValues[service.id]["green"]
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
                      <TableCell>Slot {slot.id === "blue" ? "Blue" : "Green"}</TableCell>
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
                  {trafficValues[service.id]["blue"] === 0 || trafficValues[service.id]["green"] === 0
                    ? "Egyik slot 0%-os forgalmat kapott"
                    : "Traffik forgalom elosztása a két slot között"}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const currentBlue = trafficValues[service.id]["blue"];
                    const currentGreen = trafficValues[service.id]["green"];
                    setTrafficValues({
                      ...trafficValues,
                      [service.id]: {
                        "blue": currentGreen,
                        "green": currentBlue,
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
              Biztos vagy benne hogy változtatni szeretnéd a forgalmat? Ez befolyásolja az éles környezetet.
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
