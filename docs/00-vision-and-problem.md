# 00 — Vision and Problem

## 1. Vision

Build a simulation engine that can repeatedly exercise Hydra Stream under controlled workloads and failures, then produce evidence about performance, correctness and recovery.

The goal is not merely to send messages. The goal is to answer questions such as:

- What happens to producer requests when one broker becomes unavailable?
- Does a slow consumer cause bounded backpressure or unbounded memory growth?
- How does throughput and tail latency change during a traffic burst?
- Can acknowledged messages be recovered after a broker restart, according to the configured durability contract?
- How long does a broker take to become healthy again?
- Which guarantees are supported by the current cluster implementation, and which are not yet implemented?

## 2. Problem

Manual testing is insufficient for a distributed broker because results depend on workload shape, timing, topology and failure conditions. A successful happy-path demonstration says little about behavior during overload or failure.

Hydra Stream needs a repeatable test environment that can:

1. Generate controlled traffic.
2. Introduce known faults at known experiment-relative times.
3. Observe client and broker behavior.
4. Verify message and offset invariants.
5. Save enough metadata to reproduce and compare runs.

## 3. Proposed guiding principles

1. **Correctness before performance claims.** A fast run that loses acknowledged messages is not a successful run.
2. **Repeatable inputs.** Save configuration, seed, build identity, topology and fault schedule.
3. **Independent test system.** The simulator must not require Kafka, Redis or another broker to coordinate itself.
4. **External fault control.** Faults are injected from outside the broker process.
5. **Separate generation from verification.** The workload engine creates traffic; the oracle evaluates observations.
6. **Capability-aware assertions.** Never claim replication or failover guarantees that Hydra Stream has not implemented.
7. **Bounded resource use.** Simulator queues, event buffers and in-flight requests need limits.
8. **Safe by default.** Destructive faults are allowed only against explicitly selected disposable test environments.

## 4. Non-goals for the first version

- Kafka protocol compatibility.
- Production chaos engineering against live infrastructure.
- Automatic global multi-region deployment.
- Exactly-once processing claims.
- Consensus or leader election implemented by the simulator.
- A polished dashboard before reliable experiment execution.
- Replacing the broker's own unit and integration tests.

## 5. Success definition

The first meaningful success is an experiment that:

- Starts three independent broker processes in a local test environment.
- Generates producer and consumer traffic through Hydra Stream's supported client interface.
- Stops and restarts a selected broker during the run.
- Captures the fault timeline and client-visible outcomes.
- Produces metrics and a machine-readable report.
- Clearly distinguishes passed, failed, skipped and unsupported assertions.

## 6. Relationship to Hydra Stream

The simulator supports the larger Hydra Stream goals: reproducible load testing, fault injection, latency measurement, crash recovery testing and observable regional resilience. It does not implement broker functionality itself.
