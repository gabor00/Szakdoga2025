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
  [key: string]: boolean;
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
  onDeployRelease: (_serviceName: string, _tag: string) => Promise<any>;
};

export function ReleasesList({ onDeployRelease }: ReleasesListProps) {
  const [releases, setReleases] = useState<Release[]>([]);
  const [loading, setLoading] = useState(true);
  const [deploying, setDeploying] = useState(false);
  const [selectedService, setSelectedService] = useState('');
  const [deployTag, setDeployTag] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);

  // Fetch releases
  const fetchReleases = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:8100/releases');
      const data = await response.json();
      setReleases(Array.isArray(data) ? data : []);
    } catch (error) {
      setReleases([]);
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
      <div className="flex justify-center items-center p-8">
        <Loader2 className="h-8 w-8 animate-spin mr-2" />
        <span>Loading releases...</span>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Release Versions</CardTitle>
        <CardDescription>List of release versions available for deployment</CardDescription>
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
                <TableCell colSpan={5} className="text-center">No releases found</TableCell>
              </TableRow>
            ) : (
              releases.map((release) => (
                <TableRow key={release.tag}>
                  <TableCell className="font-medium">{release.tag}</TableCell>
                  <TableCell>{formatDate(release.date)}</TableCell>
                  <TableCell>{release.author}</TableCell>
                  <TableCell>
                    {Object.entries(release.changes)
                      .filter(([, changed]) => changed)
                      .map(([service]) => (
                        <span key={service} className="inline-block bg-blue-100 text-blue-800 rounded-full px-2 py-1 text-xs font-semibold mr-1 mb-1">
                          {service}
                        </span>
                      ))}
                  </TableCell>
                  <TableCell>
                    <Dialog open={dialogOpen && deployTag === release.tag} onOpenChange={(open) => {
                      setDialogOpen(open);
                      if (open) setDeployTag(release.tag);
                    }}>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm">Deploy</Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Deploy Release {release.tag}</DialogTitle>
                          <DialogDescription>
                            Select which service you want to deploy from this release.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="py-4">
                          <div className="mb-4">
                            <label className="text-sm font-medium">Service to deploy</label>
                            <Select onValueChange={setSelectedService}>
                              <SelectTrigger>
                                <SelectValue placeholder="Select service" />
                              </SelectTrigger>
                              <SelectContent>
                                {Object.entries(release.changes)
                                  .map(([service, changed]) => (
                                    <SelectItem key={service} value={service}>
                                      {service} {changed ? '(changed)' : '(no changes)'}
                                    </SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <label className="text-sm font-medium">Commit Message</label>
                            <p className="mt-1 text-sm border p-2 rounded bg-gray-50">{release.message}</p>
                          </div>
                        </div>
                        <DialogFooter>
                          <Button onClick={handleDeploy} disabled={deploying}>
                            {deploying ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
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
      <CardFooter className="flex justify-between">
        <div>Total releases: {releases.length}</div>
        <Button variant="outline" onClick={fetchReleases}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </CardFooter>
    </Card>
  );
}
