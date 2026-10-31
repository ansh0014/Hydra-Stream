# 01 — Proposed Solution

## 1. Summary

Implement a **Hybrid Simulation Engine** with two concurrent capabilities:

- **Workload simulation:** producers, consumers, message sizes, rates, traffic patterns and processing delays.
- **Fault simulation:** broker stop/restart first, followed by network and resource faults.

A Go controller owns experiment orchestration. A C++ workload executable generates traffic. Fault adapters control the disposable test cluster. An observation pipeline records events and metrics. A correctness oracle evaluates assertions after and during the experiment.

## 2. MVP scope

### Included

- Three-broker Docker Compose environment.
- YAML experiment configuration.
- Configuration validation.
- C++ producer/consumer workload executable.
- Unique message identities.
- Fixed-seed random workload inputs.
- Constant-rate workload initially; burst and ramp patterns next.
- Go experiment lifecycle and scheduler.
- Broker stop/restart fault.
- Client and broker health observations.
- Latency and throughput measurements.
- JSONL event stream and JSON report.
- Correctness assertions that match implemented broker guarantees.

### Deferred

- `tc netem` latency, jitter and packet loss.
- Network partition and one-way link isolation.
- Disk-full and slow-storage experiments.
- Replication lag and follower catch-up assertions until replication exists.
- Safe automatic leader failover assertions until a sound election/consensus design exists.
- Dashboard and historical comparison UI.
- Kubernetes CronJobs or recurring scheduling.

## 3. Component responsibilities

| Component | Language | Responsibility |
|---|---|---|
| Experiment controller | Go | Parse config, validate, orchestrate lifecycle and schedule events |
| Workload engine | C++ | Generate producer/consumer traffic and client-side observations |
| Fault injector | Go | Apply and recover controlled faults |
| Cluster adapter | Go | Inspect and control the disposable Docker Compose environment |
| Observation collector | Go initially | Receive, validate and persist events and metric samples |
| Correctness oracle | Go initially | Evaluate message, offset and lifecycle assertions |
| Report generator | Go | Produce JSON and Markdown summaries |

The oracle and collector may begin in the same Go module, but should remain separate packages with explicit interfaces.

## 4. Execution model

The controller starts the cluster and observation pipeline, launches the workload process, then schedules fault actions against an experiment-relative monotonic clock.

The workload continues through a fault unless the scenario explicitly defines a stop condition. The controller must not assume the cluster can continue accepting writes after a broker is stopped.

## 5. What constitutes a successful run?

A run is not simply `exit code 0`.

A run has at least three independent outcomes:

- **Execution status:** did the experiment complete its planned lifecycle?
- **Correctness status:** did enabled assertions pass?
- **Performance status:** were measured values within configured thresholds, if thresholds were specified?

A run can complete successfully while a correctness assertion fails. Reports must preserve that distinction.

## 6. Suggested CLI

```text
hydra-sim validate --config scenarios/broker-crash-recovery.yaml
hydra-sim run      --config scenarios/broker-crash-recovery.yaml
hydra-sim report   --run-id <run-id>
hydra-sim list
hydra-sim cleanup  --run-id <run-id>
```

`cleanup` must verify that the target belongs to the simulator's disposable environment before removing containers or networks.
