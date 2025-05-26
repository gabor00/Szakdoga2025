import { Suspense } from "react"
import { fetchData, fetchReleases } from "./actions"
import { ReleasesClient } from "./client-page"

export default async function ReleasesPage() {
  const initialReleases = await fetchReleases();
  
  
    const services = ['m1', 'm2', 'm3']
    const results: Record<string, any> = {}
    
    await Promise.all(services.map(async (service) => {
      try {
        const data = await fetchData(service)
        results[service] = data
      } catch (error) {
        console.error(`Error fetching data for ${service}:`, error)
        results[service] = null
      }
    }))

    return (
    <div className="space-y-6">
      <Suspense fallback={
        <div className="text-center p-8">
          <p>Loading releases...</p>
        </div>
      }>
        <ReleasesClient initialReleases={initialReleases} initalPackageData={results}/>

      </Suspense>
    </div>
  ); 
}