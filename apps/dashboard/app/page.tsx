// apps/dashboard/app/page.tsx
'use client';

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { ServicesStatus } from '../components/services-status';
import { ReleasesList } from '../components/releases-list';
import { TrafficControl } from '../components/traffic-control';
import { deployService, updateTrafficDistribution, restartService } from '../services/api';
import { Toaster } from '../components/ui/toaster';
import { GitMerge, Server, Activity } from 'lucide-react';

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<string>('services');

  // Handle service deployment
  const handleDeployRelease = async (serviceName: string, tag: string) => {
    await deployService(serviceName, tag);
  };

  // Handle traffic update
  const handleUpdateTraffic = async (serviceName: string, blueWeight: number, greenWeight: number) => {
    await updateTrafficDistribution(serviceName, blueWeight, greenWeight);
  };

  // Handle service restart
  const handleRestartService = async (serviceName: string, slot: string) => {
    await restartService(serviceName, slot);
  };

  return (
    <div className="container mx-auto p-4 md:p-6">
      <header className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Microservices Management Dashboard</h1>
        <p className="text-muted-foreground">
          Monitor, deploy and control your microservices environment
        </p>
      </header>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid grid-cols-3 md:w-[400px]">
          <TabsTrigger value="services" className="flex items-center">
            <Server className="h-4 w-4 mr-2" />
            Services
          </TabsTrigger>
          <TabsTrigger value="releases" className="flex items-center">
            <GitMerge className="h-4 w-4 mr-2" />
            Releases
          </TabsTrigger>
          <TabsTrigger value="traffic" className="flex items-center">
            <Activity className="h-4 w-4 mr-2" />
            Traffic
          </TabsTrigger>
        </TabsList>

        <TabsContent value="services" className="space-y-6">
          <ServicesStatus onRestartService={handleRestartService} />
        </TabsContent>

        <TabsContent value="releases" className="space-y-6">
          <ReleasesList onDeployRelease={handleDeployRelease} />
        </TabsContent>

        <TabsContent value="traffic" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <TrafficControl onUpdateTraffic={handleUpdateTraffic} />
            <Card>
              <CardHeader>
                <CardTitle>Traffic Distribution Guide</CardTitle>
                <CardDescription>
                  How to use traffic control for effective deployments
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <h3 className="font-medium">Blue/Green Deployment</h3>
                  <p className="text-sm text-muted-foreground">
                    Blue/Green deployment lets you test new versions with minimal risk by 
                    running both old and new versions simultaneously.
                  </p>
                </div>
                <div className="space-y-2">
                  <h3 className="font-medium">Canary Releases</h3>
                  <p className="text-sm text-muted-foreground">
                    Send a percentage of traffic to your new version to gradually validate it 
                    before full deployment.
                  </p>
                </div>
                <div className="space-y-2">
                  <h3 className="font-medium">Common Patterns</h3>
                  <ul className="text-sm text-muted-foreground list-disc ml-5 space-y-1">
                    <li>
                      <strong>Initial Test:</strong> Deploy to inactive slot, send 10% traffic
                    </li>
                    <li>
                      <strong>Validation:</strong> Increase to 50/50 distribution
                    </li>
                    <li>
                      <strong>Full Deployment:</strong> Move to 100% new version
                    </li>
                    <li>
                      <strong>Rollback:</strong> Return to previous version if issues found
                    </li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
      
      <Toaster />
    </div>
  );
}