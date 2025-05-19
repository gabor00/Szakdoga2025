"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { deployRelease, fetchData, } from "./actions"


interface DeployDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedRelease: string | null
  onSuccess: () => void
}

export function DeployDialog({ open, onOpenChange, selectedRelease, onSuccess }: DeployDialogProps) {
  const [selectedSlot, setSelectedSlot] = useState("slot-a")
  const [isLoading, setIsLoading] = useState(false)
  const [selectedServices, setSelectedServices] = useState({
    microservice1: true,
    microservice2: true,
    microservice3: true
  })

  useEffect(() => {
    fetchData
  }, [])

  const handleServiceCheckboxChange = (service: string, checked: boolean) => {
    setSelectedServices(prev => ({
      ...prev,
      [service]: checked
    }))
  }

  const handleConfirm = async () => {
    if (!selectedRelease) return
    
    const servicesToDeploy = Object.entries(selectedServices)
      .filter(([_, selected]) => selected)
      .map(([service]) => service)
    
    if (servicesToDeploy.length === 0) {
      alert("Please select at least one service")
      return
    }
    
    setIsLoading(true)
    try {
      await Promise.all(
        servicesToDeploy.map(service =>
          deployRelease(
            service,
            selectedRelease,
            selectedSlot === "slot-a" ? "blue" : "green"
          )
        )
      )
      
      alert(`Deployment started for services: ${servicesToDeploy.join(', ')}`)
      onOpenChange(false)
      onSuccess()
    } catch (error) {
      console.error('Error during deployments:', error)
      alert('Error occurred during deployment')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
                <SelectItem value="slot-a">Slot Blue</SelectItem>
                <SelectItem value="slot-b">Slot Green</SelectItem>
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
                  Microservice 1 (m1)
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="microservice2" 
                  checked={selectedServices.microservice2} 
                  onCheckedChange={(checked) => handleServiceCheckboxChange("microservice2", checked as boolean)} 
                />
                <label htmlFor="microservice2" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  Microservice 2 (m2)
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="microservice3" 
                  checked={selectedServices.microservice3} 
                  onCheckedChange={(checked) => handleServiceCheckboxChange("microservice3", checked as boolean)} 
                />
                <label htmlFor="microservice3" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  Microservice 3 (m3)
                </label>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={isLoading}>
            {isLoading ? "Deploying..." : `Deploy to ${selectedSlot === "slot-a" ? "Slot Blue" : "Slot Green"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
