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
| **ADR-007** | **Storage Strategy: Reject External Databases (Redis/Cassandra)** | External databases introduce unnecessary network hops (1–5ms latency), network bottlenecks, and severe tombstone compaction issues (Cassandra). Message queues remain in-process (RAM Bounded Queues, with embedded RocksDB for persistent disk tiering). Metadata is stored in `etcd`. | **Accepted** |

---

## 2. Deep Dive: Storage Architecture Evaluation (ADR-007)

### Why Not Redis?
* Redis is an in-memory database that offers its own streaming engine (`XADD`/`XREAD`). Placing Redis behind Hydra Stream turns the C++ broker into a redundant proxy and introduces external network roundtrips.

### Why Not Cassandra / ScyllaDB?
* Cassandra is an append-oriented distributed database designed for broad queries, not FIFO message queues.
* As consumers continuously read and dequeue streaming data, Cassandra accumulates millions of delete tombstones, causing compaction stalls, read timeouts, and GC pauses.

### Chosen Tiered Architecture:
1. **Metadata Tier**: `etcd` (Raft consensus, B-tree storage, dynamic node discovery).
2. **Streaming Data Tier**: In-process C++ bounded memory queues (`ConcurrentQueue<Message>`) for nanosecond/microsecond dispatching.
3. **Optional Persistent Tier**: Embedded **RocksDB** (C++ LSM-tree library running in the same process space, zero network hops).

---

## 3. Open Questions & Resolution Status

1. **Q: How does the C++ broker register with etcd?**  
   *Option A*: Direct etcd gRPC / v3 HTTP client inside C++.  
   *Option B (Recommended)*: A small Go sidecar / registration runner that boots alongside the C++ broker in the container.  
   *Decision*: Option B provides the fastest and most reliable etcd v3 lease integration with zero heavy C++ gRPC dependencies.

2. **Q: How are partition offsets assigned when dynamic routing is active?**  
   *Resolution*: Each regional broker assigns monotonic offsets for its local partitions. The Go Control Plane maintains global epoch metadata.
