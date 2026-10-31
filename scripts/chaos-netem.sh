#!/usr/bin/env bash
# Hydra Stream - Real Linux Kernel tc netem Fault Injection Script
set -euo pipefail

CONTAINER="${1:-hydra-broker-india}"
ACTION="${2:-apply}"
DELAY="${3:-260ms}"
JITTER="${4:-15ms}"
LOSS="${5:-10%}"

echo "================================================================="
echo "   HYDRA LINUX tc netem KERNEL FAULT INJECTION                  "
echo "================================================================="
echo "Target Container: $CONTAINER"
echo "Action:           $ACTION"

if [ "$ACTION" == "apply" ]; then
    echo ">> Injecting real Linux kernel latency: delay ${DELAY} ${JITTER} loss ${LOSS}..."
    docker exec --privileged "$CONTAINER" tc qdisc replace dev eth0 root netem delay "$DELAY" "$JITTER" loss "$LOSS"
    echo ">> Kernel netem applied successfully on $CONTAINER."
    echo ">> Prometheus will now detect real ping degradation."
elif [ "$ACTION" == "clear" ]; then
    echo ">> Clearing kernel netem rules from $CONTAINER..."
    docker exec --privileged "$CONTAINER" tc qdisc del dev eth0 root || true
    echo ">> Kernel netem flushed. Link latency restored to normal."
else
    echo "Unknown action: $ACTION. Usage: $0 <container> [apply|clear] [delay] [jitter] [loss]"
    exit 1
fi
