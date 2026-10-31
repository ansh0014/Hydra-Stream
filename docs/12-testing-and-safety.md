# 12 — Testing and Safety

## 1. Test layers

### Unit tests

- YAML parsing and validation.
- Experiment state transitions.
- Scheduler ordering and late-event behavior.
- Message ID generation.
- Rate limiter behavior.
- Histogram calculations.
- Event schema validation.
- Oracle reconciliation.
- Fault registry and recovery bookkeeping.

### Integration tests

- Controller launches workload process.
- Workload connects to broker.
- Producer acknowledgement is observed.
- Consumer delivery is observed.
- Broker stop/start is executed against test cluster.
- Report is generated after normal completion.
- Partial report is generated after failure.

### Stress tests

- High producer count.
- Slow consumer.
- Bounded event queue.
- Collector overload.
- Long-duration workload.
- Controller cancellation during active fault.

### Fault tests

- Broker process killed.
- Broker container stopped.
- Broker restart delayed.
- Fault action fails.
- Recovery action fails.
- Controller exits while fault is active.
- Docker daemon unavailable.

## 2. Simulator safety model

The simulator can disrupt services. Therefore:

- Destructive operations require a disposable test environment.
- The target Compose project must match the run configuration.
- Container labels and expected service names must be checked.
- Never use broad `docker stop $(docker ps ...)` commands.
- Never alter host-wide network configuration in the MVP.
- Never fill the host filesystem.
- Use dedicated test volumes and resource limits.
- Require explicit opt-in for network and storage faults.
- Log every action and its target.

## 3. Cleanup guarantees

The controller tracks:
- Child processes it started.
- Containers it created or explicitly adopted.
- Faults it applied.
- Network rules it installed.
- Temporary files and artifact directories.

Cleanup may only remove resources it can positively identify as owned by the run or simulator project.

## 4. Failure handling

A failed experiment should still preserve:
- Original and normalized scenario.
- Run metadata.
- Events collected so far.
- Fault action history.
- Error details.
- Cleanup result.

Never convert missing data into zero-valued success metrics.

## 5. Reproducibility limits

A fixed seed reproduces random workload choices and generated scenario inputs. It cannot guarantee identical operating-system scheduling, CPU contention, disk timing, network timing or thread interleavings.

Reports should record environment metadata and avoid claiming bit-for-bit deterministic execution.
