# 07 — Observability and Metrics

## 1. Goals

Measure both system behavior and simulator health. A benchmark result is invalid or qualified if the workload generator, event collector or metrics pipeline becomes a bottleneck.

## 2. Metric categories

### Workload

- Send attempts per second.
- Successful acknowledgements per second.
- Fetch/delivery rate.
- Processing rate.
- Producer error and timeout rates.
- Consumer error rate.
- In-flight requests.
- Scheduled versus actual send rate.

### Latency

Measure separately:

- Producer request latency.
- Producer acknowledgement latency.
- Consumer fetch latency.
- End-to-end delivery latency, where message timestamps and clock assumptions permit it.
- Processing duration.
- Recovery duration.

Use monotonic timestamps for same-process duration measurements. Cross-process end-to-end latency requires a documented clock-synchronization assumption or a request/response measurement that avoids unsynchronized clock subtraction.

### Broker and cluster

Where available from broker metrics:

- Broker health.
- Request counts and errors.
- Queue depth.
- Consumer lag.
- Disk and memory use.
- Replication offset and lag.
- Partition leader/follower state.

Do not fabricate metrics that the broker does not expose. Missing metrics should be marked unavailable.

### Faults

- Fault scheduled time.
- Fault action start/end.
- Fault recovery start/end.
- Target broker.
- Action outcome.
- Observed health transition.

## 3. Percentiles

Report P50, P95 and P99 from the full sample distribution or a mergeable histogram with documented precision. Never average worker-level percentiles to derive a global percentile.

For high-volume workloads, use a histogram implementation with bounded memory and known error characteristics.

## 4. Event envelope

Proposed JSONL event:

```json
{
  "schema_version": 1,
  "run_id": "exp-2026-0001",
  "event_id": "evt-000001",
  "source": "workload",
  "event_type": "produce.acknowledged",
  "wall_time": "2026-10-31T10:00:00.000Z",
  "elapsed_ns": 1250000000,
  "attributes": {
    "producer_id": 2,
    "sequence_number": 105,
    "partition_id": 0,
    "offset": 9001,
    "latency_ns": 2400000
  }
}
```

Use stable event names and version the envelope. Large payloads must not be copied into event records.

## 5. Run artifact layout

```text
results/
└── <run-id>/
    ├── scenario.original.yaml
    ├── scenario.normalized.yaml
    ├── metadata.json
    ├── events.jsonl
    ├── metrics.json
    ├── assertions.json
    ├── report.json
    └── report.md
```

## 6. Report sections

- Run identity and status.
- Scenario and seed.
- Source/build/environment metadata.
- Cluster topology.
- Workload configuration and achieved rate.
- Fault timeline.
- Throughput and latency.
- Errors and timeouts.
- Broker metrics available.
- Correctness assertion results.
- Generator/collector health.
- Cleanup outcome.
- Limitations and unavailable measurements.

## 7. Measurement integrity

- Record generator saturation and missed send deadlines.
- Bound event queues and expose dropped-event counters.
- If observations are dropped, mark affected assertions inconclusive.
- Record CPU and memory overhead of the simulator where feasible.
- Do not compare runs with materially different environment metadata without calling out the difference.
