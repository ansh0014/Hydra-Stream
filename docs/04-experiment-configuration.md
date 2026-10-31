# 04 — Experiment Configuration

## 1. Goals

The YAML format describes the experiment, not implementation details. It should be versioned, validated before any destructive action and stable enough to save alongside results.

## 2. Example scenario

```yaml
schema_version: 1

experiment:
  name: broker-crash-recovery
  seed: 12345
  duration: 300s
  tags: [cluster, recovery, mvp]

cluster:
  provider: docker-compose
  compose_file: deploy/compose/docker-compose.yml
  expected_brokers:
    - broker-a
    - broker-b
    - broker-c
  require_disposable_environment: true

workload:
  producers:
    count: 10
    target_rate_per_second: 500
  consumers:
    count: 5
    processing_delay: 5ms
  message:
    size_bytes: 1024
    key_distribution: uniform
  traffic:
    pattern: constant

faults:
  - id: stop-broker-b
    at: 60s
    type: broker_stop
    target: broker-b

  - id: start-broker-b
    at: 100s
    type: broker_start
    target: broker-b

metrics:
  sample_interval: 1s
  latency_percentiles: [50, 95, 99]

assertions:
  - id: offsets-monotonic
    type: partition_offsets_monotonic
    enabled: true

output:
  directory: results
  formats: [json, jsonl, markdown]
```

This is a proposed initial format. It is not yet a committed schema.

## 3. Configuration sections

### `schema_version`

Required integer. Reject unknown major schema versions.

### `experiment`

- `name`: human-readable scenario name.
- `seed`: deterministic seed for pseudo-random workload inputs.
- `duration`: positive duration.
- `tags`: optional labels.

A fixed seed reproduces random inputs and scheduling choices, not operating-system thread scheduling or network timing.

### `cluster`

- `provider`: initially `docker-compose`.
- `compose_file`: explicit compose file.
- `expected_brokers`: expected broker service identities.
- `require_disposable_environment`: must be true for destructive fault actions.

### `workload`

- Producer and consumer counts must be positive and bounded.
- Target rate must be non-negative and within configured safety limits.
- Message size must not exceed broker protocol limits.
- Processing delay is optional.
- Traffic pattern must be from a supported enum.

### `faults`

Each fault has a unique ID, experiment-relative time, supported type and target. Validate every target against the discovered simulator-owned cluster before applying any fault.

### `metrics`

Defines sample interval and percentile outputs. Percentiles are computed from latency samples or a documented histogram representation, not by averaging per-worker percentiles.

### `assertions`

Assertions must declare their required observations and capability prerequisites. Unsupported assertions are reported as `SKIPPED_UNSUPPORTED`, not silently passed.

## 4. Validation rules

Reject a configuration if:

- Required fields are missing.
- Duration or intervals are invalid.
- Producer/consumer counts exceed safety limits.
- A message exceeds the broker's advertised maximum.
- Fault IDs are duplicated.
- Fault targets are not expected broker IDs.
- Fault time is outside the experiment duration.
- A destructive fault targets an environment not positively identified as disposable.
- A required capability is unavailable.
- An assertion cannot obtain the observations it requires.

## 5. Runtime configuration

The controller should translate validated YAML into a versioned runtime JSON file for the C++ workload process. Do not make the C++ process independently interpret the entire experiment YAML in the MVP.

## 6. Configuration archival

Copy the exact validated scenario into the run directory. Also save:

- Normalized configuration.
- Configuration hash.
- Simulator version.
- Broker build/commit identifier when available.
- Docker image identifiers.
- Host and resource metadata.
