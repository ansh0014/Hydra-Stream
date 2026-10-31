#!/bin/bash
set -e

echo "=== Starting Hydra Stream Multi-Region Cluster via Docker Compose ==="
docker-compose -f deploy/compose/docker-compose.yml up --build -d

echo "=== Services Started. Inspecting Containers ==="
docker-compose -f deploy/compose/docker-compose.yml ps
