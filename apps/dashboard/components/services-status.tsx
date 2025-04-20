// apps/dashboard/components/services-status.tsx
import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Loader2, RefreshCw, AlertCircle, CheckCircle } from 'lucide-react';
import { toast } from '../components/ui/use-toast';

// Define types
type SlotStatus = {
  id: string | null;
  status: string;
  image: string | null;
  created: string | null;
};

type ServiceStatus = {
  blue: SlotStatus;
  green: SlotStatus;
};

type ServicesStatusProps = {
  onRestartService: (_serviceName: string, _slot: string) => Promise<void>;
};

export function ServicesStatus({ onRestartService }: ServicesStatusProps) {
  const [services, setServices] = useState<Record<string, ServiceStatus>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<Record<string, boolean>>({});

  // Fetch services status
  const fetchServicesStatus = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/deployment/services');
      const data = await response.json();
      setServices(data);
    } catch (error) {
      console.error(error)
      toast({
        title: 'Error fetching services',
        description: 'Could not retrieve services status',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Handle restart service
  const handleRestartService = async (serviceName: string, slot: string) => {
    try {
      setRefreshing({ ...refreshing, [`${serviceName}-${slot}`]: true });
      await onRestartService(serviceName, slot);
      toast({
        title: 'Service restarted',
        description: `${serviceName} (${slot}) has been restarted successfully`,
      });
      // Refresh services status after restart
      await fetchServicesStatus();
    } catch (error) {
      console.error(error)
      toast({
        title: 'Error restarting service',
        description: `Failed to restart ${serviceName} (${slot})`,
        variant: 'destructive',
      });
    } finally {
      setRefreshing({ ...refreshing, [`${serviceName}-${slot}`]: false });
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchServicesStatus();
    // Set up polling interval (every 10 seconds)
    const interval = setInterval(fetchServicesStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  // Get status badge
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'running':
        return <Badge className="bg-green-500">Running</Badge>;
      case 'exited':
        return <Badge className="bg-red-500">Exited</Badge>;
      case 'not_found':
        return <Badge className="bg-gray-500">Not Found</Badge>;
      default:
        return <Badge className="bg-yellow-500">{status}</Badge>;
    }
  };

  // Extract version from image tag (e.g., "microservice-1:release-1.2" -> "1.2")
  const extractVersion = (imageTag: string | null) => {
    if (!imageTag) return 'N/A';
    const match = imageTag.match(/release-([0-9.]+)/);
    return match ? match[1] : 'Unknown';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2">Loading services status...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Services Status</h2>
        <Button onClick={fetchServicesStatus} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Object.entries(services).map(([serviceName, status]) => (
          <Card key={serviceName} className="overflow-hidden">
            <CardHeader className="bg-muted">
              <CardTitle>{serviceName}</CardTitle>
              <CardDescription>
                Blue/Green Deployment Status
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Tabs defaultValue="blue" className="w-full">
                <TabsList className="w-full grid grid-cols-2">
                  <TabsTrigger value="blue">Blue Slot</TabsTrigger>
                  <TabsTrigger value="green">Green Slot</TabsTrigger>
                </TabsList>
                <TabsContent value="blue" className="p-4 space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="font-medium">Status:</span>
                      {getStatusBadge(status.blue.status)}
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">Version:</span>
                      <span>{extractVersion(status.blue.image)}</span>
                    </div>
                    {status.blue.created && (
                      <div className="flex justify-between">
                        <span className="font-medium">Created:</span>
                        <span>{new Date(status.blue.created).toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                  <Button 
                    onClick={() => handleRestartService(serviceName, 'blue')}
                    disabled={refreshing[`${serviceName}-blue`] || status.blue.status === 'not_found'}
                    variant="outline"
                    className="w-full"
                  >
                    {refreshing[`${serviceName}-blue`] ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Restarting...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Restart
                      </>
                    )}
                  </Button>
                </TabsContent>
                <TabsContent value="green" className="p-4 space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="font-medium">Status:</span>
                      {getStatusBadge(status.green.status)}
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">Version:</span>
                      <span>{extractVersion(status.green.image)}</span>
                    </div>
                    {status.green.created && (
                      <div className="flex justify-between">
                        <span className="font-medium">Created:</span>
                        <span>{new Date(status.green.created).toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                  <Button 
                    onClick={() => handleRestartService(serviceName, 'green')}
                    disabled={refreshing[`${serviceName}-green`] || status.green.status === 'not_found'}
                    variant="outline"
                    className="w-full"
                  >
                    {refreshing[`${serviceName}-green`] ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Restarting...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Restart
                      </>
                    )}
                  </Button>
                </TabsContent>
              </Tabs>
            </CardContent>
            <CardFooter className="bg-muted/50 flex justify-between py-2">
              {status.blue.status === 'running' || status.green.status === 'running' ? (
                <span className="flex items-center text-sm text-green-600">
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Service is available
                </span>
              ) : (
                <span className="flex items-center text-sm text-red-600">
                  <AlertCircle className="h-4 w-4 mr-1" />
                  Service is unavailable
                </span>
              )}
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}