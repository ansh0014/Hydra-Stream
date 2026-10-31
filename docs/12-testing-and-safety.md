# 12 — Testing Strategy & Safety Controls

## 1. Multi-Tier Testing Strategy

Hydra Stream incorporates tests across four verification tiers:

### 1.1 Unit Tests
* **C++ Engine**: Bounded concurrent queue thread-safety, dual condition variable backpressure, thread pool dispatching, and logger queue throughput (`Hydrosync/tests/`).
* **Go Control Plane**: YAML schema validation, dynamic `etcd` discovery parser, and residency policy rules.

### 1.2 Integration Tests
* **Dynamic Registration**: Spin up `etcd` and verify broker nodes in India, Germany, and Singapore register dynamic TTL leases.
* **TCP Wire Protocol**: Verify clients can connect over TCP, push messages, and fetch by sequential offset.
* **Prometheus Scraping**: Ensure Prometheus successfully scrapes health endpoints on ports `8081`, `8082`, `8083`.

### 1.3 Chaos & Fault Tests
* **Slow-Link Injection**: Apply `tc netem` latency between India and Germany; verify the Control Plane dynamically detects the degradation and updates routing weights.
* **Regional Blackout**: Stop the Singapore broker container; verify that India and Germany continue accepting writes without freezing.

### 1.4 Regulatory Compliance & Invariant Verification (Oracle)
* Automated audit verifying that 100% of messages for `legal_region: Germany` were processed strictly within Germany.
* Mathematical verification of zero acknowledged message loss.

---

## 2. Safety & Containment Controls

1. **Disposable Environment Requirement**: All destructive actions (container stops, `tc netem` rules) will fail fast unless `require_disposable_environment: true` is explicitly set in the scenario.
2. **Namespace Isolation**: `tc netem` rules are applied **only** inside specific Docker container network namespaces (`eth0`), never altering host-wide networking.
3. **Automatic Recovery on Abort**: If an experiment is interrupted (`Ctrl+C` / `SIGINT`), the controller intercepts the signal, removes any active `tc` rules, and restores all stopped containers before exiting.
