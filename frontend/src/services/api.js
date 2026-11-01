/**
 * Hydra Stream - Dynamic Real API Client
 * Zero hardcoded mock brokers or fake endpoints.
 * Everything is fetched dynamically from the Go Control Plane, etcd, and Prometheus.
 */

export const API_BASE = '/api/v1';

/**
 * Geographic projection coordinates for rendering nodes on the world map canvas.
 * (Pure visual metadata; node status, endpoints, and health are 100% dynamic from etcd).
 */
export const REGION_COORDINATES = {
  india: {
    lat: 19.0760,
    lng: 72.8777,
    flag: '🇮🇳',
    name: 'India (Mumbai Central)',
  },
  germany: {
    lat: 50.1109,
    lng: 8.6821,
    flag: '🇩🇪',
    name: 'Germany (Frankfurt EU)',
  },
  singapore: {
    lat: 1.3521,
    lng: 103.8198,
    flag: '🇸🇬',
    name: 'Singapore (Changi Hub)',
  },
};

/**
 * Fetch live cluster brokers registered dynamically in etcd.
 */
export async function fetchTopology() {
  const res = await fetch(`${API_BASE}/topology`);
  if (!res.ok) {
    throw new Error(`Failed to fetch topology: ${res.statusText}`);
  }
  return await res.json();
}

/**
 * Fetch live governance topics from the Go Control Plane Policy Engine.
 */
export async function fetchTopics() {
  const res = await fetch(`${API_BASE}/topics`);
  if (!res.ok) {
    throw new Error(`Failed to fetch topics: ${res.statusText}`);
  }
  const data = await res.json();
  return (data && Array.isArray(data.topics)) ? data.topics : [];
}

/**
 * Resolve routing decision and data residency compliance via Go Control Plane.
 */
export async function resolveRoute(topic, clientRegion = 'India') {
  const res = await fetch(`${API_BASE}/route/resolve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topic, client_region: clientRegion }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || `Routing rejected with HTTP ${res.status}`);
  }
  return data;
}

/**
 * Check cluster health from control plane bridge.
 */
export async function fetchHealth() {
  const res = await fetch('/health');
  if (!res.ok) {
    throw new Error(`Health check failed: ${res.statusText}`);
  }
  return await res.json();
}

/**
 * Query Prometheus link latency metric.
 */
export async function fetchLatencyMetrics() {
  const res = await fetch(`${API_BASE}/metrics/latency`);
  if (!res.ok) {
    throw new Error(`Metrics failed: ${res.statusText}`);
  }
  return await res.json();
}
