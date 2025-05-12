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
  version: string | null;
  blue_running: boolean;
  green_running: boolean;
  blue_weight: number;
  green_weight: number;
};

type RefreshingState = {
  [key: string]: boolean;
};

type ServicesStatusProps = {
  onRestartService: (serviceName: string, slot: string) => Promise<void>;
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
      console.error(error);
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
      console.error(error);
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

  // Status badge components
  const Active = <Badge className="bg-green-500">Active</Badge>;
  const Idle = <Badge className="bg-gray-500">Idle</Badge>;
  const Deploying = <Badge className="bg-blue-500">Deploying</Badge>;
  const Failed = <Badge className="bg-red-500">Failed</Badge>;

  // Get status badge
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return Active;
      case 'idle':
        return Idle;
      case 'deploying':
        return Deploying;
      case 'failed':
        return Failed;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin mr-2" />
        <p>Loading services status...</p>
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
      <p className="text-muted-foreground">Current status of all services</p>
      
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {services.map((service) => (
          <Card key={service.service} className="overflow-hidden">
            <CardHeader className="bg-muted">
              <CardTitle>{service.service}</CardTitle>
              <CardDescription>Blue/Green Deployment Status</CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="font-medium mb-2">Blue Slot</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Status:{getStatusBadge(service.blue_slot)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Weight:{service.blue_weight}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Version:{service.version || 'N/A'}</span>
                    </div>
                  </div>
                </div>
                <div>
                  <h3 className="font-medium mb-2">Green Slot</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      Status:{getStatusBadge(service.green_slot)}
                    </div>
                    <div className="flex justify-between">
                      <span>Weight:{service.green_weight}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Version:{service.version || 'N/A'}</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-4">
                <p className="text-sm">
                  Traffic Distribution: <span className="font-medium">
                    Blue {service.blue_weight}% / Green {service.green_weight}%
                  </span>
                </p>
              </div>
            </CardContent>
            <CardFooter className="bg-muted/50 p-4 flex gap-2">
              <Button 
                onClick={() => handleRestartService(service.service, 'blue')}
                disabled={refreshing[`${service.service}-blue`] || service.blue_slot !== 'active'}
                variant="outline"
                className="w-full"
              >
                {refreshing[`${service.service}-blue`] ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Restarting...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Restart Blue
                  </>
                )}
              </Button>
              <Button 
                onClick={() => handleRestartService(service.service, 'green')}
                disabled={refreshing[`${service.service}-green`] || service.green_slot !== 'active'}
                variant="outline"
                className="w-full"
              >
                {refreshing[`${service.service}-green`] ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Restarting...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Restart Green
                  </>
                )}
              </Button>
            </CardFooter>
            <div className="p-4 border-t border-border flex items-center">
              {service.blue_running || service.green_running ? (
                <div className="flex items-center text-green-500">
                  <CheckCircle className="h-4 w-4 mr-2" />
                  <span>Service is available</span>
                </div>
              ) : (
                <div className="flex items-center text-red-500">
                  <AlertCircle className="h-4 w-4 mr-2" />
                  <span>Service is unavailable</span>
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
