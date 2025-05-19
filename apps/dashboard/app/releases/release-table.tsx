"use client"

import { type Release } from "./types"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
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
          <TableHead>Date</TableHead>
          <TableHead>Commit</TableHead>
          <TableHead>Author</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Changes</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {releases.map((release) => (
          <TableRow key={release.tag}>
            <TableCell className="font-medium">{release.tag}</TableCell>
            <TableCell>{new Date(release.date).toLocaleDateString()}</TableCell>
            <TableCell>
              <div className="flex items-center gap-2">
                <GitCommit className="h-4 w-4 text-muted-foreground" />
                {release.commit}
              </div>
            </TableCell>
            <TableCell>{release.author}</TableCell>
            <TableCell>
              <Badge variant={release.status === "deployed" ? "default" : "outline"}>
                {release.status === "deployed" ? "Deployed" : "Available"}
              </Badge>
            </TableCell>
            <TableCell>
              <div className="flex gap-2">
                {release.changes && release.changes.filter((c) => c.type === "changed").length > 0 && (
                  <Badge variant="default" className="bg-blue-500">
                    {release.changes.filter((c) => c.type === "changed").length} changed
                  </Badge>
                )}
                {release.changes && release.changes.filter((c) => c.type === "unchanged").length > 0 && (
                  <Badge variant="outline">
                    {release.changes.filter((c) => c.type === "unchanged").length} unchanged
                  </Badge>
                )}
              </div>
            </TableCell>
            <TableCell>
              <Button
                onClick={() => onDeploy(release.tag)}
                size="sm"
                disabled={release.status === "deployed" || isLoading}
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
