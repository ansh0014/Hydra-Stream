/**
 * Hydra Stream - Real API Client
 * Connects directly to the Hydra Control Plane & Prometheus.
 * Zero hardcoded mock states.
 */

export const API_BASE = '/api/v1';

export const REGION_METADATA = {
  india: {
    name: 'India (Mumbai Central)',
    flag: '🇮🇳',
    lat: 19.0760,
    lng: 72.8777,
    policy: 'India Domestic (RBI Sovereign Lock)',
    storage: 'Embedded RocksDB (C++17)',
  },
  germany: {
    name: 'Germany (Frankfurt EU)',
    flag: '🇩🇪',
    lat: 50.1109,
    lng: 8.6821,
    policy: 'EU GDPR Article 44 Strict Lock',
    storage: 'Embedded RocksDB (C++17)',
  },
  singapore: {
    name: 'Singapore (Changi Hub)',
    flag: '🇸🇬',
    lat: 1.3521,
    lng: 103.8198,
    policy: 'APAC Open Transit & Cross-Border Fallback',
    storage: 'Embedded RocksDB (C++17)',
  },
};

// Declared Governance Topics matching Hydra Policy Engine
export const CLUSTER_TOPICS = [
  {
    name: 'gdpr-user-audit',
    partitions: 4,
    legalRegion: 'Germany',
    compliance: 'EU GDPR Art. 44 (Strict Zero Cross-Border)',
    color: 'purple',
  },
  {
    name: 'eu-payments',
    partitions: 4,
    legalRegion: 'Germany',
    compliance: 'EU PSD2 & GDPR Financial Isolation',
    color: 'purple',
  },
  {
    name: 'upi-transactions',
    partitions: 4,
    legalRegion: 'India',
    compliance: 'RBI Sovereign Data Localization Directive',
    color: 'emerald',
  },
  {
    name: 'apac-fx',
    partitions: 4,
    legalRegion: 'Singapore',
    compliance: 'APAC Cross-Border Low-Latency Transit',
    color: 'cyan',
  },
  {
    name: 'global-telemetry',
    partitions: 6,
    legalRegion: 'ANY',
    compliance: 'Adaptive Fast-Path Rerouting (Undersea Cut Bypass)',
    color: 'sky',
  },
];

/**
 * Fetch live cluster topology registered dynamically in etcd.
 */
export async function fetchTopology() {
  const res = await fetch(`${API_BASE}/topology`);
  if (!res.ok) {
    throw new Error(`Failed to fetch topology: ${res.statusText}`);
  }
  return await res.json();
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
 * Check cluster health from control plane.
 */
export async function fetchHealth() {
  const res = await fetch('/health');
  return await res.json();
}
