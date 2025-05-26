'use server'
export async function fetchTraffic() {
  const response = await fetch(`${process.env.DEPLOYMENT_ENGINE}/traffic`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch traffic data");
  }

  const data = await response.json();
  return data;
}

export async function updateTraffic(service: string, blue_percentage: number, green_percentage: number) {
  return fetch(`${process.env.DEPLOYMENT_ENGINE}/slot-config`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          service: service,
          blue_percentage: blue_percentage,
          green_percentage: green_percentage
        }),
      });
}