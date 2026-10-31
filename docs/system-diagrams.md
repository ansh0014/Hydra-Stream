# Hydra Stream — Comprehensive Visual Architecture & Phase Diagrams

This document consolidates all architectural, networking, lifecycle, fault injection, and correctness diagrams for the Hydra Stream and Hybrid Simulation Engine platform using Mermaid.

---

## 1. End-to-End Implementation Roadmap (Phases 1–4)

```mermaid
flowchart LR
    subgraph P1["Phase 1: Broker Daemon & Network Stack"]
        direction TB
        P1_A["Refactor Repo Structure"] --> P1_B["TCP Socket Server & Binary Protocol"]
        P1_B --> P1_C["In-Memory Bounded Topic Queues (RAM)"]
        P1_C --> P1_D["HTTP/TCP Health Probe (/health)"]
    end

    subgraph P2["Phase 2: 3-Broker Docker Cluster"]
        direction TB
        P2_A["Multi-broker Docker Compose"] --> P2_B["Isolated Bridge Network"]
        P2_B --> P2_C["Container Memory Limits & Env Config"]
        P2_C --> P2_D["Container Healthchecks"]
    end

    subgraph P3["Phase 3: Hybrid Simulation Engine MVP"]
        direction TB
        P3_A["Go Experiment Controller"] --> P3_B["C++ High-Throughput Workload Engine"]
        P3_B --> P3_C["Docker Fault Injector (Crash/Restart)"]
        P3_C --> P3_D["Observation Collector (JSONL)"]
        P3_D --> P3_E["In-Memory Correctness Oracle & Reconciliation"]
    end

    subgraph P4["Phase 4: Advanced Chaos & Production Readiness"]
        direction TB
        P4_A["Linux tc netem Faults (Latency/Loss)"] --> P4_B["Partition Isolation Rules"]
        P4_B --> P4_C["Automated CI/CD Test Matrix"]
        P4_C --> P4_D["Markdown & JSON Executive Reports"]
    end

    P1 --> P2
    P2 --> P3
    P3 --> P4
```

---

## 2. High-Level System Architecture & Component Boundaries

```mermaid
flowchart TB
    subgraph CONTROLLER["Simulation Control Plane (Go)"]
        CLI["hydra-sim CLI"]
        CFG["Scenario YAML Parser & Validator"]
        SCHED["Monotonic Clock Scheduler"]
        FAULTE["Fault Engine (Docker Adapter)"]
        ORACLE["In-Memory Correctness Oracle"]
        METRICS_AGG["Metrics & Histogram Aggregator"]
        REPORT_GEN["Report Generator (JSON/Markdown)"]

        CLI --> CFG
        CFG --> SCHED
        SCHED --> FAULTE
        SCHED --> ORACLE
        METRICS_AGG --> REPORT_GEN
        ORACLE --> REPORT_GEN
    end

    subgraph WORKLOAD["Workload Generator (C++)"]
        SCHED_C["Traffic Scheduler (Constant / Burst / Ramp)"]
        PROD_POOL["Producer Worker Threads"]
        CONS_POOL["Consumer Worker Threads"]
        CLIENT_ADAPTER["Hydra Client Protocol Adapter"]
        EVENT_SINK["Buffered JSONL Event Sink"]

        SCHED_C --> PROD_POOL
        PROD_POOL --> CLIENT_ADAPTER
        CONS_POOL --> CLIENT_ADAPTER
        PROD_POOL --> EVENT_SINK
        CONS_POOL --> EVENT_SINK
    end

    subgraph CLUSTER["Hydra Stream Distributed Cluster (Docker)"]
        direction LR
        subgraph BA["Broker A (Leader/Replica)"]
            NET_A["TCP Listener :9092"]
            ENG_A["Broker Engine"]
            RAM_A["In-Memory ConcurrentQueue"]
            HEALTH_A["Health Probe :8081"]
            NET_A --> ENG_A --> RAM_A
            ENG_A --> HEALTH_A
        end

        subgraph BB["Broker B (Follower/Replica)"]
            NET_B["TCP Listener :9093"]
            ENG_B["Broker Engine"]
            RAM_B["In-Memory ConcurrentQueue"]
            HEALTH_B["Health Probe :8082"]
            NET_B --> ENG_B --> RAM_B
            ENG_B --> HEALTH_B
        end

        subgraph BC["Broker C (Follower/Replica)"]
            NET_C["TCP Listener :9094"]
            ENG_C["Broker Engine"]
            RAM_C["In-Memory ConcurrentQueue"]
            HEALTH_C["Health Probe :8083"]
            NET_C --> ENG_C --> RAM_C
            ENG_C --> HEALTH_C
        end
    end

    subgraph OBSERVATIONS["Observation & Storage Subsystem"]
        EVENT_LOG["events.jsonl"]
        LEDGER["In-Memory Ledger (Attempted/Acked/Delivered)"]
        REPORT_FILE["report.json / report.md"]
    end

    CLIENT_ADAPTER -->|TCP Binary Framing| NET_A
    CLIENT_ADAPTER -->|TCP Binary Framing| NET_B
    CLIENT_ADAPTER -->|TCP Binary Framing| NET_C

    FAULTE -->|Docker Engine API| BA
    FAULTE -->|Docker Engine API| BB
    FAULTE -->|Docker Engine API| BC

    EVENT_SINK --> EVENT_LOG
    EVENT_LOG --> LEDGER
    LEDGER --> ORACLE
    EVENT_LOG --> METRICS_AGG
    REPORT_GEN --> REPORT_FILE
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
    participant C as C++ Workload Client
    participant S as Broker TCP Socket Listener
    participant W as Worker Thread Pool
    participant T as Topic In-Memory Queue

    Note over C,S: Connection Establishment (TCP 3-way handshake)
    C->>S: Connect(IP, Port)
    S-->>C: Connection Accepted

    rect rgb(240, 248, 255)
        Note over C,T: Produce Message Flow
        C->>S: Frame[CMD=PRODUCE, CorrID=101, Topic='orders', Payload=Bytes]
        S->>W: Dispatch Request Task
        W->>T: Append to In-Memory ConcurrentQueue
        T-->>W: Committed Offset: 4502
        W->>S: Response Frame[CMD=PRODUCE_ACK, CorrID=101, Offset=4502]
        S-->>C: Deliver ACK Frame
        C->>C: Record Produce Latency & Emit JSONL Event
    end

    rect rgb(255, 250, 240)
        Note over C,T: Consume Message Flow
        C->>S: Frame[CMD=FETCH, CorrID=102, Topic='orders', Offset=4502, MaxBytes=65536]
        S->>W: Fetch Task
        W->>T: Read from In-Memory Offset 4502
        T-->>W: Message Batch [ID=101, Offset=4502]
        W->>S: Response Frame[CMD=FETCH_RES, CorrID=102, Messages]
        S-->>C: Deliver Messages
        C->>C: Record Delivery Latency & Emit JSONL Event
    end
```

---

## 4. Broker Internal Multi-Threading & In-Memory Storage

```mermaid
flowchart TB
    subgraph INGRESS["Network Ingress & Dispatch"]
        CONN["Incoming Client TCP Connections"] --> ACC["Acceptor Loop"]
        ACC --> WORKER_Q["Network Read/Write Queue"]
        WORKER_Q --> PARSER["Protocol Decoder & Framing Parser"]
    end

    subgraph ENGINE["Broker Core Engine"]
        PARSER --> ROUTER["Command Router"]
        ROUTER -->|Produce| TOPIC_MGR["Topic Manager"]
        ROUTER -->|Fetch| TOPIC_MGR
        ROUTER -->|Health| HEALTH_MOD["Health Provider (/health)"]

        subgraph TOPIC_PART["Topic: 'orders' (Pure In-Memory)"]
            PART0["Partition 0 (Bounded ConcurrentQueue in RAM)"]
            PART1["Partition 1 (Bounded ConcurrentQueue in RAM)"]
        end

        TOPIC_MGR --> PART0
        TOPIC_MGR --> PART1
    end

    subgraph POOL["Asynchronous Execution"]
        TH_POOL["Worker Thread Pool"]
        ROUTER --> TH_POOL
        TH_POOL --> SINK_LOG["Thread-Safe Logger (Actor Pattern)"]
    end
```

---

## 5. Three-Broker Cluster Deployment (Docker Compose)

```mermaid
flowchart TB
    subgraph DOCKER_HOST["Docker Host Environment"]
        subgraph BRIDGE["Isolated Network: hydra-cluster-net (172.28.0.0/16)"]
            subgraph B1["Container: hydra-broker-a"]
                SRV1["Hydra Daemon (broker_id=broker-a)"]
                P1_TCP["TCP Port :9092"]
                P1_HTTP["HTTP Health :8081"]
            end

            subgraph B2["Container: hydra-broker-b"]
                SRV2["Hydra Daemon (broker_id=broker-b)"]
                P2_TCP["TCP Port :9093"]
                P2_HTTP["HTTP Health :8082"]
            end

            subgraph B3["Container: hydra-broker-c"]
                SRV3["Hydra Daemon (broker_id=broker-c)"]
                P3_TCP["TCP Port :9094"]
                P3_HTTP["HTTP Health :8083"]
            end
        end
    end

    subgraph HOST_CLIENTS["External Host / Simulator Access"]
        SIM_RUNNER["Go Simulation Controller & C++ Workload Engine"]
        SIM_RUNNER -->|Connect 127.0.0.1:9092| P1_TCP
        SIM_RUNNER -->|Connect 127.0.0.1:9093| P2_TCP
        SIM_RUNNER -->|Connect 127.0.0.1:9094| P3_TCP
    end
```

---

## 6. Workload Engine Concurrency & Flow

```mermaid
flowchart LR
    subgraph GENERATOR["Message Generator"]
        CFG["Workload Config\n- Seed\n- Target Rate\n- Message Size"] --> ID_GEN["Monotonic ID Generator\n(run_id, producer_id, seq_no)"]
        ID_GEN --> RATELIMIT["Token Bucket Rate Limiter"]
    end

    subgraph PRODUCERS["Producer Worker Threads"]
        RATELIMIT --> PT1["Producer Thread 1"]
        RATELIMIT --> PT2["Producer Thread 2"]
        RATELIMIT --> PTN["Producer Thread N"]
    end

    subgraph CLIENT["Client Adapter"]
        PT1 --> SOC_POOL["Socket Connection Pool"]
        PT2 --> SOC_POOL
        PTN --> SOC_POOL
        SOC_POOL --> BROKERS["Hydra Brokers (A, B, C)"]
    end

    subgraph CONSUMERS["Consumer Worker Threads"]
        BROKERS --> CT1["Consumer Thread 1"]
        BROKERS --> CT2["Consumer Thread 2"]
        BROKERS --> CTN["Consumer Thread N"]
    end

    subgraph OBSERVATION["Event Sink"]
        PT1 -->|produce.attempted\nproduce.acknowledged| Q_EV["Thread-Safe Queue"]
        CT1 -->|consumer.delivered\nconsumer.processed| Q_EV
        Q_EV --> FLUSHER["Background JSONL File Flusher"]
        FLUSHER --> JSONL_FILE[("events.jsonl")]
    end
```

---

## 7. Experiment Lifecycle State Machine

```mermaid
stateDiagram-v2
    [*] --> CREATED: Allocate Run ID & Directories
    CREATED --> VALIDATING: Parse Scenario YAML
    VALIDATING --> REJECTED: Schema / Target Validation Failed
    VALIDATING --> PREPARING: Configuration Valid

    PREPARING --> FAILED: Container / Network Setup Failed
    PREPARING --> RUNNING: Brokers Ready & Collector Online

    state RUNNING {
        [*] --> WorkloadActive
        WorkloadActive --> FaultTriggered: Monotonic Deadline Reached
        FaultTriggered --> FaultInjected: Apply Docker Fault (Stop Broker)
        FaultInjected --> WorkloadActive: Workload Continues Under Failure
    }

    RUNNING --> RECOVERING: Recovery Action Scheduled (Restart Broker)
    RECOVERING --> RUNNING: Broker Health Restored (/health OK)
    RECOVERING --> FINALIZING: Recovery Timeout / Cancel Signal

    RUNNING --> FINALIZING: Scenario Duration Reached / Stop Command
    FINALIZING --> COMPLETED: Observations Flushed, Oracle Evaluated, Report Generated
    FINALIZING --> FAILED: Cleanup / Assertion Processing Error

    REJECTED --> [*]
    COMPLETED --> [*]
    FAILED --> [*]
```

---

## 8. Fault Injection & Chaos Recovery Sequence

```mermaid
sequenceDiagram
    autonumber
    participant C as Go Controller
    participant S as Monotonic Scheduler
    participant F as Fault Adapter (Docker Engine API)
    participant B as Broker B Container
    participant W as C++ Workload Engine
    participant O as Observation Collector

    Note over C,W: Experiment reaches T=60s
    S->>C: Trigger Fault: stop-broker-b
    C->>O: Emit Event[fault.apply.started, target=broker-b]
    C->>F: StopContainer(name="hydra-broker-b", timeout=5s)
    F->>B: SIGTERM / SIGKILL
    B-->>F: Container Exited (Code 0 / 137)
    F-->>C: Stop Confirmed
    C->>O: Emit Event[fault.apply.completed, target=broker-b]

    rect rgb(255, 230, 230)
        Note over W,B: Chaos Phase: Broker B is Offline (T=60s to T=100s)
        W->>B: Produce Request
        W-->>W: Connection Refused / Timeout
        W->>O: Emit Event[produce.unknown_outcome / error]
    end

    Note over C,W: Experiment reaches T=100s
    S->>C: Trigger Recovery: start-broker-b
    C->>O: Emit Event[fault.recovery.started, target=broker-b]
    C->>F: StartContainer(name="hydra-broker-b")
    F->>B: Start Container Process
    B-->>F: Process Running
    
    loop Healthcheck Polling
        C->>B: GET http://localhost:8082/health
        B-->>C: 200 OK (Status: Ready, In-Memory Queues Active)
    end
    
    C->>O: Emit Event[fault.recovery.completed, target=broker-b, duration_ms=1840]
    
    rect rgb(230, 255, 230)
        Note over W,B: Normal Traffic Resumes
        W->>B: Reconnect & Produce
        B-->>W: ACK [Offset=monotonic]
    end
```

---

## 9. Correctness Oracle In-Memory Data Model (Pure RAM Structs — No Database)

> [!NOTE]
> No database (SQL, NoSQL, or embedded) is used. The verification engine maintains high-speed in-memory data structures (hash maps, vectors, and concurrent queues in RAM) to track and reconcile message lifecycles in real time.

```mermaid
classDiagram
    class InMemoryLedger {
        +map~uint64, MessageRecord~ in_flight_messages
        +vector~FaultRecord~ fault_timeline
        +record_send(seq, producer_id, timestamp)
        +record_ack(seq, broker_id, offset)
        +record_delivery(seq, consumer_id, offset)
        +reconcile_invariants() InvariantResult
    }

    class MessageRecord {
        +uint64 run_id
        +uint32 producer_id
        +uint64 sequence_number
        +uint64 assigned_offset
        +uint64 send_timestamp_ns
        +uint64 ack_timestamp_ns
        +string outcome_state
    }

    class DeliveryRecord {
        +uint32 consumer_id
        +uint64 delivery_timestamp_ns
        +uint64 consumed_offset
    }

    class FaultRecord {
        +string fault_id
        +string target_broker
        +string action_type
        +uint64 scheduled_ns
        +uint64 executed_ns
        +string outcome
    }

    class InvariantResult {
        +bool offsets_monotonic
        +bool no_loss_detected
        +bool bounded_queue_respected
        +uint64 duplicate_count
    }

    InMemoryLedger *-- MessageRecord : stores in RAM
    MessageRecord o-- DeliveryRecord : consumer observation
    InMemoryLedger o-- FaultRecord : fault history in RAM
    InMemoryLedger ..> InvariantResult : computes in memory
```

---

## 10. Correctness Ledger Reconciliation Flow

```mermaid
flowchart TD
    JSONL[("events.jsonl (Event Stream)")] --> READER["Ledger Stream Reader"]
    
    READER --> EV_ROUTER{"Event Type"}
    EV_ROUTER -->|produce.attempted| S1["Bucket: attempted (Total Sent)"]
    EV_ROUTER -->|produce.acknowledged| S2["Bucket: acknowledged (Confirmed Received)"]
    EV_ROUTER -->|produce.timeout| S3["Bucket: unknown_outcome (Ambiguous)"]
    EV_ROUTER -->|produce.rejected| S4["Bucket: rejected (Definite Failures)"]
    EV_ROUTER -->|consumer.delivered| S5["Bucket: delivered (Consumer Observed)"]
    EV_ROUTER -->|consumer.committed| S6["Bucket: committed (Offsets Progressed)"]

    S1 --> RECON["Oracle Reconciliation Engine (In-Memory)"]
    S2 --> RECON
    S3 --> RECON
    S4 --> RECON
    S5 --> RECON
    S6 --> RECON

    subgraph ASSERTIONS["Evaluated Invariants"]
        A1["Invariant: partition_offsets_monotonic"]
        A2["Invariant: no_acknowledged_message_loss\n(ack in delivered)"]
        A3["Invariant: queue_capacity_respected"]
        A4["Invariant: no_duplicate_delivery\n(Strict Exactly-Once if enabled)"]
    end

    RECON --> A1
    RECON --> A2
    RECON --> A3
    RECON --> A4

    A1 --> STATUS{"All Invariants Passed?"}
    A2 --> STATUS
    A3 --> STATUS
    A4 --> STATUS

    STATUS -->|Yes| PASS["Correctness Status: PASSED"]
    STATUS -->|Assertion Failed| FAIL["Correctness Status: FAILED"]
    STATUS -->|Missing Observations| INCONC["Correctness Status: INCONCLUSIVE"]
```

---

## 11. Metrics Aggregation & Reporting Pipeline

```mermaid
flowchart LR
    subgraph INGESTION["Raw Stream"]
        RAW["events.jsonl"] --> PARSER["Metrics Parser"]
    end

    subgraph COMPUTATION["Aggregation Engine"]
        PARSER --> LAT_HIST["HdrHistogram / Fast Latency Bins\n(P50, P95, P99)"]
        PARSER --> TPS_CALC["Throughput Rolling Window\n(Msg/sec, MB/sec)"]
        PARSER --> ERR_CALC["Error & Timeout Rate Counter"]
        PARSER --> HEALTH_HIST["Broker Health Timeline Tracker"]
    end

    subgraph ARTIFACTS["Run Output Artifacts"]
        LAT_HIST --> JSON_REP["report.json\n(Machine Readable)"]
        TPS_CALC --> JSON_REP
        ERR_CALC --> JSON_REP
        HEALTH_HIST --> JSON_REP

        JSON_REP --> MD_REP["report.md\n(Human-Readable Summary)"]
    end
```
