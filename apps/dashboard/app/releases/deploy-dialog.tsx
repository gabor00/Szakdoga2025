"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { deployRelease} from "./actions"

interface DeployDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedRelease: string | null
  onSuccess: () => void
  packagesData: Record<string, any>
}

export function DeployDialog({ open, onOpenChange, selectedRelease, onSuccess, packagesData }: DeployDialogProps) {
  const [selectedSlot, setSelectedSlot] = useState("slot-a")
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingData, setIsLoadingData] = useState(false)
  const [availableServices, setAvailableServices] = useState<string[]>([])
  const [selectedServices, setSelectedServices] = useState({
    microservice1: true,
    microservice2: true,
    microservice3: true
  })

  useEffect(() => {
    if (open && selectedRelease) {
      setIsLoadingData(true)
        try {  
          const available = Object.entries(packagesData)
            .filter(([_, data]) => data && data.some((pkg: any) => pkg.metadata.container.tags[0] == selectedRelease))
            .map(([service]) => {
              if (service === 'm1') return 'microservice1'
              if (service === 'm2') return 'microservice2'
              if (service === 'm3') return 'microservice3'
              return service
            })
          
          setAvailableServices(available)
          
          setSelectedServices({
            microservice1: available.includes('microservice1'),
            microservice2: available.includes('microservice2'),
            microservice3: available.includes('microservice3')
          })
        }finally {
          setIsLoadingData(false)
        }
    }
  }, [open, selectedRelease, packagesData])

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
      alert("Válassz ki legalább egy microservice-t a deploy-hoz.")
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
      
      alert(`A deployment elkezdődött: ${servicesToDeploy.join(', ')}`)
      onOpenChange(false)
      onSuccess()
    } catch (error) {
      console.error('Hiba a deployment közben:', error)
      alert('Hiba a deployment közben. Kérlek próbáld újra később.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Deploy Release</DialogTitle>
          <DialogDescription>
            A {selectedRelease} fogod deployolni.
          </DialogDescription>
        </DialogHeader>
        
        {isLoadingData && (
          <div className="flex justify-center py-4">
            <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full"></div>
            <span className="ml-2">Checking available packages...</span>
          </div>
        )}
        
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <div className="col-span-4">
              <label htmlFor="slot" className="text-sm font-medium mb-2 block">
                Válaszd ki melyik deployment slot-ra szeretnéd deploy-olni a csomagot
              </label>
              <Select
                value={selectedSlot}
                onValueChange={setSelectedSlot}
                disabled={isLoading || isLoadingData}
              >
                <SelectTrigger id="slot">
                  <SelectValue placeholder="Select slot" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="slot-a">Slot Blue</SelectItem>
                  <SelectItem value="slot-b">Slot Green</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="col-span-4">
            <label className="text-sm font-medium mb-2 block">
              Válaszd ki melyik microservice-re szeretnéd deploy-olni a csomagot
            </label>
            
            {availableServices.length === 0 && !isLoadingData && (
              <div className="py-2 text-sm text-red-500">
                Egyik service-re se elérhető ez a csomag.
              </div>
            )}
            
            {availableServices.length > 0 && !isLoadingData && (
              <div className="py-2 text-sm text-green-500">
                {availableServices.length} service(-ek)-re elérhető ez a csomag.
              </div>
            )}
            
            <div className="space-y-2 mt-2">
              {Object.entries({
                microservice1: "Microservice 1 (m1)",
                microservice2: "Microservice 2 (m2)",
                microservice3: "Microservice 3 (m3)"
              }).map(([service, label]) => (
                <div key={service} className="flex items-center space-x-2">
                  <Checkbox 
                    id={service} 
                    checked={selectedServices[service as keyof typeof selectedServices]} 
                    disabled={!availableServices.includes(service) || isLoadingData || isLoading}
                    onCheckedChange={(checked) => 
                      handleServiceCheckboxChange(service, checked as boolean)
                    }
                  />
                  <label 
                    htmlFor={service} 
                    className={`text-sm font-medium leading-none peer-disabled:cursor-not-allowed ${
                      availableServices.includes(service) ? 'text-primary' : 'text-muted-foreground opacity-70'
                    }`}
                  >
                    {label}
                    {!availableServices.includes(service) && 
                      <span className="ml-2 text-xs text-red-500">(Version not available)</span>
                    }
                    {availableServices.includes(service) && 
                      <span className="ml-2 text-xs text-green-500">(✓ Available)</span>
                    }
                  </label>
                </div>
              ))}
            </div>
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading || isLoadingData}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={isLoading}>
            {isLoading ? "Deploying..." : `Deploy a ${selectedSlot === "slot-a" ? "Slot Blue" : "Slot Green"}-en`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
