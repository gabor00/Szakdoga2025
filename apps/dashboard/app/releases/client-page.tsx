"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { RefreshCw } from "lucide-react"
import { type Release } from "./types"
import { ReleaseTable } from "./release-table"
import { DeployDialog } from "./deploy-dialog"
import { fetchReleases } from "./actions"

interface ReleasesClientProps {
  initialReleases: Release[],
  initalPackageData: Record<string, any>
}

export function ReleasesClient({ initialReleases, initalPackageData }: ReleasesClientProps) {
  const [releases, setReleases] = useState<Release[]>(initialReleases)
  const [deployDialogOpen, setDeployDialogOpen] = useState(false)
  const [selectedRelease, setSelectedRelease] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const refreshReleases = async () => {
    setIsLoading(true)
    try {
      const releases = await fetchReleases()
      setReleases(releases)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeploy = (tag: string) => {
    setSelectedRelease(tag)
    setDeployDialogOpen(true)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Available Releases</h1>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-sm">
            Total: {releases.length}
          </Badge>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={refreshReleases} 
            disabled={isLoading}
            className="flex items-center gap-1"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center p-8">
          <p>Loading releases...</p>
        </div>
      ) : releases.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-muted-foreground">No releases found. Create a release on GitHub to get started.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-6">
            <ReleaseTable 
              releases={releases}
              isLoading={isLoading}
              onDeploy={handleDeploy}
            />
          </CardContent>
        </Card>
      )}

      <DeployDialog 
        open={deployDialogOpen}
        onOpenChange={setDeployDialogOpen}
        selectedRelease={selectedRelease}
        packagesData={initalPackageData}
        onSuccess={refreshReleases}
      />
    </div>
  )
}
