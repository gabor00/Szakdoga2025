"use client"

import { type Release } from "./types"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { GitCommit, Package } from "lucide-react"

interface ReleaseTableProps {
  releases: Release[]
  isLoading: boolean
  onDeploy: (tag: string) => void
}

export function ReleaseTable({ releases, isLoading, onDeploy }: ReleaseTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Release Tag</TableHead>
          <TableHead>Commit</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {releases.map((release) => (
          <TableRow key={release.tag}>
            <TableCell className="font-medium">{release.tag}</TableCell>
            <TableCell>
              <div className="flex items-center gap-2">
                <GitCommit className="h-4 w-4 text-muted-foreground" />
                {release.commit}
              </div>
            </TableCell>
            <TableCell>
              <Button
                onClick={() => onDeploy(release.tag)}
                size="sm"
                disabled={isLoading}
                className="flex items-center gap-2"
              >
                <Package className="h-4 w-4" />
                Deploy
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
