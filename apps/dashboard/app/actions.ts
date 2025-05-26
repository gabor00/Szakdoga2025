'use server'
import { ServicesResponse } from "./page";

export async function restartService(service: string, slot: string) {
  let microservice = service;
  let slotName = slot;
  const match = service.match(/^szakdoga2025-(microservice\d+)-(blue|green)$/);
  if (match) {
    microservice = match[1];
    slotName = match[2];
  }
  const response = await fetch(`${process.env.DEPLOYMENT_ENGINE}/restart`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ service: microservice, slot: slotName }),
  });
  if (!response.ok) {
    throw new Error(`Nem sikerült újraindítani: ${microservice} (${slotName})`);
  }
  return response.json();
}

export async function startContainer(service: string, slot: string) {
  let microservice = service;
  let slotName = slot;
  const match = service.match(/^szakdoga2025-(microservice\d+)-(blue|green)$/);
  if (match) {
    microservice = match[1];
    slotName = match[2];
  }
  const response = await fetch(`${process.env.DEPLOYMENT_ENGINE}/start`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ service: microservice, slot: slotName }),
  });
  if (!response.ok) {
    throw new Error(`Nem sikerüt elindítani: ${microservice} (${slotName})`);
  }
  return response.json();
}

export async function stopContainer(service: string, slot: string) {
  let microservice = service;
  let slotName = slot;
  const match = service.match(/^szakdoga2025-(microservice\d+)-(blue|green)$/);
  if (match) {
    microservice = match[1];
    slotName = match[2];
  }
  const response = await fetch(`${process.env.DEPLOYMENT_ENGINE}/stop`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ service: microservice, slot: slotName }),
  });
  if (!response.ok) {
    throw new Error(`Nem sikerült leálítani: ${microservice} (${slotName})`);
  }
  return response.json();
}

export async function fetchServices() {
  const response = await fetch(`${process.env.DEPLOYMENT_ENGINE}/services`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });
  if (!response.ok) {
    throw new Error("Nem sikerült lekérni a szolgáltatásokat");
  }
  return (await response.json()) as ServicesResponse;
}