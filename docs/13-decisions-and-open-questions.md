# 13 — Decisions and Open Questions

## 1. Proposed decisions

| ID | Decision | Reason | Status |
|---|---|---|---|
| D-001 | Build a hybrid workload + chaos engine | Tests performance and failure behavior together | Proposed |
| D-002 | Initial target is a three-broker Docker environment | Reproducible local cluster | Proposed |
| D-003 | Go owns experiment orchestration | Lifecycle, scheduling and process control | Proposed |
| D-004 | C++ owns workload generation | Exercise systems/client path with controllable concurrency | Proposed |
| D-005 | YAML describes experiments | Human-readable and versionable | Proposed |
| D-006 | JSONL stores structured observations | Streamable, inspectable and append-friendly | Proposed |
| D-007 | JSON/Markdown are initial report formats | Easy automation and review | Proposed |
| D-008 | Broker stop/restart is the first fault | Simpler and safer than network manipulation | Proposed |
| D-009 | Oracle is separate from workload generator | Avoid coupling traffic generation and correctness judgment | Proposed |
| D-010 | Unsupported assertions are skipped, never passed | Avoid false reliability claims | Proposed |

## 2. Questions to answer by inspecting the current broker

1. Can three independent broker processes run today?
2. Is broker identity configurable?
3. Which ports and protocol operations are available?
4. Does a C++ client already exist?
5. What exactly does a successful produce acknowledgement guarantee?
6. Are messages persisted? At what durability boundary?
7. How are topics and partitions represented?
8. Are consumer offsets implemented and persisted?
9. Does a broker expose a health endpoint or protocol-level ping?
10. Does the broker expose metrics or structured events?
11. Is replication implemented, experimental or absent?
12. Is there any leader/follower or partition ownership model?

## 3. Questions for the first implementation review

- Should the workload executable emit JSONL to stdout or write to a run-scoped file?
- Should the controller own the event collector initially?
- Which YAML library and JSON library are already used in the repository?
- What is the existing C++ standard and build configuration?
- Which Docker Compose version and operating systems are supported?
- What is the safe default producer rate for local development?

## 4. Explicit non-assumptions

Do not assume:
- Three broker containers form a replicated cluster.
- A running container means a healthy broker.
- A successful local append means power-loss durability.
- A producer timeout means the message was not appended.
- A broker restart implies automatic leader failover.
- A fixed random seed makes concurrency scheduling deterministic.
- Consumer delivery means processing and offset commit succeeded.

## 5. Decision process

When an open question is resolved:
1. Update this document.
2. Add implementation detail to the relevant design document.
3. Add or update tests.
4. Record any compatibility impact.
5. Keep the original decision history if a design changes materially.
