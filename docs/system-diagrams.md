# Hydra Stream — Comprehensive Visual Architecture & Phase Diagrams

This document consolidates all architectural, networking, lifecycle, fault injection, and correctness diagrams for the Hydra Stream geo-distributed platform using Mermaid.

---

## 1. End-to-End Implementation Roadmap (Phases 1–4)

```mermaid
flowchart LR
    subgraph P1["Phase 1: Broker Daemon & Network Stack"]
        direction TB
        P1_A["Refactor C++ Engine into Standalone Daemon"] --> P1_B["TCP Socket Server & Binary Framing"]
        P1_B --> P1_C["In-Memory Bounded Queues (Backpressure)"]
        P1_C --> P1_D["HTTP Health Probe (:8081)"]
    end

    subgraph P2["Phase 2: Multi-Region Docker Topology"]
        direction TB
        P2_A["Deploy etcd (Dynamic Service Registry)"] --> P2_B["3 Regional Nodes (India, Germany, Singapore)"]
        P2_B --> P2_C["Deploy Prometheus (Link Latency Monitoring)"]
        P2_C --> P2_D["Zero Hardcoded IPs via etcd Leases"]
    end

    subgraph P3["Phase 3: Hydra Control Plane (Go)"]
        direction TB
        P3_A["Go Control Plane Node Watcher"] --> P3_B["Legal Data Residency Enforcer (GDPR/EU)"]
        P3_B --> P3_C["Adaptive Route Selector (Bypass Slow Links)"]
        P3_C --> P3_D["In-Memory Correctness Oracle (No Loss Audit)"]
    end

    subgraph P4["Phase 4: Chaos & Regional Outage Resilience"]
        direction TB
        P4_A["Linux tc netem Slow-Link Injection"] --> P4_B["Regional Blackout Simulation (Kill Region)"]
        P4_B --> P4_C["Non-Freezing Cluster Quorum Verification"]
        P4_C --> P4_D["Automated JSON/Markdown Executive Reports"]
    end

    P1 --> P2
    P2 --> P3
    P3 --> P4
```

---

## 2. High-Level System Architecture & Component Boundaries

```mermaid
flowchart TB
    subgraph CP["Hydra Control Plane (Go)"]
        DISC["Dynamic Discovery Watcher (etcd client)"]
        POLICY["Legal Residency Policy Engine"]
        ROUTER["Adaptive Route Optimizer"]
        SUPERVISOR["Outage & Failover Supervisor"]
        ORACLE["In-Memory Correctness Oracle"]
        REPORT_GEN["Report Generator (JSON/Markdown)"]

        DISC --> POLICY
        POLICY --> ROUTER
        ROUTER --> SUPERVISOR
        SUPERVISOR --> ORACLE
        ORACLE --> REPORT_GEN
    end

    subgraph INFRA["Cloud-Native Infrastructure"]
        ETCD[("etcd (Registry & Leases)")]
        PROM[("Prometheus (Link RTT & Loss)")]
        ENVOY["Envoy L4 Proxy (Traffic Steering)"]
    end

    subgraph CLUSTER["Regional Broker Cluster (Docker)"]
        direction LR
        subgraph IN["Region: India"]
            NET_IN["TCP Listener :9092"]
            ENG_IN["Broker Engine"]
            RAM_IN["In-Memory Queue"]
            HEALTH_IN["Health Probe :8081"]
            NET_IN --> ENG_IN --> RAM_IN
            ENG_IN --> HEALTH_IN
        end

        subgraph DE["Region: Germany (EU Legal)"]
            NET_DE["TCP Listener :9093"]
            ENG_DE["Broker Engine"]
            RAM_DE["In-Memory Queue"]
            HEALTH_DE["Health Probe :8082"]
            NET_DE --> ENG_DE --> RAM_DE
            ENG_DE --> HEALTH_DE
        end

        subgraph SG["Region: Singapore"]
            NET_SG["TCP Listener :9094"]
            ENG_SG["Broker Engine"]
            RAM_SG["In-Memory Queue"]
            HEALTH_SG["Health Probe :8083"]
            NET_SG --> ENG_SG --> RAM_SG
            ENG_SG --> HEALTH_SG
        end
    end

    CP -->|Watch Leases| ETCD
    CP -->|Scrape RTT| PROM
    CP -->|Update Routes| ENVOY

    ENG_IN -->|Register Heartbeat| ETCD
    ENG_DE -->|Register Heartbeat| ETCD
    ENG_SG -->|Register Heartbeat| ETCD

    PROM -.->|Scrape| HEALTH_IN
    PROM -.->|Scrape| HEALTH_DE
    PROM -.->|Scrape| HEALTH_SG

    ENVOY -->|Forward Traffic| NET_IN
    ENVOY -->|Forward Traffic| NET_DE
    ENVOY -->|Forward Traffic| NET_SG
```

---

## 3. Network Architecture & Wire Protocol

### 3.1 Binary Frame Format (TCP Framing)

```mermaid
flowchart LR
    subgraph FRAME["Binary Network Frame Specification"]
        direction LR
        MAGIC["Magic Byte\n(0x48 'H')\n1 byte"]
        VERSION["Version\n(0x01)\n1 byte"]
        CMD["Command / OpCode\n(PRODUCE, FETCH, HEALTH)\n2 bytes"]
        CORR_ID["Correlation ID\n(uint64)\n8 bytes"]
        PAYLOAD_LEN["Payload Length\n(uint32)\n4 bytes"]
        PAYLOAD["Payload Data\n(Binary / JSON body)\nN bytes"]

        MAGIC --- VERSION --- CMD --- CORR_ID --- PAYLOAD_LEN --- PAYLOAD
    end
```

### 3.2 Client–Broker Request / Response Sequence

```mermaid
sequenceDiagram
    autonumber
    participant C as Producer / Consumer Client
    participant E as Envoy / Router
    participant B as Regional Broker (Germany)
    participant Q as In-Memory ConcurrentQueue

    Note over C,E: 1. Routing & Residency Check
    C->>E: Produce(Topic="eu-medical", Payload=Bytes)
    E->>E: Validate Residency: Target MUST be Germany
    E->>B: Forward Frame[CMD=PRODUCE, CorrID=101, Topic='eu-medical']

    Note over B,Q: 2. In-Memory Ingress & Monotonic Offset
    B->>Q: Append to Bounded Queue (Backpressure protected)
    Q-->>B: Assigned Monotonic Offset: 5041
    B-->>E: Frame[CMD=PRODUCE_ACK, CorrID=101, Offset=5041]
    E-->>C: Deliver ACK Frame

    Note over C,Q: 3. Fetch by Sequential Offset
    C->>E: Fetch(Topic="eu-medical", Offset=5041)
    E->>B: Forward Frame[CMD=FETCH, Offset=5041]
    B->>Q: Read from Offset 5041
    Q-->>B: Message Data
    B-->>E: Frame[CMD=FETCH_RES, Offset=5041, Payload=Bytes]
    E-->>C: Deliver Message Batch
```

---

## 4. Three-Region Cluster Deployment with etcd (Docker Compose)

```mermaid
flowchart TB
    subgraph DOCKER_HOST["Docker Host Environment (hydra-mesh: 172.30.0.0/16)"]
        subgraph COORD["Coordination & Observability"]
            ETCD["etcd:2379\n(Dynamic Registry & Node Leases)"]
            PROM["Prometheus:9090\n(Inter-Region Latency & Health)"]
        end

        subgraph R_IN["Region: India"]
            B1["Container: hydra-broker-india\nPort: 9092 | Health: 8081\nTag: Region=India"]
        end

        subgraph R_DE["Region: Germany (EU Legal Territory)"]
            B2["Container: hydra-broker-germany\nPort: 9093 | Health: 8082\nTag: Region=Germany (GDPR)"]
        end

        subgraph R_SG["Region: Singapore"]
            B3["Container: hydra-broker-singapore\nPort: 9094 | Health: 8083\nTag: Region=Singapore"]
        end

        B1 -->|TTL Lease Heartbeat| ETCD
        B2 -->|TTL Lease Heartbeat| ETCD
        B3 -->|TTL Lease Heartbeat| ETCD

        PROM -.->|Scrapes| B1
        PROM -.->|Scrapes| B2
        PROM -.->|Scrapes| B3
    end

    subgraph CLIENTS["External Ingress Clients"]
        CLI["Hydra Control Plane & Workload Client"]
        CLI -->|Query Topology| ETCD
        CLI -->|Query RTT Metrics| PROM
        CLI -->|Produce/Fetch| B1
        CLI -->|Produce/Fetch| B2
        CLI -->|Produce/Fetch| B3
    end
```

---

## 5. Dynamic Slow-Link Routing & Regional Outage Sequence

```mermaid
sequenceDiagram
    autonumber
    participant C as Hydra Control Plane (Go)
    participant P as Prometheus Latency Scraper
    participant F as Chaos Fault Injector (tc netem)
    participant W as Producer Client
    participant IN as Broker India
    participant DE as Broker Germany

    Note over C,W: Normal State: Inter-region RTT = 80ms
    W->>IN: Send Message (Target: Global Topic)
    IN-->>W: ACK (Latency: 80ms)

    Note over C,W: Phase 1: Chaos Injected (India <-> Germany +350ms Latency)
    F->>F: tc qdisc add dev eth0 root netem delay 350ms
    P->>C: Alert: Link India-Germany RTT spiked to 430ms (DEGRADED)
    C->>C: Recompute Route Weights: Deprecate Direct Degraded Link

    rect rgb(230, 255, 230)
        Note over W,DE: Phase 2: Dynamic Route Steering
        W->>C: Request Route for Next Batch
        C-->>W: Route via Singapore Alternate Path / Local Buffer
        W->>DE: Forward via Optimal Route
        DE-->>W: Fast ACK in 45ms (Slow Link Bypassed!)
    end

    Note over C,W: Phase 3: Regional Blackout (Kill Singapore Region)
    F->>F: docker stop hydra-broker-singapore
    C->>C: Detect Outage: Switch Surviving Nodes (India & Germany) to Local Quorum
    W->>IN: Produce to India Topic
    IN-->>W: ACK (Surviving regions continue operating without freezing!)
```

---

## 6. Correctness Oracle In-Memory Data Model (RAM Structs — Zero Database)

> [!NOTE]
> No database (SQL, NoSQL, or embedded) is used. The verification engine maintains high-speed in-memory data structures (hash maps, vectors, and concurrent queues in RAM) to track and reconcile message lifecycles and compliance in real time.

```mermaid
classDiagram
    class InMemoryLedger {
        +map~uint64, MessageRecord~ in_flight_messages
        +vector~ResidencyAuditRecord~ residency_audits
        +vector~FaultRecord~ fault_timeline
        +record_send(seq, producer_id, target_region)
        +record_ack(seq, broker_id, broker_region, offset)
        +verify_legal_residency(allowed_region) bool
        +verify_no_acknowledged_loss() bool
        +verify_no_cluster_freeze() bool
    }

    class MessageRecord {
        +uint64 sequence_number
        +string topic_name
        +string target_legal_region
        +string actual_broker_region
        +uint64 assigned_offset
        +uint64 latency_ns
        +string outcome_state
    }

    class ResidencyAuditRecord {
        +string topic_name
        +string required_jurisdiction
        +string observed_broker_id
        +string observed_region
        +bool compliant
    }

    class FaultRecord {
        +string fault_id
        +string fault_type
        +string target_region
        +uint64 scheduled_ns
        +uint64 executed_ns
        +string status
    }

    InMemoryLedger *-- MessageRecord : tracks in RAM
    InMemoryLedger *-- ResidencyAuditRecord : compliance audits
    InMemoryLedger o-- FaultRecord : fault history
```

---

## 7. Metrics Aggregation & Reporting Pipeline

```mermaid
flowchart LR
    subgraph INGESTION["Raw Stream"]
        RAW["events.jsonl"] --> PARSER["Metrics & Audit Parser"]
    end

    subgraph COMPUTATION["Verification & Statistics Engine"]
        PARSER --> LAT_HIST["Latency Percentiles (P50, P95, P99)"]
        PARSER --> TPS_CALC["Throughput (Msg/sec, MB/sec)"]
        PARSER --> RES_AUDIT["Legal Residency Audit (GDPR Check)"]
        PARSER --> SLOW_AUDIT["Slow-Link Bypass Verification"]
        PARSER --> OUTAGE_AUDIT["Cluster Non-Freeze Verification"]
    end

    subgraph ARTIFACTS["Run Output Artifacts"]
        LAT_HIST --> JSON_REP["report.json\n(Machine-Readable Results)"]
        TPS_CALC --> JSON_REP
        RES_AUDIT --> JSON_REP
        SLOW_AUDIT --> JSON_REP
        OUTAGE_AUDIT --> JSON_REP

        JSON_REP --> MD_REP["report.md\n(Human-Readable Executive Summary)"]
    end
```
