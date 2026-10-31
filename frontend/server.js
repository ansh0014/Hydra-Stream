import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Serve static React build from dist
app.use(express.static(path.join(__dirname, 'dist')));

// In-Memory Cluster Simulation State
let clusterState = {
  health: 'HEALTHY',
  brokers: [
    {
      id: 'broker-india-1',
      region: 'India',
      endpoint: '127.0.0.1:9092',
      health_port: 8081,
      status: 'HEALTHY',
      rtt: 10,
      packet_loss: 0.0,
      bound_topics: ['upi-transactions', 'orders-india', 'global-telemetry'],
    },
    {
      id: 'broker-germany-1',
      region: 'Germany',
      endpoint: '127.0.0.1:9093',
      health_port: 8082,
      status: 'HEALTHY',
      rtt: 85,
      packet_loss: 0.0,
      bound_topics: ['gdpr-user-audit', 'eu-payments'],
    },
    {
      id: 'broker-singapore-1',
      region: 'Singapore',
      endpoint: '127.0.0.1:9094',
      health_port: 8083,
      status: 'HEALTHY',
      rtt: 40,
      packet_loss: 0.0,
      bound_topics: ['apac-fx', 'global-telemetry'],
    },
  ],
  topics: [
    { name: 'gdpr-user-audit', partitions: 4, legal_region: 'Germany', compliance: 'EU GDPR Art. 44' },
    { name: 'eu-payments', partitions: 4, legal_region: 'Germany', compliance: 'EU PSD2 & GDPR' },
    { name: 'upi-transactions', partitions: 4, legal_region: 'India', compliance: 'RBI Domestic Lock' },
    { name: 'apac-fx', partitions: 4, legal_region: 'Singapore', compliance: 'APAC Open Transit' },
    { name: 'global-telemetry', partitions: 6, legal_region: 'ANY', compliance: 'Dynamic Reroute' },
  ],
  throughput: 309597,
  gdprViolationsPrevented: 0,
};

// 1. Health Probe
app.get('/health', (req, res) => {
  res.json({
    status: 'UP',
    service: 'hydra-express-bridge',
    version: '1.2.0',
    clusterHealth: clusterState.health,
  });
});

// 2. Topology Discovery
app.get('/api/v1/topology', (req, res) => {
  res.json({
    brokers: clusterState.brokers,
    count: clusterState.brokers.length,
    timestamp: new Date().toISOString(),
  });
});

// 3. Topics
app.get('/api/v1/topics', (req, res) => {
  res.json({
    topics: clusterState.topics,
    count: clusterState.topics.length,
  });
});

// 4. Route Resolve (Mirrors Go Control Plane)
app.post('/api/v1/route/resolve', (req, res) => {
  const { topic, client_region } = req.body;
  if (!topic) {
    return res.status(400).json({ error: 'Missing topic' });
  }

  const topicDef = clusterState.topics.find((t) => t.name === topic);
  if (!topicDef) {
    return res.status(404).json({ error: `Topic '${topic}' not found` });
  }

  // Legal Residency Check
  if (topicDef.legal_region !== 'ANY') {
    const targetBroker = clusterState.brokers.find((b) => b.region.toLowerCase() === topicDef.legal_region.toLowerCase());
    if (!targetBroker || targetBroker.status === 'OFFLINE') {
      clusterState.gdprViolationsPrevented++;
      return res.status(403).json({
        error: `403 Forbidden: Regional node for ${topicDef.legal_region} is offline. Cross-border spillover strictly rejected under EU GDPR Art. 44.`,
        residencyViolationBlocked: true,
      });
    }

    const score = 1000.0 / (targetBroker.rtt * (1.0 + targetBroker.packet_loss) + 1.0);
    return res.json({
      topic,
      assigned_broker_id: targetBroker.id,
      assigned_endpoint: targetBroker.endpoint,
      region: targetBroker.region,
      score,
      is_bypassing_slow_link: false,
      reason: `Enforced by Legal Residency Policy (${topicDef.compliance})`,
    });
  }

  // Global Optimization
  const healthy = clusterState.brokers.filter((b) => b.status !== 'OFFLINE');
  let best = healthy[0];
  let bestScore = -1;

  for (const b of healthy) {
    const s = 1000.0 / (b.rtt * (1.0 + b.packet_loss) + 1.0);
    if (s > bestScore) {
      bestScore = s;
      best = b;
    }
  }

  const isBypassing = best && best.id === 'broker-singapore-1' && clusterState.brokers.find((b) => b.id === 'broker-india-1')?.status === 'DEGRADED';

  res.json({
    topic,
    assigned_broker_id: best ? best.id : 'none',
    assigned_endpoint: best ? best.endpoint : 'none',
    region: best ? best.region : 'none',
    score: bestScore,
    is_bypassing_slow_link: isBypassing,
    reason: isBypassing ? 'Adaptive Route Selector: Bypassed degraded undersea link' : 'Lowest latency path selected',
  });
});

// 5. Chaos Injections
app.post('/api/v1/chaos/inject', (req, res) => {
  const { type } = req.body;
  if (type === 'slow-link') {
    const inBroker = clusterState.brokers.find((b) => b.id === 'broker-india-1');
    if (inBroker) {
      inBroker.rtt = 270;
      inBroker.packet_loss = 0.15;
      inBroker.status = 'DEGRADED';
      clusterState.health = 'DEGRADED';
    }
  } else if (type === 'blackout') {
    const deBroker = clusterState.brokers.find((b) => b.id === 'broker-germany-1');
    if (deBroker) {
      deBroker.status = 'OFFLINE';
      deBroker.rtt = 0;
      deBroker.packet_loss = 1.0;
      clusterState.health = 'LOCAL_QUORUM';
    }
  }
  res.json({ success: true, clusterState });
});

app.post('/api/v1/chaos/restore', (req, res) => {
  clusterState.health = 'HEALTHY';
  clusterState.brokers.forEach((b) => {
    b.status = 'HEALTHY';
    b.packet_loss = 0.0;
    if (b.id === 'broker-india-1') b.rtt = 10;
    if (b.id === 'broker-germany-1') b.rtt = 85;
    if (b.id === 'broker-singapore-1') b.rtt = 40;
  });
  res.json({ success: true, clusterState });
});

// SPA Fallback for any client-side routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`[Hydra Stream] Express Bridge Server running on http://localhost:${PORT}`);
});
