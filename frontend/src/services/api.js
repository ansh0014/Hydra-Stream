/**
 * Hydra Stream - Central State & API Service for React
 * Supports dual-mode: high-fidelity local simulator & live Go Control Plane / Express bridge.
 */

export const INITIAL_REGIONS = {
  india: {
    id: 'broker-india-1',
    name: 'India (Mumbai Central)',
    flag: '🇮🇳',
    lat: 19.0760,
    lng: 72.8777,
    endpoint: '127.0.0.1:9092',
    healthPort: 8081,
    policy: 'India Domestic (RBI Sovereign Lock)',
    storage: 'Embedded RocksDB (C++17)',
    baseRTT: 10,
    rtt: 10,
    packetLoss: 0.0,
    status: 'HEALTHY',
    boundTopics: ['upi-transactions', 'orders-india', 'global-telemetry']
  },
  germany: {
    id: 'broker-germany-1',
    name: 'Germany (Frankfurt EU)',
    flag: '🇩🇪',
    lat: 50.1109,
    lng: 8.6821,
    endpoint: '127.0.0.1:9093',
    healthPort: 8082,
    policy: 'EU GDPR Article 44 Strict Lock',
    storage: 'Embedded RocksDB (C++17)',
    baseRTT: 85,
    rtt: 85,
    packetLoss: 0.0,
    status: 'HEALTHY',
    boundTopics: ['gdpr-user-audit', 'eu-payments']
  },
  singapore: {
    id: 'broker-singapore-1',
    name: 'Singapore (Changi Hub)',
    flag: '🇸🇬',
    lat: 1.3521,
    lng: 103.8198,
    endpoint: '127.0.0.1:9094',
    healthPort: 8083,
    policy: 'APAC Open Transit & Cross-Border Fallback',
    storage: 'Embedded RocksDB (C++17)',
    baseRTT: 40,
    rtt: 40,
    packetLoss: 0.0,
    status: 'HEALTHY',
    boundTopics: ['apac-fx', 'global-telemetry']
  }
};

export const INITIAL_TOPICS = [
  {
    name: 'gdpr-user-audit',
    partitions: 4,
    legalRegion: 'Germany',
    compliance: 'EU GDPR Art. 44 (Strict Zero Cross-Border)',
    messagesTotal: 341820,
    color: 'purple'
  },
  {
    name: 'eu-payments',
    partitions: 4,
    legalRegion: 'Germany',
    compliance: 'EU PSD2 & GDPR Financial Isolation',
    messagesTotal: 894102,
    color: 'purple'
  },
  {
    name: 'upi-transactions',
    partitions: 4,
    legalRegion: 'India',
    compliance: 'RBI Sovereign Data Localization Directive',
    messagesTotal: 1420890,
    color: 'emerald'
  },
  {
    name: 'apac-fx',
    partitions: 4,
    legalRegion: 'Singapore',
    compliance: 'APAC Cross-Border Low-Latency Transit',
    messagesTotal: 651200,
    color: 'cyan'
  },
  {
    name: 'global-telemetry',
    partitions: 6,
    legalRegion: 'ANY',
    compliance: 'Adaptive Fast-Path Rerouting (Undersea Cut Bypass)',
    messagesTotal: 4891040,
    color: 'sky'
  }
];

export const INITIAL_MESSAGES = [
  {
    magic: '0x48445201',
    topic: 'gdpr-user-audit',
    partition: 1,
    offset: 1849101,
    timestamp: '2026-11-01T01:20:00Z',
    key: 'usr_eu_99812',
    payload: JSON.stringify({ userId: 'eu_usr_99812', action: 'EXPORT_REQUEST', consentTimestamp: '2026-11-01T01:20:00Z', legalJurisdiction: 'DE_EU' }, null, 2),
    sizeBytes: 154
  },
  {
    magic: '0x48445201',
    topic: 'eu-payments',
    partition: 0,
    offset: 1849102,
    timestamp: '2026-11-01T01:21:10Z',
    key: 'sepa_88921',
    payload: JSON.stringify({ txnId: 'sepa_8892183', amount: 480.50, currency: 'EUR', ibanMasked: 'DE89...4401', authState: 'SETTLED' }, null, 2),
    sizeBytes: 172
  },
  {
    magic: '0x48445201',
    topic: 'upi-transactions',
    partition: 2,
    offset: 1849103,
    timestamp: '2026-11-01T01:22:45Z',
    key: 'upi_in_8849',
    payload: JSON.stringify({ upiRef: 'upi_in_8849201', vpa: 'user@okhdfcbank', amount: 1500.00, currency: 'INR', status: 'SUCCESS' }, null, 2),
    sizeBytes: 168
  },
  {
    magic: '0x48445201',
    topic: 'global-telemetry',
    partition: 3,
    offset: 1849104,
    timestamp: '2026-11-01T01:23:05Z',
    key: 'edge_node_04',
    payload: JSON.stringify({ sensorId: 'edge_node_04', packetLoss: 0.001, cpuUtil: 34.2, tempC: 48.1, routeBypass: 'NONE' }, null, 2),
    sizeBytes: 142
  }
];

