import { Suspense } from "react"
import { fetchReleases } from "./actions"
import { ReleasesClient } from "./client-page"

export default async function ReleasesPage() {
  const initialReleases = await fetchReleases();

    return (
    <div className="space-y-6">
      <Suspense fallback={
        <div className="text-center p-8">
          <p>Loading releases...</p>
        </div>
      }>
        <ReleasesClient initialReleases={initialReleases} />
      </Suspense>
    </div>
  ); 
}