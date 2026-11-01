import { BrokerNode, TopicPolicy, RouteDecision, ConsumerGroup } from '../types';

export const API_BASE = '/api/v1';

export const REGION_COORDINATES: Record<string, { lat: number; lng: number; flag: string; name: string }> = {
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
export async function fetchTopology(): Promise<{ brokers: BrokerNode[]; count: number }> {
  const res = await fetch(`${API_BASE}/topology`);
  if (!res.ok) {
    throw new Error(`Failed to fetch topology: ${res.statusText}`);
  }
  return await res.json();
}

/**
 * Fetch live governance topics from the Go Control Plane Policy Engine.
 */
export async function fetchTopics(): Promise<any[]> {
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
export async function resolveRoute(topic: string, clientRegion = 'India'): Promise<RouteDecision> {
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
export async function fetchHealth(): Promise<{ status: string; bridge: string; controlPlane?: any }> {
  const res = await fetch('/health');
  if (!res.ok) {
    throw new Error(`Health check failed: ${res.statusText}`);
  }
  return await res.json();
}

/**
 * Query Prometheus live metrics.
 */
export async function fetchLatencyMetrics(): Promise<any> {
  const res = await fetch(`${API_BASE}/metrics/latency`);
  if (!res.ok) {
    throw new Error(`Metrics failed: ${res.statusText}`);
  }
  return await res.json();
}

/**
 * Query Go Control Plane cluster supervisor metrics.
 */
export async function fetchClusterSupervisorMetrics(): Promise<{
  active_brokers: number;
  healthy_brokers: number;
  degraded_brokers: number;
  etcd_connected: boolean;
  prom_connected: boolean;
  timestamp: string;
}> {
  const res = await fetch(`${API_BASE}/metrics`);
  if (!res.ok) {
    throw new Error(`Cluster metrics failed: ${res.statusText}`);
  }
  return await res.json();
}

