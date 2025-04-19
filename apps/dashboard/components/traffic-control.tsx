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
  onUpdateTraffic: (serviceName: string, blueWeight: number, greenWeight: number) => Promise<void>;
};

export function TrafficControl({ onUpdateTraffic }: TrafficControlProps) {
  const [selectedService, setSelectedService] = useState<string>('microservice-1');
  const [blueWeight, setBlueWeight] = useState<number>(100);
  const [updating, setUpdating] = useState<boolean>(false);

  // Calculate green weight based on blue weight
  const greenWeight = 100 - blueWeight;

  // Handle update traffic
  const handleUpdateTraffic = async () => {
    try {
      setUpdating(true);
      await onUpdateTraffic(selectedService, blueWeight, greenWeight);
      toast({
        title: 'Traffic updated',
        description: `${selectedService} traffic distribution updated successfully`,
      });
    } catch (error) {
      console.error(error)
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
        <CardTitle className="flex items-center">
          <BarChart3 className="h-5 w-5 mr-2" />
          Traffic Distribution
        </CardTitle>
        <CardDescription>
          Control traffic distribution between blue and green slots
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <label htmlFor="service-select" className="text-sm font-medium">
            Service
          </label>
          <Select value={selectedService} onValueChange={setSelectedService}>
            <SelectTrigger id="service-select">
              <SelectValue placeholder="Select a service" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="microservice-1">microservice-1</SelectItem>
              <SelectItem value="microservice-2">microservice-2</SelectItem>
              <SelectItem value="microservice-3">microservice-3</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <span className="flex flex-col">
              <span className="text-sm font-medium">Blue Slot</span>
              <span className={`text-2xl font-bold ${getWeightColor(blueWeight)}`}>
                {blueWeight}%
              </span>
            </span>
            <ArrowRightLeft className="h-5 w-5 text-muted-foreground" />
            <span className="flex flex-col items-end">
              <span className="text-sm font-medium">Green Slot</span>
              <span className={`text-2xl font-bold ${getWeightColor(greenWeight)}`}>
                {greenWeight}%
              </span>
            </span>
          </div>

          <Slider
            sliderdefaultValue={[blueWeight]}
            max={100}
            step={10}
            onValueChange={(values) => setBlueWeight(values[0])}
          />

          <div className="flex justify-between text-xs text-muted-foreground">
            <span>100% Blue</span>
            <span>50/50</span>
            <span>100% Green</span>
          </div>

          <div className="grid grid-cols-5 gap-2 mt-4">
            <Button
              variant={blueWeight === 100 ? "default" : "outline"}
              className="text-xs"
              onClick={() => setBlueWeight(100)}
            >
              All Blue
            </Button>
            <Button
              variant={blueWeight === 75 ? "default" : "outline"}
              className="text-xs"
              onClick={() => setBlueWeight(75)}
            >
              75/25
            </Button>
            <Button
              variant={blueWeight === 50 ? "default" : "outline"}
              className="text-xs"
              onClick={() => setBlueWeight(50)}
            >
              50/50
            </Button>
            <Button
              variant={blueWeight === 25 ? "default" : "outline"}
              className="text-xs"
              onClick={() => setBlueWeight(25)}
            >
              25/75
            </Button>
            <Button
              variant={blueWeight === 0 ? "default" : "outline"}
              className="text-xs"
              onClick={() => setBlueWeight(0)}
            >
              All Green
            </Button>
          </div>
        </div>
      </CardContent>
      <CardFooter>
        <Button 
          className="w-full"
          onClick={handleUpdateTraffic}
          disabled={updating}
        >
          {updating ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
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