const DEFAULT_BASE_URL = "https://baby-log-server-prod.onrender.com/v1/babies";

function getBaseUrl() {
  return import.meta.env.VITE_BABY_LOG_API_URL || DEFAULT_BASE_URL;
}

async function handleResponse(response) {
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed with ${response.status}`);
  }
  return response.json();
}

export async function createBabyProfile(payload) {
  const response = await fetch(`${getBaseUrl()}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
  return handleResponse(response);
}

export async function fetchBabyProfile(babyId) {
  const response = await fetch(`${getBaseUrl()}/${babyId}`);
  return handleResponse(response);
}

export async function addEvents(babyId, events) {
  const response = await fetch(`${getBaseUrl()}/${babyId}/events`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(events)
  });
  return handleResponse(response);
}

export async function fetchEvents(babyId) {
  const response = await fetch(`${getBaseUrl()}/${babyId}/events`);
  return handleResponse(response);
}

export async function fetchHealth() {
  const response = await fetch(`https://baby-log-server-prod.onrender.com/health`);
  return handleResponse(response);
}
