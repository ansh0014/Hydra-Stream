#!/bin/bash
set -e

echo "=== Building Hydra Broker Container Image ==="
docker build -t hydra-broker:dev -f broker/Dockerfile broker/

echo "=== Loading Image into Minikube ==="
minikube image load hydra-broker:dev

echo "=== Deploying etcd to Minikube ==="
kubectl apply -f deploy/k8s/etcd/etcd.yaml

echo "=== Deploying Prometheus to Minikube ==="
kubectl apply -f deploy/k8s/prometheus/prometheus.yaml

echo "=== Deploying Regional Brokers (India, Germany, Singapore) ==="
kubectl apply -f deploy/k8s/brokers/broker-india.yaml
kubectl apply -f deploy/k8s/brokers/broker-germany.yaml
kubectl apply -f deploy/k8s/brokers/broker-singapore.yaml

echo "=== Deployment Complete. Checking Pods ==="
kubectl get pods -o wide
