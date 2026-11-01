import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const CONTROLLER_URL = process.env.CONTROLLER_URL || 'http://127.0.0.1:8080';
const PROMETHEUS_URL = process.env.PROMETHEUS_URL || 'http://127.0.0.1:9090';

app.use(cors());
app.use(express.json());

// Serve static React build if dist exists
app.use(express.static(path.join(__dirname, 'dist')));

// 1. Health Probe - Proxies to real Go Control Plane
app.get('/health', async (req, res) => {
  try {
    const response = await fetch(`${CONTROLLER_URL}/health`);
    const data = await response.json();
    res.json({
      status: 'UP',
      bridge: 'hydra-express-proxy',
      controlPlane: data,
    });
  } catch (err) {
    res.status(503).json({
      status: 'DOWN',
      error: `Hydra Control Plane unreachable at ${CONTROLLER_URL}: ${err.message}`,
    });
  }
});

// 2. Topology Discovery - Real dynamic brokers from etcd via Go Control Plane
app.get('/api/v1/topology', async (req, res) => {
  try {
    const response = await fetch(`${CONTROLLER_URL}/cluster/topology`);
    if (!response.ok) {
      return res.status(response.status).json({ error: `Controller error: ${response.statusText}` });
    }
    const data = await response.json();
    res.json({
      brokers: data.brokers || [],
      count: data.count || (data.brokers ? data.brokers.length : 0),
      timestamp: new Date().toISOString(),
      source: 'etcd-discovery',
    });
  } catch (err) {
    res.status(503).json({
      brokers: [],
      count: 0,
      error: `Failed to connect to Hydra Control Plane at ${CONTROLLER_URL}: ${err.message}`,
    });
  }
});

// 3. Dynamic Route Resolution - Real Go Policy & Latency Router
app.post('/api/v1/route/resolve', async (req, res) => {
  try {
    const response = await fetch(`${CONTROLLER_URL}/route/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    res.status(503).json({
      error: `Control Plane routing unavailable: ${err.message}`,
    });
  }
});

// 4. Topics & Policies - Governance topics from Go Control Plane
app.get('/api/v1/topics', async (req, res) => {
  try {
    const response = await fetch(`${CONTROLLER_URL}/api/v1/topics`);
    if (!response.ok) {
      return res.status(response.status).json({ error: `Controller error: ${response.statusText}` });
    }
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(503).json({
      topics: [],
      count: 0,
      error: `Failed to fetch topics from Control Plane: ${err.message}`,
    });
  }
});

// 5. Prometheus Live Link Latency Proxy
app.get('/api/v1/metrics/latency', async (req, res) => {
  const query = req.query.query || 'hydra_broker_ping_rtt_seconds';
  try {
    const response = await fetch(`${PROMETHEUS_URL}/api/v1/query?query=${encodeURIComponent(query)}`);
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(503).json({
      error: `Prometheus unreachable at ${PROMETHEUS_URL}: ${err.message}`,
    });
  }
});

// SPA Fallback for any client-side routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`[Hydra Stream] Express Proxy running on http://localhost:${PORT}`);
  console.log(`[Hydra Stream] Connected to Hydra Control Plane at ${CONTROLLER_URL}`);
  console.log(`[Hydra Stream] Connected to Prometheus at ${PROMETHEUS_URL}`);
});
