# 01 — Proposed Solution

## 1. Solution Architecture & Component Stack

Hydra Stream adopts a modern distributed systems architecture that separates control logic, service discovery, traffic steering, and message execution.

Instead of writing a bloated monolith, Hydra Stream builds a **specialized Hydra Control Plane in Go** that coordinates battle-tested cloud-native components:

| Layer / Component | Technology Choice | Core Responsibility |
|---|---|---|
| **Broker Engine (Data Plane)** | **Hydra C++ Broker** | High-throughput in-memory bounded queues, thread-pool execution, sequential offset tracking. |
| **Discovery & Registry** | **etcd** | Dynamic broker registration with TTL heartbeats. Zero hardcoded IPs. |
| **Routing & Policy Engine** | **Hydra Control Plane (Go)** | Enforces legal data residency, calculates link quality scores, and steers routes. |
| **Link Observability** | **Prometheus** | Continuously measures cross-region RTT, error rates, and broker health. |
| **Traffic Proxy & Steering** | **Envoy (L4 Proxy)** | Dynamic connection forwarding and outlier ejection based on Control Plane instructions. |
| **Chaos & Verification Subsystem** | **Hydra Simulation Engine** | Injects cross-region slow links, stops regional brokers, and reconciles the correctness ledger. |

---

## 2. Dynamic Discovery Without Hardcoding

```
+---------------------------------------------------------------------------------------+
|                                HYDRA CONTROL PLANE (Go)                               |
|   - Continuously watches /registry/brokers/* in etcd                                  |
|   - Reads RTT & health metrics from Prometheus                                        |
|   - Computes dynamic route weights and residency rules                                |
+---------------------------------------------------------------------------------------+
        ^                                       ^                                   ^
        | (Watch Nodes)                         | (Scrape Metrics)                  | (Push Routes)
        v                                       v                                   v
+------------------+                   +------------------+                +------------------+
|   ETCD REGISTRY  |                   |    PROMETHEUS    |                |    ENVOY PROXY   |
| (Dynamic Leases) |                   | (Latency & Loss) |                | (Dynamic Routes) |
+------------------+                   +------------------+                +------------------+
```

1. **Broker Registration on Boot**:
   Every broker container announces itself on boot to `etcd` with a TTL heartbeat:
   ```json
   {
     "broker_id": "hydra-broker-de-1",
     "region": "Germany",
     "endpoint": "10.0.2.10:9092",
     "status": "UP"
   }
   ```
2. **Automatic Deregistration**:
   If a broker crashes or its network is severed, its `etcd` TTL lease expires within 5 seconds, notifying the Control Plane automatically.

---

## 3. How the 3 Core Capabilities Are Implemented

### 1. Legal Data Residency
* A topic is created with a region constraint: `residency: "Germany"`.
* When a producer requests metadata for this topic, the Hydra Control Plane **filters out all endpoints located outside Germany**.
* If a producer attempts to bypass metadata and directly connect to a broker in India or Singapore, the broker's admission layer rejects the request with `RESIDENCY_VIOLATION`.

### 2. Routing Around Slow Links
* Prometheus scrapes link latencies between regional endpoints.
* The Hydra Control Plane assigns dynamic scores to available paths:
  $$\text{Score} = \frac{1}{\text{RTT (ms)} \times (1 + \text{PacketDropRate})}$$
* When an inter-region link degrades (e.g. latency exceeds 250ms), the Control Plane updates Envoy's dynamic routing table, shifting traffic away from the slow link to an optimal regional path or buffering at local ingress.

### 3. Surviving Regional Outages Without Freezing
* The cluster avoids rigid global quorums.
* Each regional broker maintains autonomous in-memory partition buffers.
* If a region (e.g. Singapore) is disconnected, the surviving regions (India, Germany) continue operating locally without deadlocking.

---

## 4. MVP Scope Definition

### Included in MVP
- **3 Regional Brokers**: `India` (Port 9092), `Germany` (Port 9093), `Singapore` (Port 9094) deployed in Docker.
- **Dynamic Service Registry**: `etcd` container for dynamic registration.
- **Hydra Control Plane (Go)**: Validates region policies and discovers active nodes.
- **Producer / Consumer Client**: Connects via network socket to publish and fetch messages by sequential offset.
- **Simulation Faults**:
  - Stopping a regional broker (Crash test).
  - Injecting simulated latency into a regional link (Slow-link test).
- **Correctness Oracle**: Mathematically verifies that 0 acknowledged messages are lost and 0 Germany messages touch India/Singapore.
