// apps/dashboard/components/releases-list.tsx
import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Loader2, Download, GitCommit, Clock, User } from 'lucide-react';
import { toast } from './ui/use-toast';
import { RefreshCw } from 'lucide-react';

// Define types
type ServiceChange = {
  'm1': boolean;
  'm2': boolean;
  'm3': boolean;
  'dashboard': boolean;
  'deployment-engine': boolean;
};

type Release = {
  tag: string;
  hash: string;
  author: string;
  date: string;
  message: string;
  changes: ServiceChange;
};

type ReleasesListProps = {
  onDeployRelease: (serviceName: string, tag: string) => Promise<void>;
};

export function ReleasesList({ onDeployRelease }: ReleasesListProps) {
  const [releases, setReleases] = useState<Release[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [deploying, setDeploying] = useState<boolean>(false);
  const [selectedService, setSelectedService] = useState<string>('');
  const [deployTag, setDeployTag] = useState<string>('');
  const [dialogOpen, setDialogOpen] = useState<boolean>(false);

  // Fetch releases
  const fetchReleases = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/deployment/releases');
      const data = await response.json();
      setReleases(data);
    } catch (error) {
      console.error(error)
      toast({
        title: 'Error fetching releases',
        description: 'Could not retrieve releases information',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Handle deployment
  const handleDeploy = async () => {
    if (!selectedService || !deployTag) {
      toast({
        title: 'Missing information',
        description: 'Please select a service and release tag',
        variant: 'destructive',
      });
      return;
    }

    // apps/dashboard/components/releases-list.tsx (continued)
    try {
        setDeploying(true);
        await onDeployRelease(selectedService, deployTag);
        toast({
          title: 'Deployment initiated',
          description: `${selectedService} deployment for ${deployTag} has been started`,
        });
        setDialogOpen(false);
      } catch (error) {
        console.error(error)
        toast({
          title: 'Deployment failed',
          description: `Could not deploy ${selectedService} with tag ${deployTag}`,
          variant: 'destructive',
        });
      } finally {
        setDeploying(false);
      }
    };
  
    // Initial fetch
    useEffect(() => {
      fetchReleases();
    }, []);
  
    // Format date
    const formatDate = (dateString: string) => {
      return new Date(dateString).toLocaleString();
    };
  
    if (loading) {
      return (
        <div className="flex items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2">Loading releases...</span>
        </div>
      );
    }
  
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <GitCommit className="h-5 w-5 mr-2" />
              Release Versions
            </CardTitle>
            <CardDescription>
              List of release versions available for deployment
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Release Tag</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Author</TableHead>
                  <TableHead>Changed Services</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {releases.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-4 text-muted-foreground">
                      No releases found
                    </TableCell>
                  </TableRow>
                ) : (
                  releases.map((release) => (
                    <TableRow key={release.tag}>
                      <TableCell className="font-medium">{release.tag}</TableCell>
                      <TableCell className="flex items-center">
                        <Clock className="h-4 w-4 mr-1 text-muted-foreground" />
                        {formatDate(release.date)}
                      </TableCell>
                      <TableCell className="flex items-center">
                        <User className="h-4 w-4 mr-1 text-muted-foreground" />
                        {release.author}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {Object.entries(release.changes)
                            .filter(([changed]) => changed)
                            .map(([service]) => (
                              <span 
                                key={service}
                                className="inline-flex items-center rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10"
                              >
                                {service}
                              </span>
                            ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Dialog open={dialogOpen && deployTag === release.tag} onOpenChange={(open) => {
                          setDialogOpen(open);
                          if (open) setDeployTag(release.tag);
                        }}>
                          <DialogTrigger asChild>
                            <Button variant="outline" size="sm">
                              <Download className="h-4 w-4 mr-1" />
                              Deploy
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Deploy Release {release.tag}</DialogTitle>
                              <DialogDescription>
                                Select which service you want to deploy from this release.
                              </DialogDescription>
                            </DialogHeader>
                            <div className="py-4">
                              <div className="space-y-4">
                                <div className="space-y-2">
                                  <label htmlFor="service-select" className="text-sm font-medium">
                                    Service to deploy
                                  </label>
                                  <Select value={selectedService} onValueChange={setSelectedService}>
                                    <SelectTrigger id="service-select">
                                      <SelectValue placeholder="Select a service" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {Object.entries(release.changes)
                                        .filter(([service]) => service.startsWith('microservice-'))
                                        .map(([service, changed]) => (
                                          <SelectItem 
                                            key={service} 
                                            value={service}
                                            disabled={!changed}
                                          >
                                            {service} {changed ? '(changed)' : '(no changes)'}
                                          </SelectItem>
                                        ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="space-y-2">
                                  <div className="text-sm font-medium">Commit Message</div>
                                  <div className="text-sm p-2 border rounded-md bg-muted">
                                    {release.message}
                                  </div>
                                </div>
                              </div>
                            </div>
                            <DialogFooter>
                              <Button
                                onClick={handleDeploy}
                                disabled={!selectedService || deploying}
                              >
                                {deploying ? (
                                  <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Deploying...
                                  </>
                                ) : (
                                  'Deploy'
                                )}
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
          <CardFooter className="flex justify-between py-3 bg-muted/50">
            <span className="text-sm text-muted-foreground">
              Total releases: {releases.length}
            </span>
            <Button onClick={fetchReleases} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }