'use client';
// apps/dashboard/components/traffic-control.tsx
import { useState} from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../components/ui/card';
import { Slider } from '../components/ui/slider';
import { Button } from '../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Loader2, BarChart3, ArrowRightLeft } from 'lucide-react';
import { toast } from '../components/ui/use-toast';

// Define types
type TrafficControlProps = {
  onUpdateTraffic: (_serviceName: string, _blueWeight: number, _greenWeight: number) => Promise<any>;
};

export function TrafficControl({ onUpdateTraffic }: TrafficControlProps) {
  const [selectedService, setSelectedService] = useState('microservice1');
  const [blueWeight, setBlueWeight] = useState(100);
  const [updating, setUpdating] = useState(false);

  // Calculate green weight based on blue weight
  const greenWeight = 100 - blueWeight;

  // Handle update traffic
  const handleUpdateTraffic = async () => {
  try {
    setUpdating(true);
    const response = await fetch('http://localhost:8100/slot-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service: selectedService,
        blue_percentage: blueWeight,
        green_percentage: greenWeight
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Failed to update traffic distribution');
    }
    
    const data = await response.json();
    console.log('Response:', data); // Debugging
    
    toast({
      title: 'Traffic updated',
      description: `${selectedService} traffic distribution updated successfully`,
    });
  } catch (error) {
    console.error(error);
    toast({
      title: 'Error updating traffic',
      description: `Failed to update traffic distribution for ${selectedService}`,
      variant: 'destructive',
    });
  } finally {
    setUpdating(false);
  }
};


  // Get color based on weight percentage
  const getWeightColor = (weight: number) => {
    if (weight === 0) return 'text-gray-400';
    if (weight < 30) return 'text-blue-300';
    if (weight < 70) return 'text-blue-500';
    return 'text-blue-700';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Traffic Distribution</CardTitle>
        <CardDescription>Control traffic distribution between blue and green slots</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <div>
            <label className="text-sm font-medium">Service</label>
            <Select value={selectedService} onValueChange={setSelectedService}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="microservice1">microservice-1</SelectItem>
                <SelectItem value="microservice2">microservice-2</SelectItem>
                <SelectItem value="microservice3">microservice-3</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className={`text-center p-4 rounded-lg border ${getWeightColor(blueWeight)}`}>
              <div className="text-sm font-medium">Blue Slot</div>
              <div className="text-2xl font-bold">{blueWeight}%</div>
            </div>
            <div className={`text-center p-4 rounded-lg border ${getWeightColor(greenWeight)}`}>
              <div className="text-sm font-medium">Green Slot</div>
              <div className="text-2xl font-bold">{greenWeight}%</div>
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-gray-500">
              <span>100% Blue</span>
              <span>50/50</span>
              <span>100% Green</span>
            </div>
            <Slider
              value={[blueWeight]}
              min={0}
              max={100}
              step={1}
              onValueChange={(values) => setBlueWeight(values[0])}
            />
          </div>
          
          <div className="flex flex-wrap gap-2 justify-between">
            <Button variant="outline" size="sm" onClick={() => setBlueWeight(100)}>
              All Blue
            </Button>
            <Button variant="outline" size="sm" onClick={() => setBlueWeight(75)}>
              75/25
            </Button>
            <Button variant="outline" size="sm" onClick={() => setBlueWeight(50)}>
              50/50
            </Button>
            <Button variant="outline" size="sm" onClick={() => setBlueWeight(25)}>
              25/75
            </Button>
            <Button variant="outline" size="sm" onClick={() => setBlueWeight(0)}>
              All Green
            </Button>
          </div>
        </div>
      </CardContent>
      <CardFooter>
        <Button className="w-full" onClick={handleUpdateTraffic} disabled={updating}>
          {updating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Updating Traffic...
            </>
          ) : (
            'Apply Traffic Distribution'
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}
