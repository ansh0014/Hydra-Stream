# 11 — First Sprint: Dynamic Multi-Region Broker MVP

## Sprint Goal
Deploy 3 independent Hydra broker nodes representing three geographic regions (**India**, **Germany**, **Singapore**) alongside **`etcd`** in Docker, register them dynamically with zero hardcoded IPs, and verify basic cross-region `PRODUCE` and `FETCH` networking.

---

## Sprint Backlog & Acceptance Criteria

### Task 1: Broker Network Socket Listener (C++)
* Extend `Hydrosync` broker to listen on a TCP port (default `9092`).
* Support basic binary request framing:
  * `PRODUCE(topic, payload)` &rarr; appends to in-memory `ConcurrentQueue` and returns monotonic offset.
  * `FETCH(topic, offset)` &rarr; returns messages starting at requested offset.
* **Acceptance**: A simple client can send a message over TCP and receive a monotonic offset acknowledgement.

### Task 2: Dynamic etcd Registration
* Add broker CLI/environment parameters:
  * `--broker-id=broker-india-1`
  * `--region=India`
  * `--port=9092`
  * `--health-port=8081`
* On boot, connect to `etcd` and register `/registry/brokers/<broker-id>` with a 5-second TTL heartbeat lease.
* **Acceptance**: Inspecting `etcd` shows all active brokers and their regions dynamically.

### Task 3: Multi-Region Docker Compose
* Create `deploy/docker-compose.yml` defining:
  * `etcd`
  * `hydra-broker-india` (Port 9092)
  * `hydra-broker-germany` (Port 9093)
  * `hydra-broker-singapore` (Port 9094)
* **Acceptance**: `docker-compose up -d` starts all services and brokers successfully register in `etcd`.

### Task 4: Go Control Plane Discovery Service
* Create a lightweight Go service in `control-plane/` that connects to `etcd`.
* Watches `/registry/brokers/` and prints live cluster topology in real time.
* Verifies that nodes dynamically appear on container start and disappear on container stop.
* **Acceptance**: Stopping `hydra-broker-singapore` causes the Go Control Plane to log: *"Node broker-singapore-1 offline (Region: Singapore)"* within 5 seconds.
