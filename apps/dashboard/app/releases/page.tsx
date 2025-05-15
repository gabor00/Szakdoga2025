"use client"

//apps/dashboard/app/releases/page.tsx

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {Dialog,DialogContent,DialogDescription,DialogFooter,DialogHeader,DialogTitle} from "@/components/ui/dialog"
import { AlertCircle, CheckCircle2, GitCommit, Package } from "lucide-react"

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

export default function ReleasesPage() {
  const [releases, setReleases] = useState<Release[]>([]);
  const [selectedSlot, setSelectedSlot] = useState("slot-b");
  const [deployDialogOpen, setDeployDialogOpen] = useState(false);
  const [selectedRelease, setSelectedRelease] = useState<string | null>(null);

  useEffect(() => {
    // Adatok lekérése a backendről
    fetch('http://localhost:8100/releases')
    .then(res => res.json())
    .then(data => {
      console.log('Releases data:', data);
      setReleases(Array.isArray(data) ? data : []);
    })
    .catch(err => {
      console.error('Error fetching releases:', err);
      setReleases([]);
    });
  }, []);

  const handleDeploy = (tag: string) => {
    setSelectedRelease(tag);
    setDeployDialogOpen(true);
  };

  const handleConfirmDeploy = () => {
    if (!selectedRelease) return;
    
    // Deployment indítása
    fetch('http://localhost:8100/deploy', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        service: selectedRelease.split('-')[1], // Feltételezzük, hogy a tag formátuma: release-{service}-{version}
        version: selectedRelease,
        slot: selectedSlot === "slot-a" ? "blue" : "green"
      }),
    })
      .then(res => res.json())
      .then(data => {
        console.log('Deployment started:', data);
        setDeployDialogOpen(false);
      })
      .catch(err => console.error('Error starting deployment:', err));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Available Releases</h1>
        <Badge variant="outline" className="text-sm">
          Total: {releases.length}
        </Badge>
      </div>

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
              {releases?.map((release) => (
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
                      {release.changes.filter((c) => c.type === "changed").length > 0 && (
                        <Badge variant="default" className="bg-blue-500">
                          {release.changes.filter((c) => c.type === "changed").length} changed
                        </Badge>
                      )}
                      {release.changes.filter((c) => c.type === "unchanged").length > 0 && (
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
                      disabled={release.status === "deployed"}
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

      <Dialog open={deployDialogOpen} onOpenChange={setDeployDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deploy Release</DialogTitle>
            <DialogDescription>
              You are about to deploy {selectedRelease} to a deployment slot. This will build and deploy only the
              changed microservices.
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
              <h4 className="font-medium">Services to Build & Deploy</h4>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Service</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedRelease &&
                    releases
                      .find((r) => r.tag === selectedRelease)
                      ?.changes.map((change, index) => (
                        <TableRow key={index}>
                          <TableCell className="flex items-center gap-2">
                            {change.type === "changed" ? (
                              <AlertCircle className="h-4 w-4 text-blue-500" />
                            ) : (
                              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                            )}
                            {change.service}
                          </TableCell>
                          <TableCell>
                            <Badge variant={change.type === "changed" ? "default" : "outline"}>
                              {change.type === "changed" ? "Will build" : "No changes"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                </TableBody>
              </Table>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDeployDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleConfirmDeploy}>
              Deploy to {selectedSlot === "slot-a" ? "Slot A" : "Slot B"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
