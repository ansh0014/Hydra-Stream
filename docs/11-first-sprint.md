# 11 — First Sprint: Cluster Simulation MVP

## Sprint goal

Run a reproducible workload against three independent Hydra Stream broker processes, stop and restart one broker during the run, collect observations and generate a report.

## Prerequisite: repository inspection

Before coding, inspect the existing repository and record:

- How to build and start one broker.
- Required configuration and environment variables.
- Current listener ports.
- How a client connects.
- Produce/fetch/commit request semantics.
- Whether broker identity is configurable.
- Whether multiple brokers can run independently today.
- Existing tests and metrics.

Do not invent a client protocol or health endpoint. If the current broker cannot run three independent instances yet, first deliver the simulator scaffolding and a clearly labelled cluster-readiness gap.

## Work breakdown

### S1 — Three-broker Docker environment

- Create Compose configuration for broker A/B/C.
- Assign unique broker IDs.
- Give each broker a separate persistent volume.
- Add a dedicated network and project identity.
- Add readiness checks based on real broker behavior.
- Verify independent stop/start.

**Acceptance:** three broker processes start independently and their state can be inspected.

### S2 — Configuration and validation

- Define `schema_version: 1`.
- Parse YAML in Go.
- Validate duration, workload bounds, broker targets and fault schedule.
- Reject unsafe or unknown targets before changing infrastructure.
- Save normalized config into the run directory.

**Acceptance:** valid scenario passes; malformed and unsafe scenarios are rejected without starting faults.

### S3 — C++ workload generator

- Implement Hydra client adapter.
- Implement producer worker pool.
- Implement consumer worker pool.
- Generate stable message IDs.
- Implement constant-rate workload.
- Bound in-flight requests and local event buffers.
- Emit structured events.

**Acceptance:** multiple producers and consumers exchange messages through Hydra's actual client interface.

### S4 — Go controller

- Generate run ID.
- Create artifact directory.
- Validate environment.
- Start/monitor workload process.
- Schedule experiment-relative events.
- Handle cancellation and child process termination.

**Acceptance:** baseline experiment completes and preserves artifacts.

### S5 — Broker stop/restart

- Validate target broker belongs to the simulator Compose project.
- Stop broker at configured time.
- Record action and observed health change.
- Restart same broker.
- Wait for actual broker readiness.
- Recover any active fault during finalization.

**Acceptance:** broker B is stopped and restarted during active workload without touching unrelated containers.

### S6 — Metrics and report

- Count attempted, acknowledged, rejected and unknown producer outcomes.
- Count delivered and processed messages.
- Measure request latency.
- Calculate throughput and error rates.
- Save event timeline and report.
- Mark assertions skipped or inconclusive when observations/capabilities are insufficient.

**Acceptance:** each run produces a machine-readable report with execution, correctness and performance outcomes.

## Proposed first scenario

```yaml
schema_version: 1

experiment:
  name: broker-crash-recovery
  seed: 12345
  duration: 180s

cluster:
  provider: docker-compose
  expected_brokers: [broker-a, broker-b, broker-c]
  require_disposable_environment: true

workload:
  producers:
    count: 10
    target_rate_per_second: 50
  consumers:
    count: 5
  message:
    size_bytes: 1024
  traffic:
    pattern: constant

faults:
  - id: stop-broker-b
    at: 60s
    type: broker_stop
    target: broker-b
  - id: start-broker-b
    at: 90s
    type: broker_start
    target: broker-b

metrics:
  sample_interval: 1s
  latency_percentiles: [50, 95, 99]

output:
  directory: results
  formats: [json, jsonl, markdown]
```

Rates are deliberately conservative starting values and should be tuned after confirming the broker's current capacity.

## Sprint demo

1. Validate the scenario.
2. Start three broker processes.
3. Start producers and consumers.
4. Show live metrics/logs.
5. Stop broker B.
6. Observe errors and cluster behavior.
7. Restart broker B.
8. Wait for readiness.
9. Finish the experiment.
10. Open `report.md` and `report.json`.

## Definition of done

- [ ] Three independent brokers start.
- [ ] Broker identity and storage are isolated.
- [ ] Workload uses the actual Hydra client interface.
- [ ] Multiple producer and consumer workers run.
- [ ] Message IDs are stable and recorded.
- [ ] Controller schedules faults using monotonic elapsed time.
- [ ] Broker stop/restart is scoped to the simulator cluster.
- [ ] Fault and recovery events are recorded.
- [ ] Latency and throughput are measured.
- [ ] Missing observations are not treated as success.
- [ ] Unsupported assertions are marked explicitly.
- [ ] Artifacts are preserved after success and failure.
- [ ] Cleanup does not affect unrelated Docker resources.
