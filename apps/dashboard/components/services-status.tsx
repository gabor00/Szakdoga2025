// apps/dashboard/components/services-status.tsx
import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Loader2, RefreshCw, AlertCircle, CheckCircle } from 'lucide-react';
import { toast } from '../components/ui/use-toast';

// Define types
type ServiceStatus = {
  service: string;
  blue_slot: string;
  green_slot: string;
  active_slot: string | null;
  version: string | null;
};

type RefreshingState = {
  [key: string]: boolean;
};

type ServicesStatusProps = {
  onRestartService: (_serviceName: string, _slot: string) => Promise<any>;
};

export function ServicesStatus({ onRestartService }: ServicesStatusProps) {
  const [services, setServices] = useState<ServiceStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState<RefreshingState>({});

  // Fetch services status
  const fetchServicesStatus = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:8100/services');
      const data = await response.json();
      setServices(data.services);
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
      setRefreshing({ ...refreshing, [`szakdoga2025-${serviceName}-${slot}`]: true });
      await fetch(`http://localhost:8100/restart/szakdoga2025-${serviceName}-${slot}`, {
        method: 'POST'
      });
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
      setRefreshing({ ...refreshing, [`szakdoga2025-${serviceName}-${slot}`]: false });
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
      case 'active':
        return <Badge variant="default">Active</Badge>;
      case 'idle':
        return <Badge variant="secondary">Idle</Badge>;
      case 'deploying':
        return <Badge variant="outline">Deploying</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <Loader2 className="h-8 w-8 animate-spin mr-2" />
        <span>Loading services status...</span>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Services Status</CardTitle>
          <CardDescription>Current status of all services</CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={fetchServicesStatus}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </CardHeader>
      <CardContent>
        {services.map((service) => (
          <Card key={service.service} className="mb-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">{service.service}</CardTitle>
              <CardDescription>Blue/Green Deployment Status</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="blue">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="blue">Blue Slot</TabsTrigger>
                  <TabsTrigger value="green">Green Slot</TabsTrigger>
                </TabsList>
                <TabsContent value="blue" className="p-4 border rounded-md mt-2">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="font-medium">Status:</span>
                      <span>{getStatusBadge(service.blue_slot)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">Version:</span>
                      <span>{service.version || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">Active:</span>
                      <span>{service.active_slot === 'blue' ? 'Yes' : 'No'}</span>
                    </div>
                    <Button 
                      onClick={() => handleRestartService(service.service, 'blue')}
                      disabled={refreshing[`${service.service}-blue`] || service.blue_slot !== 'active'}
                      variant="outline"
                      className="w-full"
                    >
                      {refreshing[`${service.service}-blue`] ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Restarting...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="mr-2 h-4 w-4" />
                          Restart
                        </>
                      )}
                    </Button>
                  </div>
                </TabsContent>
                <TabsContent value="green" className="p-4 border rounded-md mt-2">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="font-medium">Status:</span>
                      <span>{getStatusBadge(service.green_slot)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">Version:</span>
                      <span>{service.version || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">Active:</span>
                      <span>{service.active_slot === 'green' ? 'Yes' : 'Nope'}</span>
                    </div>
                    <Button 
                      onClick={() => handleRestartService(service.service, 'green')}
                      disabled={refreshing[`${service.service}-green`] || service.green_slot !== 'active'}
                      variant="outline"
                      className="w-full"
                    >
                      {refreshing[`${service.service}-green`] ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Restarting...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="mr-2 h-4 w-4" />
                          Restart
                        </>
                      )}
                    </Button>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
            <CardFooter>
              {service.blue_slot === 'active' || service.green_slot === 'active' ? (
                <div className="flex items-center text-green-600">
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Service is available
                </div>
              ) : (
                <div className="flex items-center text-red-600">
                  <AlertCircle className="h-4 w-4 mr-2" />
                  Service is unavailable
                </div>
              )}
            </CardFooter>
          </Card>
        ))}
      </CardContent>
    </Card>
  );
}
