# 07 — Observability, Metrics & Event Ledger

## 1. Observability Goals

Measuring geo-distributed streaming systems requires observability across three dimensions:
1. **Application Latency**: Client produce latency, fetch latency, and end-to-end processing times.
2. **Inter-Region Network Health**: Round-trip time (RTT), jitter, and packet drop rates tracked via **Prometheus**.
3. **Data Residency Compliance**: Real-time auditing of which broker jurisdictions handle which topics.

---

## 2. Cross-Region Metric Categories

### 2.1 Prometheus Inter-Region Network Metrics
* `hydra_link_rtt_seconds{source="India", target="Germany"}`: Scraped by Prometheus to detect slow links.
* `hydra_link_packet_loss_ratio{source="India", target="Germany"}`: Injected loss indicator.
* `hydra_route_status{source="India", target="Germany"}`: State enum (`0=HEALTHY`, `1=DEGRADED`, `2=OFFLINE`).

### 2.2 Broker In-Memory Health Metrics
* `hydra_broker_queue_depth{region="Germany"}`: Current in-memory queue size (bounded memory).
* `hydra_broker_backpressure_active{region="Germany"}`: 1 if condition variable `not_full` is blocking producers.
* `hydra_broker_produced_total{region="India"}`: Total produced messages.
* `hydra_broker_consumed_total{region="India"}`: Total consumed messages.

---

## 3. Structured Event Envelope (`events.jsonl`)

Every action taken by producers, consumers, and the fault injector emits a versioned JSONL event:

```json
{
  "schema_version": 1,
  "run_id": "exp-geo-001",
  "event_id": "evt-00042",
  "source": "producer-de-1",
  "event_type": "produce.acknowledged",
  "wall_time": "2026-10-31T14:30:00.125Z",
  "elapsed_ns": 4500000000,
  "attributes": {
    "topic": "eu-medical",
    "legal_region": "Germany",
    "actual_broker_region": "Germany",
    "sequence_number": 105,
    "assigned_offset": 5041,
    "latency_ns": 4200000
  }
}
```

---

## 4. Run Artifact Layout

At the conclusion of an experiment, all outputs are consolidated in `results/<run-id>/`:

```text
results/<run-id>/
├── scenario.normalized.yaml    # Normalized YAML scenario definition
├── metadata.json               # Environment & build metadata
├── events.jsonl                # Full streaming event ledger
├── prometheus_metrics.json     # Inter-region RTT & loss timeseries
├── assertions.json             # Correctness Oracle invariant results
├── report.json                 # Machine-readable output (P50/P95/P99, throughput)
└── report.md                   # Human-readable executive summary
```
