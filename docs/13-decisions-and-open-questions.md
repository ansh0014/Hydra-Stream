# 13 — Architectural Decisions & Open Questions

## 1. Architectural Decision Records (ADRs)

| ADR ID | Decision | Justification | Status |
|---|---|---|---|
| **ADR-001** | **Use etcd for Dynamic Discovery** | Avoids hardcoding broker IP addresses or ports. Provides automatic lease expiration (heartbeats) on node crash. | **Accepted** |
| **ADR-002** | **Build Hydra Control Plane in Go** | Rapid cloud-native integration with `etcd` and Prometheus client libraries. Keeps control plane decoupled from C++ data plane. | **Accepted** |
| **ADR-003** | **C++ In-Memory Bounded Queues for Broker** | Predictable microsecond latency, zero garbage collection pauses, and built-in condition-variable backpressure. | **Accepted** |
| **ADR-004** | **3-Region Model (India, Germany, Singapore)** | Provides clear demonstration of legal data residency (Germany/EU GDPR) and inter-region slow link steering. | **Accepted** |
| **ADR-005** | **No Third-Party Paid Tools for Chaos/Oracle** | Correctness Oracle and simulation scheduler run 100% locally in Go/C++ without commercial dependencies. | **Accepted** |
| **ADR-006** | **Prometheus for Link Latency Tracking** | Standard time-series scraping for network RTT and broker health metrics. | **Accepted** |

---

## 2. Open Questions & Resolution Status

1. **Q: How does the C++ broker register with etcd?**  
   *Option A*: Direct etcd gRPC / v3 HTTP client inside C++.  
   *Option B (Recommended)*: A small Go sidecar / registration runner that boots alongside the C++ broker in the container.  
   *Decision*: Option B provides the fastest and most reliable etcd v3 lease integration with zero heavy C++ gRPC dependencies.

2. **Q: How are partition offsets assigned when dynamic routing is active?**  
   *Resolution*: Each regional broker assigns monotonic offsets for its local partitions. The Go Control Plane maintains global epoch metadata.
