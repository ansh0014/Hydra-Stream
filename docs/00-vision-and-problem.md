# 00 — Vision and Problem Statement

## 1. Vision & Core Mission

> **"Build a Kafka-style broker that keeps data inside its legal region, routes around slow links, and survives a regional outage without freezing."**  
> *(Expected Outcome: SDG 9.1 — Resilient Infrastructure)*

Modern event-driven architectures power global digital infrastructure. However, as organizations operate across international borders, existing streaming systems face three severe operational and regulatory obstacles:

1. **Strict Legal Data Residency (GDPR, Digital Personal Data Protection laws)**: Data generated within a jurisdiction (e.g., European Union) must legally stay within permitted borders.
2. **Fragility to Degraded & Slow Network Links**: Transcontinental and cross-datacenter fiber links frequently experience latency spikes, jitter, and packet loss. Traditional static partition routing stalls entire producer pipelines.
3. **Cluster Deadlocks on Regional Outage**: Synchronous cross-region consensus models frequently freeze entire clusters when one region becomes unreachable.

Hydra Stream solves these challenges through a **region-aware, dynamically routed, resilient Kafka-style streaming architecture**.

---

## 2. The Core Problems with Traditional Kafka

### Problem A: Region Blindness & Data Sovereignty Violations
* Kafka clusters have no native understanding of national jurisdictions.
* Partitions are hashed blindly across any available broker (`hash(key) % N`).
* A producer writing EU patient records or financial transactions in Germany can be assigned to a broker in the US or India, resulting in **regulatory violations and heavy legal fines**.

### Problem B: Head-of-Line Blocking on Degraded Links
* In standard Kafka, a topic partition has a single static leader broker.
* If the network link to that leader slows down from 30ms to 400ms:
  * The producer's internal buffer (`RecordAccumulator`) fills up.
  * Memory limits are reached, blocking the producer application entirely.
  * Healthy brokers in other regions sit completely idle while traffic stalls.

### Problem C: Quorum Freezes During Regional Disasters
* Synchronous metadata consensus engines (KRaft / ZooKeeper) require a majority quorum.
* If a primary region fails or network partitioning isolates a region, the surviving nodes often lose quorum and **freeze all read and write traffic**, turning a regional outage into a global service catastrophe.

---

## 3. The 3 Architectural Guarantees of Hydra Stream

| Guarantee | Mechanism | Success Metric |
|---|---|---|
| **1. Legal Data Residency** | Dynamic region tags on brokers and topics. Control Plane validates every route against legal policy. | **0 bytes** of region-locked data ever touch foreign regional brokers. |
| **2. Dynamic Slow-Link Routing** | Real-time link latency tracking. Dynamic score-weighted routing steers traffic around degraded links. | Ingress throughput maintains >80% capacity during a 300ms link latency spike. |
| **3. Non-Freezing Regional Outage Survival** | Regional autonomy and local quorum mode when a remote region goes dark. | Zero cluster lockups or thread deadlocks when an entire region is severed. |

---

## 4. Guiding Principles

1. **Correctness Before Throughput**: Delivering a message to an illegal jurisdiction or losing an acknowledged message is a catastrophic failure.
2. **Leverage Best-of-Breed Infrastructure**: We do not reinvent basic tools. We use **`etcd`** for dynamic discovery, **Prometheus** for metrics, and **Envoy** for dynamic connection proxying.
3. **Decouple the Control Plane from the Data Plane**: The Go Control Plane makes routing and policy decisions; the C++ Hydra Brokers handle high-throughput in-memory message dispatching.
4. **Self-Verifying Chaos Engine**: The platform includes its own built-in simulator that injects link latency and regional blackouts to mathematically verify system behavior.
