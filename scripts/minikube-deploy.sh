#!/bin/bash
set -e

echo "================================================================="
echo "       Hydra Stream - Minikube End-to-End Cluster Deploy         "
echo "================================================================="

echo "`n[1/4] Building Hydra Broker, Control Plane & Frontend Images..."
docker build -t hydra-broker:dev -f broker/Dockerfile broker/
docker build -t hydra-controller:dev -f control-plane/Dockerfile control-plane/
docker build -t hydra-frontend:dev -f frontend/Dockerfile frontend/

echo "`n[2/4] Loading Images into Minikube Cluster..."
minikube image load hydra-broker:dev
minikube image load hydra-controller:dev
minikube image load hydra-frontend:dev

echo "`n[3/4] Deploying Storage & Discovery Layers (etcd, Prometheus)..."
kubectl apply -f deploy/k8s/etcd/etcd.yaml
kubectl apply -f deploy/k8s/prometheus/prometheus.yaml

echo "`n[4/4] Deploying Regional Brokers, Sovereign Control Plane & Frontend..."
kubectl apply -f deploy/k8s/brokers/broker-india.yaml
kubectl apply -f deploy/k8s/brokers/broker-germany.yaml
kubectl apply -f deploy/k8s/brokers/broker-singapore.yaml
kubectl apply -f deploy/k8s/control-plane/controller.yaml
kubectl apply -f deploy/k8s/frontend/frontend.yaml

echo "`n================================================================="
echo "  Hydra Stream Minikube Deployment Succeeded! Live Pod Status:   "
echo "================================================================="
kubectl get pods -o wide
echo "`nTo open the frontend dashboard in Minikube, run:"
echo "  minikube service hydra-frontend"
