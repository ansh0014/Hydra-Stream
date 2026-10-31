/**
 * Hydra Stream Frontend Configuration
 * Supports both high-fidelity standalone demo mode (zero backend required)
 * and seamless live connection to Hydra Control Plane (Go) & Prometheus.
 */

window.HYDRA_CONFIG = {
  // Mode: 'standalone' (mock simulation) or 'live' (real Go Control Plane API)
  mode: 'standalone',

  // Backend Endpoints
  endpoints: {
    controllerUrl: 'http://127.0.0.1:8080',
    healthPath: '/health',
    topologyPath: '/api/v1/topology',
    routeResolvePath: '/api/v1/route/resolve',
    prometheusUrl: 'http://127.0.0.1:9090',
  },

  // Regional Brokers Registry (matches control-plane/pkg/types)
  regions: {
    india: {
      id: 'broker-india-1',
      name: 'India (Mumbai Central)',
      countryCode: 'IN',
      flag: '🇮🇳',
      lat: 19.0760,
      lng: 72.8777,
      endpoint: '127.0.0.1:9092',
      healthPort: 8081,
      legalPolicy: 'India Domestic (RBI Sovereign Lock)',
      storageEngine: 'Embedded RocksDB (C++17 Engine)',
      baseRTT: 10, // ms
      packetLoss: 0.0,
      status: 'HEALTHY',
      boundTopics: ['upi-transactions', 'orders-india', 'global-telemetry']
    },
    germany: {
      id: 'broker-germany-1',
      name: 'Germany (Frankfurt EU)',
      countryCode: 'DE',
      flag: '🇩🇪',
      lat: 50.1109,
      lng: 8.6821,
      endpoint: '127.0.0.1:9093',
      healthPort: 8082,
      legalPolicy: 'EU GDPR Article 44 Strict Lock',
      storageEngine: 'Embedded RocksDB (C++17 Engine)',
      baseRTT: 85, // ms
      packetLoss: 0.0,
      status: 'HEALTHY',
      boundTopics: ['gdpr-user-audit', 'eu-payments']
    },
    singapore: {
      id: 'broker-singapore-1',
      name: 'Singapore (Changi Hub)',
      countryCode: 'SG',
      flag: '🇸🇬',
      lat: 1.3521,
      lng: 103.8198,
      endpoint: '127.0.0.1:9094',
      healthPort: 8083,
      legalPolicy: 'APAC Open Transit & Cross-Border Fallback',
      storageEngine: 'Embedded RocksDB (C++17 Engine)',
      baseRTT: 40, // ms
      packetLoss: 0.0,
      status: 'HEALTHY',
      boundTopics: ['apac-fx', 'global-telemetry']
    }
  },

  // Topics and Governance Rules (Provectus Kafka-UI style)
  topics: [
    {
      name: 'gdpr-user-audit',
      partitions: 4,
      replicationFactor: 1,
      legalRegion: 'Germany',
      complianceRule: 'EU GDPR Art. 44 (Strict Zero Cross-Border)',
      messagesTotal: 341820,
      ingressRate: 4820,
      status: 'ENFORCED',
      color: 'purple'
    },
    {
      name: 'eu-payments',
      partitions: 4,
      replicationFactor: 1,
      legalRegion: 'Germany',
      complianceRule: 'EU PSD2 & GDPR Financial Isolation',
      messagesTotal: 894102,
      ingressRate: 11200,
      status: 'ENFORCED',
      color: 'purple'
    },
    {
      name: 'upi-transactions',
      partitions: 4,
      replicationFactor: 1,
      legalRegion: 'India',
      complianceRule: 'RBI Sovereign Data Localization Directive',
      messagesTotal: 1420890,
      ingressRate: 38400,
      status: 'ENFORCED',
      color: 'emerald'
    },
    {
      name: 'apac-fx',
      partitions: 4,
      replicationFactor: 1,
      legalRegion: 'Singapore',
      complianceRule: 'APAC Cross-Border Low-Latency Transit',
      messagesTotal: 651200,
      ingressRate: 9800,
      status: 'OPTIMIZED',
      color: 'cyan'
    },
    {
      name: 'global-telemetry',
      partitions: 6,
      replicationFactor: 3,
      legalRegion: 'ANY',
      complianceRule: 'Adaptive Fast-Path Rerouting (Undersea Cut Bypass)',
      messagesTotal: 4891040,
      ingressRate: 245000,
      status: 'ADAPTIVE',
      color: 'sky'
    }
  ],

  // Invariant Benchmarks (for enterprise verification)
  benchmarks: {
    ringBufferP50Ns: 200,
    ringBufferThroughput: 3891050,
    pipelineP50Us: 6.8,
    pipelineP99Us: 65.7,
    pipelineThroughput: 309597,
    failoverSlaMs: 250,
    dataLossPercentage: 0.000
  }
};

