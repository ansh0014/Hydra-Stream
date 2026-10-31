@echo off
setlocal enabledelayedexpansion

:: =====================================================================
::  Hydra Stream - All-In-One Minikube & Docker Automated Launcher
:: =====================================================================

set "SCRIPT_DIR=%~dp0"
for %%I in ("%SCRIPT_DIR%..") do set "ROOT_DIR=%%~fI"
cd /d "%ROOT_DIR%"

set "CMD_ACTION=%~1"

:: Default action: Run complete Minikube & Docker deployment end-to-end
if "%CMD_ACTION%"=="" goto :run_all_minikube
if /i "%CMD_ACTION%"=="all" goto :run_all_minikube
if /i "%CMD_ACTION%"=="start" goto :run_all_minikube
if /i "%CMD_ACTION%"=="run" goto :run_all_minikube
if /i "%CMD_ACTION%"=="minikube" goto :run_all_minikube
if /i "%CMD_ACTION%"=="k8s" goto :run_all_minikube

:: Other subcommands
if /i "%CMD_ACTION%"=="compose" goto :compose_up
if /i "%CMD_ACTION%"=="up" goto :compose_up
if /i "%CMD_ACTION%"=="down" goto :cluster_down
if /i "%CMD_ACTION%"=="stop" goto :cluster_down
if /i "%CMD_ACTION%"=="status" goto :cluster_status
if /i "%CMD_ACTION%"=="ps" goto :cluster_status
if /i "%CMD_ACTION%"=="test" goto :run_tests
if /i "%CMD_ACTION%"=="chaos" goto :chaos_injection
if /i "%CMD_ACTION%"=="help" goto :help

echo [ERROR] Unknown command: %CMD_ACTION%
goto :help

:: ---------------------------------------------------------------------
:: ALL-IN-ONE MINIKUBE & DOCKER CLUSTER LAUNCHER
:: ---------------------------------------------------------------------
:run_all_minikube
echo.
echo =================================================================
echo   HYDRA STREAM - ALL-IN-ONE MINIKUBE CLUSTER LAUNCHER
echo =================================================================
echo.

:: 1. Check Minikube status and start if not running
echo [1/6] Verifying Minikube status...
minikube status >nul 2>&1
if errorlevel 1 (
    echo [Minikube] Minikube is not running. Starting Minikube...
    minikube start
    if errorlevel 1 (
        echo [ERROR] Failed to start Minikube. Ensure Docker or your hypervisor is running.
        pause
        exit /b 1
    )
) else (
    echo [Minikube] Minikube cluster is already active and healthy.
)

:: 2. Build Docker Images
echo.
echo [2/6] Building Docker Container Images for Hydra Cluster...
echo   - Building C++ Regional Broker Image (hydra-broker:dev)...
docker build -t hydra-broker:dev -f broker\Dockerfile broker\
if errorlevel 1 (
    echo [ERROR] Failed to build broker Docker image.
    pause
    exit /b 1
)

echo   - Building Sovereign Go Control Plane Image (hydra-controller:dev)...
docker build -t hydra-controller:dev -f control-plane\Dockerfile control-plane\
if errorlevel 1 (
    echo [ERROR] Failed to build control-plane Docker image.
    pause
    exit /b 1
)

echo   - Building React Express Dashboard Image (hydra-frontend:dev)...
docker build -t hydra-frontend:dev -f frontend\Dockerfile frontend\
if errorlevel 1 (
    echo [ERROR] Failed to build frontend Docker image.
    pause
    exit /b 1
)

:: 3. Load Images into Minikube
echo.
echo [3/6] Loading Images into Minikube Node...
echo   - Loading hydra-broker:dev...
minikube image load hydra-broker:dev
echo   - Loading hydra-controller:dev...
minikube image load hydra-controller:dev
echo   - Loading hydra-frontend:dev...
minikube image load hydra-frontend:dev

:: 4. Deploy Kubernetes Manifests
echo.
echo [4/6] Deploying Kubernetes Infrastructure (Storage, Metrics, Mesh)...
echo   - Deploying etcd v3 Discovery State Store...
kubectl apply -f deploy\k8s\etcd\etcd.yaml
echo   - Deploying Prometheus Live Telemetry Scraper...
kubectl apply -f deploy\k8s\prometheus\prometheus.yaml

echo.
echo [5/6] Deploying Regional Brokers, Sovereign Control Plane & Dashboard...
echo   - Deploying India Regional Broker (Mumbai :9092)...
kubectl apply -f deploy\k8s\brokers\broker-india.yaml
echo   - Deploying Germany Regional Broker (Frankfurt :9093 - GDPR Locked)...
kubectl apply -f deploy\k8s\brokers\broker-germany.yaml
echo   - Deploying Singapore Regional Broker (Changi :9094)...
kubectl apply -f deploy\k8s\brokers\broker-singapore.yaml
echo   - Deploying Hydra Go Control Plane (:8080)...
kubectl apply -f deploy\k8s\control-plane\controller.yaml
echo   - Deploying Hydra React Dashboard (:3000)...
kubectl apply -f deploy\k8s\frontend\frontend.yaml

:: 5. Display Status
echo.
echo =================================================================
echo   Hydra Stream Multi-Region Cluster Deployed Successfully!
echo =================================================================
echo.
echo [Current Pod Status]:
kubectl get pods -o wide
echo.
echo [Cluster Services]:
kubectl get services

:: 6. Launch Dashboard in Browser
echo.
echo [6/6] Launching Hydra Stream Frontend Dashboard in Minikube...
echo Opening browser connection to hydra-frontend...
minikube service hydra-frontend
exit /b 0

:: ---------------------------------------------------------------------
:: DOCKER COMPOSE ALTERNATIVE
:: ---------------------------------------------------------------------
:compose_up
echo.
echo =================================================================
echo   [Hydra] Starting Multi-Region Cluster via Docker Compose...
echo =================================================================
docker-compose -f deploy\compose\docker-compose.yml up --build -d
if errorlevel 1 (
    echo [ERROR] Docker Compose failed to start.
    exit /b %errorlevel%
)
echo.
echo =================================================================
echo   [Hydra] Multi-Region Cluster is LIVE via Docker Compose!
echo =================================================================
echo   - Frontend UI:     http://localhost:3000
echo   - Control Plane:   http://localhost:8080/health
echo   - Envoy Proxy:     http://localhost:9000
echo   - Prometheus:      http://localhost:9090
echo   - India Broker:    tcp://localhost:9092
echo   - Germany Broker:  tcp://localhost:9093 (EU GDPR Isolated)
echo   - Singapore Hub:   tcp://localhost:9094
echo =================================================================
docker-compose -f deploy\compose\docker-compose.yml ps
exit /b 0

:: ---------------------------------------------------------------------
:: CLUSTER TEARDOWN / STOP
:: ---------------------------------------------------------------------
:cluster_down
echo.
echo [Hydra] Tearing down Minikube deployments...
kubectl delete -f deploy\k8s\frontend\frontend.yaml --ignore-not-found=true
kubectl delete -f deploy\k8s\control-plane\controller.yaml --ignore-not-found=true
kubectl delete -f deploy\k8s\brokers\broker-singapore.yaml --ignore-not-found=true
kubectl delete -f deploy\k8s\brokers\broker-germany.yaml --ignore-not-found=true
kubectl delete -f deploy\k8s\brokers\broker-india.yaml --ignore-not-found=true
kubectl delete -f deploy\k8s\prometheus\prometheus.yaml --ignore-not-found=true
kubectl delete -f deploy\k8s\etcd\etcd.yaml --ignore-not-found=true

echo [Hydra] Stopping Docker Compose if active...
docker-compose -f deploy\compose\docker-compose.yml down --remove-orphans >nul 2>&1
echo [Hydra] Cluster stopped cleanly.
exit /b 0

:: ---------------------------------------------------------------------
:: CLUSTER STATUS
:: ---------------------------------------------------------------------
:cluster_status
echo.
echo [Minikube Pods]:
kubectl get pods -o wide
echo.
echo [Minikube Services]:
kubectl get services
echo.
echo [Docker Containers]:
docker-compose -f deploy\compose\docker-compose.yml ps
exit /b 0

:: ---------------------------------------------------------------------
:: TEST SUITE
:: ---------------------------------------------------------------------
:run_tests
echo.
echo =================================================================
echo   [Hydra] Running Full Phase 1-4 Verification Suite
echo =================================================================
powershell -ExecutionPolicy Bypass -File scenarios\run_all.ps1
exit /b %errorlevel%

:: ---------------------------------------------------------------------
:: LINUX TC NETEM CHAOS INJECTION
:: ---------------------------------------------------------------------
:chaos_injection
set "CHAOS_CONTAINER=%~2"
set "CHAOS_MODE=%~3"
set "CHAOS_DELAY=%~4"
set "CHAOS_JITTER=%~5"
set "CHAOS_LOSS=%~6"

if "%CHAOS_CONTAINER%"=="" set "CHAOS_CONTAINER=hydra-broker-india"
if "%CHAOS_MODE%"=="" set "CHAOS_MODE=apply"
if "%CHAOS_DELAY%"=="" set "CHAOS_DELAY=260ms"
if "%CHAOS_JITTER%"=="" set "CHAOS_JITTER=15ms"
if "%CHAOS_LOSS%"=="" set "CHAOS_LOSS=10%%"

if /i "%CHAOS_MODE%"=="apply" (
    echo [Chaos Engine] Injecting netem fault on %CHAOS_CONTAINER% (delay %CHAOS_DELAY% %CHAOS_JITTER% loss %CHAOS_LOSS%)...
    docker exec --privileged %CHAOS_CONTAINER% tc qdisc replace dev eth0 root netem delay %CHAOS_DELAY% %CHAOS_JITTER% loss %CHAOS_LOSS%
    if errorlevel 1 (
        echo [ERROR] Failed to apply kernel fault. Ensure container is running with --privileged.
        exit /b 1
    )
    echo [Chaos Engine] Fault applied successfully.
) else if /i "%CHAOS_MODE%"=="clear" (
    echo [Chaos Engine] Clearing netem fault on %CHAOS_CONTAINER%...
    docker exec --privileged %CHAOS_CONTAINER% tc qdisc del dev eth0 root
    echo [Chaos Engine] Netem flushed. Latency restored to pristine state.
) else (
    echo [ERROR] Unknown chaos mode: %CHAOS_MODE%. Use 'apply' or 'clear'.
    exit /b 1
)
exit /b 0

:: ---------------------------------------------------------------------
:: HELP MENU
:: ---------------------------------------------------------------------
:help
echo =================================================================
echo   Hydra Stream - Sovereign Geo-Resilient Streaming Broker
echo =================================================================
echo.
echo Simply run without arguments to build and run everything in Minikube:
echo   scripts\hydra.bat
echo.
echo Available Subcommands:
echo   scripts\hydra.bat             Build and launch everything in Minikube (Default)
echo   scripts\hydra.bat status      Inspect Minikube pods and service URLs
echo   scripts\hydra.bat stop        Tear down Minikube deployments and stop services
echo   scripts\hydra.bat compose     Run multi-region cluster via Docker Compose instead
echo   scripts\hydra.bat test        Run unit, benchmark, and routing verification suite
echo   scripts\hydra.bat chaos       Inject Linux kernel tc netem undersea link latency
echo =================================================================
exit /b 0
