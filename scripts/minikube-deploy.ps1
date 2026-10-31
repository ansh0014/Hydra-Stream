# Hydra Stream - Minikube End-to-End Cluster Deployment (PowerShell)
$ErrorActionPreference = "Stop"

Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "       Hydra Stream - Minikube End-to-End Cluster Deploy         " -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Cyan

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = Split-Path -Parent $ScriptDir
Set-Location $RootDir

Write-Host "`n[1/4] Building Hydra Broker, Control Plane & Frontend Images..." -ForegroundColor Yellow
docker build -t hydra-broker:dev -f broker/Dockerfile broker/
docker build -t hydra-controller:dev -f control-plane/Dockerfile control-plane/
docker build -t hydra-frontend:dev -f frontend/Dockerfile frontend/

Write-Host "`n[2/4] Loading Images into Minikube Cluster..." -ForegroundColor Yellow
minikube image load hydra-broker:dev
minikube image load hydra-controller:dev
minikube image load hydra-frontend:dev

Write-Host "`n[3/4] Deploying Storage & Discovery Layers (etcd, Prometheus)..." -ForegroundColor Yellow
kubectl apply -f deploy/k8s/etcd/etcd.yaml
kubectl apply -f deploy/k8s/prometheus/prometheus.yaml

Write-Host "`n[4/4] Deploying Regional Brokers, Sovereign Control Plane & Frontend..." -ForegroundColor Yellow
kubectl apply -f deploy/k8s/brokers/broker-india.yaml
kubectl apply -f deploy/k8s/brokers/broker-germany.yaml
kubectl apply -f deploy/k8s/brokers/broker-singapore.yaml
kubectl apply -f deploy/k8s/control-plane/controller.yaml
kubectl apply -f deploy/k8s/frontend/frontend.yaml

Write-Host "`n=================================================================" -ForegroundColor Green
Write-Host "  Hydra Stream Minikube Deployment Succeeded! Live Pod Status:   " -ForegroundColor Green
Write-Host "=================================================================" -ForegroundColor Green
kubectl get pods -o wide
Write-Host "`nTo open the frontend dashboard in Minikube, run:" -ForegroundColor Cyan
Write-Host "  minikube service hydra-frontend" -ForegroundColor White
