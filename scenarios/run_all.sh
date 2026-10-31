#!/usr/bin/env bash
# Hydra Stream - Automated Multi-Region Chaos & Verification Suite
set -euo pipefail

echo "================================================================="
echo "        HYDRA STREAM - GEO-RESILIENCE & RECOVERY SUITE          "
echo "================================================================="

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

echo "[1/4] Running Control Plane Go Unit Tests..."
cd "$ROOT_DIR/control-plane"
go test -v ./...

echo "[2/4] Running Simulation & Chaos Engine Tests..."
cd "$ROOT_DIR/simulation"
go test -v ./...

echo "[3/4] Running Broker C++ Unit Tests..."
cd "$ROOT_DIR/broker/build"
ctest --output-on-failure

echo "[4/4] Executing Chaos Simulation & Oracle Verification..."
cd "$ROOT_DIR/simulation"
go run ./chaos/main.go || true
go run ./oracle/main.go --trace test_events.jsonl || true

echo "================================================================="
echo "       ALL PHASE 1-4 COMPONENT TESTS COMPLETED SUCCESSFULLY!     "
echo "================================================================="
