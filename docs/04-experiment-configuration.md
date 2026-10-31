# 04 — Experiment & Scenario Configuration

## 1. Scenario Schema (`schema_version: 1`)

Experiments in Hydra Stream are defined declaratively in YAML. Scenarios specify cluster topology, regional constraints, traffic generation parameters, and scheduled chaos faults (e.g. slow links, regional blackouts).

---

## 2. Example Multi-Region Scenario

```yaml
schema_version: 1

experiment:
  name: geo-resilience-and-slow-link
  seed: 98765
  duration: 180s
  tags: [cross-region, slow-link, data-residency, outage]

cluster:
  provider: docker-compose
  registry: etcd
  regions:
    - name: India
      expected_brokers: [broker-india-1]
    - name: Germany
      expected_brokers: [broker-germany-1]
      legal_jurisdiction: EU_GDPR
    - name: Singapore
      expected_brokers: [broker-singapore-1]
  require_disposable_environment: true

topics:
  - name: eu-medical-records
    legal_region: Germany
    partitions: 4
  - name: global-telemetry
    legal_region: ANY
    partitions: 6

workload:
  producers:
    count: 6
    target_rate_per_second: 1000
    traffic_pattern: constant
  consumers:
    count: 3
    processing_delay: 2ms
  message:
    size_bytes: 512

faults:
  # 1. Inject a slow link between India and Germany at T=40s
  - id: slow-link-india-germany
    at: 40s
    duration: 30s
    type: network_latency
    source_region: India
    target_region: Germany
    added_latency_ms: 350
    jitter_ms: 25
    packet_loss_percent: 2.0

  # 2. Simulate complete regional power outage in Singapore at T=90s
  - id: outage-singapore
    at: 90s
    duration: 40s
    type: regional_blackout
    target_region: Singapore

metrics:
  sample_interval: 1s
  latency_percentiles: [50, 95, 99]

assertions:
  - id: legal-residency-enforced
    type: legal_data_residency_respected
    target_topic: eu-medical-records
    allowed_region: Germany
    enabled: true

  - id: slow-link-bypassed
    type: route_bypassed_during_degradation
    fault_ref: slow-link-india-germany
    enabled: true

  - id: cluster-no-freeze-on-outage
    type: no_cluster_freeze_during_regional_blackout
    fault_ref: outage-singapore
    enabled: true

  - id: offsets-monotonic
    type: partition_offsets_monotonic
    enabled: true

output:
  directory: results
  formats: [json, jsonl, markdown]
```

---

## 3. Schema Rules & Safety Validation

1. **`legal_region` Validation**: Every topic with a restricted legal region must map to a valid declared region in the cluster.
2. **Safety Enforcement**: Destructive actions (like container stops or network latency injection) require `require_disposable_environment: true`.
3. **Monotonic Timing**: Fault triggers use experiment-relative monotonic seconds (`40s`, `90s`), eliminating wall-clock skew issues.
