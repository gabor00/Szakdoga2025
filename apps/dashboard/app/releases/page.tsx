"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { AlertCircle, CheckCircle2, GitCommit, Package, RefreshCw } from "lucide-react"

interface Change {
  service: string;
  type: string;
}

interface Release {
  tag: string;
  commit: string;
  status: string;
  date: string;
  author: string;
  changes: Change[];
}

// GitHub API válasz típusok
interface GitHubTag {
  name: string;
  commit: {
    sha: string;
  };
}

export default function ReleasesPage() {
  const [releases, setReleases] = useState<Release[]>([]);
  const [selectedSlot, setSelectedSlot] = useState("slot-b");
  const [deployDialogOpen, setDeployDialogOpen] = useState(false);
  const [selectedRelease, setSelectedRelease] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedServices, setSelectedServices] = useState<Record<string, boolean>>({
    microservice1: true,
    microservice2: true,
    microservice3: true
  });

  const fetchReleases = () => {
    setIsLoading(true);
    fetch('http://localhost:8100/releases')
      .then(res => res.json())
      .then(data => {
        console.log('Releases data:', data);
        if (Array.isArray(data) && data.length > 0) {
          setReleases(data);
        } else {
          console.log('Nincs adat a backendről, közvetlenül lekérjük a GitHub API-ból');
          // Ha a backend nem ad vissza adatot, közvetlenül a GitHub API-ból kérjük le
          fetch('https://api.github.com/repos/gabor00/Szakdoga2025/tags')
            .then(res => res.json())
            .then((tagsData: GitHubTag[]) => {
              const formattedTags = tagsData.map((tag: GitHubTag) => ({
                tag: tag.name,
                commit: tag.commit.sha.substring(0, 8),
                status: "available",
                date: new Date().toISOString(), // Nincs dátum a tag API-ban
                author: "Unknown", // Nincs szerző a tag API-ban
                changes: [
                  { service: "microservice1", type: "changed" },
                  { service: "microservice2", type: "changed" },
                  { service: "microservice3", type: "changed" }
                ]
              }));
              setReleases(formattedTags);
            })
            .catch(err => {
              console.error('Error fetching tags from GitHub API:', err);
              setReleases([]);
            });
        }
        setIsLoading(false);
      })
      .catch(err => {
        console.error('Error fetching releases:', err);
        setReleases([]);
        setIsLoading(false);
      });
  };
  
useEffect(() => {
  // Automatikus adatlekérés az oldal betöltésekor
  fetchReleases();
}, []);


  const handleDeploy = (tag: string) => {
    setSelectedRelease(tag);
    // Reset selected services to all selected
    setSelectedServices({
      microservice1: true,
      microservice2: true,
      microservice3: true
    });
    setDeployDialogOpen(true);
  };

  const handleServiceCheckboxChange = (service: string, checked: boolean) => {
    setSelectedServices(prev => ({
      ...prev,
      [service]: checked
    }));
  };

  const handleConfirmDeploy = async () => {
    if (!selectedRelease) return;
    
    setIsLoading(true);
    
    // Kiválasztott szolgáltatások lekérése
    const servicesToDeploy = Object.entries(selectedServices)
      .filter(([_, selected]) => selected)
      .map(([service]) => service);
    
    if (servicesToDeploy.length === 0) {
      alert("Legalább egy szolgáltatást ki kell választani!");
      setIsLoading(false);
      return;
    }
    
    // Minden kiválasztott szolgáltatásra indítunk egy deployment-et
    try {
      const deployPromises = servicesToDeploy.map(service => 
        fetch('http://localhost:8100/deploy', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            service: service,
            version: selectedRelease,
            slot: selectedSlot === "slot-a" ? "blue" : "green"
          }),
        }).then(res => res.json())
      );
      
      await Promise.all(deployPromises);
      console.log('All deployments started');
      setDeployDialogOpen(false);
      
      // Frissítsük az oldalon lévő adatokat
      fetchReleases();
      
      // Navigáljunk a deployments oldalra
      window.location.href = '/';
    } catch (err) {
      console.error('Error during deployments:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Available Releases</h1>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-sm">
            Total: {releases.length}
          </Badge>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={fetchReleases} 
            disabled={isLoading}
            className="flex items-center gap-1"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center p-8">
          <p>Loading releases...</p>
        </div>
      ) : releases.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-muted-foreground">No releases found. Create a release on GitHub to get started.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Release Tag</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Commit</TableHead>
                  <TableHead>Author</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Changes</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {releases.map((release) => (
                  <TableRow key={release.tag}>
                    <TableCell className="font-medium">{release.tag}</TableCell>
                    <TableCell>{new Date(release.date).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <GitCommit className="h-4 w-4 text-muted-foreground" />
                        {release.commit}
                      </div>
                    </TableCell>
                    <TableCell>{release.author}</TableCell>
                    <TableCell>
                      <Badge variant={release.status === "deployed" ? "default" : "outline"}>
                        {release.status === "deployed" ? "Deployed" : "Available"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {release.changes && release.changes.filter((c) => c.type === "changed").length > 0 && (
                          <Badge variant="default" className="bg-blue-500">
                            {release.changes.filter((c) => c.type === "changed").length} changed
                          </Badge>
                        )}
                        {release.changes && release.changes.filter((c) => c.type === "unchanged").length > 0 && (
                          <Badge variant="outline">
                            {release.changes.filter((c) => c.type === "unchanged").length} unchanged
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button
                        onClick={() => handleDeploy(release.tag)}
                        size="sm"
                        disabled={release.status === "deployed" || isLoading}
                        className="flex items-center gap-2"
                      >
                        <Package className="h-4 w-4" />
                        Deploy
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={deployDialogOpen} onOpenChange={setDeployDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deploy Release</DialogTitle>
            <DialogDescription>
              You are about to deploy {selectedRelease} to a deployment slot. Select which microservices you want to deploy.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <h4 className="font-medium">Select Deployment Slot</h4>
              <Select value={selectedSlot} onValueChange={setSelectedSlot}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a slot" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="slot-a">Slot A</SelectItem>
                  <SelectItem value="slot-b">Slot B</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium">Select Services to Deploy</h4>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="microservice1" 
                    checked={selectedServices.microservice1} 
                    onCheckedChange={(checked) => handleServiceCheckboxChange("microservice1", checked as boolean)} 
                  />
                  <label htmlFor="microservice1" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    Microservice 1
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="microservice2" 
                    checked={selectedServices.microservice2} 
                    onCheckedChange={(checked) => handleServiceCheckboxChange("microservice2", checked as boolean)} 
                  />
                  <label htmlFor="microservice2" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    Microservice 2
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="microservice3" 
                    checked={selectedServices.microservice3} 
                    onCheckedChange={(checked) => handleServiceCheckboxChange("microservice3", checked as boolean)} 
                  />
                  <label htmlFor="microservice3" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    Microservice 3
                  </label>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDeployDialogOpen(false)} disabled={isLoading}>
              Cancel
            </Button>
            <Button onClick={handleConfirmDeploy} disabled={isLoading}>
              {isLoading ? "Deploying..." : `Deploy to ${selectedSlot === "slot-a" ? "Slot A" : "Slot B"}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
