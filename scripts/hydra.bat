@echo off
setlocal enabledelayedexpansion

:: =====================================================================
::  Hydra Stream - Unified Multi-Region Operations Manager (CMD)
:: =====================================================================

set "SCRIPT_DIR=%~dp0"
for %%I in ("%SCRIPT_DIR%..") do set "ROOT_DIR=%%~fI"
cd /d "%ROOT_DIR%"

set "CMD_ACTION=%~1"

if "%CMD_ACTION%"=="" goto :help
if /i "%CMD_ACTION%"=="help" goto :help
if /i "%CMD_ACTION%"=="up" goto :compose_up
if /i "%CMD_ACTION%"=="compose-up" goto :compose_up
if /i "%CMD_ACTION%"=="down" goto :compose_down
if /i "%CMD_ACTION%"=="compose-down" goto :compose_down
if /i "%CMD_ACTION%"=="status" goto :compose_status
if /i "%CMD_ACTION%"=="ps" goto :compose_status
if /i "%CMD_ACTION%"=="minikube" goto :minikube_deploy
if /i "%CMD_ACTION%"=="k8s" goto :minikube_deploy
if /i "%CMD_ACTION%"=="test" goto :run_tests
if /i "%CMD_ACTION%"=="chaos" goto :chaos_injection

echo [ERROR] Unknown command: %CMD_ACTION%
goto :help

:: ---------------------------------------------------------------------
:: 1. DOCKER COMPOSE UP
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
echo   [Hydra] Multi-Region Cluster is LIVE!
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
:: 2. DOCKER COMPOSE DOWN
:: ---------------------------------------------------------------------
:compose_down
echo.
echo [Hydra] Stopping Hydra Stream cluster containers...
docker-compose -f deploy\compose\docker-compose.yml down
exit /b 0

:: ---------------------------------------------------------------------
:: 3. CLUSTER STATUS
:: ---------------------------------------------------------------------
:compose_status
docker-compose -f deploy\compose\docker-compose.yml ps
exit /b 0

:: ---------------------------------------------------------------------
:: 4. MINIKUBE KUBERNETES DEPLOYMENT
:: ---------------------------------------------------------------------
:minikube_deploy
echo.
echo =================================================================
echo   [Hydra] Deploying Hydra Stream End-to-End into Minikube
echo =================================================================
echo [1/4] Building container images...
docker build -t hydra-broker:dev -f broker\Dockerfile broker\ || exit /b 1
docker build -t hydra-controller:dev -f control-plane\Dockerfile control-plane\ || exit /b 1
docker build -t hydra-frontend:dev -f frontend\Dockerfile frontend\ || exit /b 1

echo [2/4] Loading container images into Minikube...
minikube image load hydra-broker:dev || exit /b 1
minikube image load hydra-controller:dev || exit /b 1
minikube image load hydra-frontend:dev || exit /b 1

echo [3/4] Applying storage and discovery manifests...
kubectl apply -f deploy\k8s\etcd\etcd.yaml || exit /b 1
kubectl apply -f deploy\k8s\prometheus\prometheus.yaml || exit /b 1

echo [4/4] Deploying regional brokers, control plane, and frontend...
kubectl apply -f deploy\k8s\brokers\broker-india.yaml || exit /b 1
kubectl apply -f deploy\k8s\brokers\broker-germany.yaml || exit /b 1
kubectl apply -f deploy\k8s\brokers\broker-singapore.yaml || exit /b 1
kubectl apply -f deploy\k8s\control-plane\controller.yaml || exit /b 1
kubectl apply -f deploy\k8s\frontend\frontend.yaml || exit /b 1

echo.
echo =================================================================
echo   [Hydra] Minikube deployment complete! Pod status:
echo =================================================================
kubectl get pods -o wide
echo.
echo Run 'minikube service hydra-frontend' to open the UI in your browser.
exit /b 0

:: ---------------------------------------------------------------------
:: 5. TEST SUITE
:: ---------------------------------------------------------------------
:run_tests
echo.
echo =================================================================
echo   [Hydra] Running Full Phase 1-4 Verification Suite
echo =================================================================
powershell -ExecutionPolicy Bypass -File scenarios\run_all.ps1
exit /b %errorlevel%

:: ---------------------------------------------------------------------
:: 6. LINUX TC NETEM CHAOS INJECTION
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
echo Usage: scripts\hydra.bat [command]
echo.
echo Commands:
echo   up          Build and start cluster via Docker Compose (detached)
echo   down        Stop and clean up Docker Compose containers
echo   status      Show status of running cluster services
echo   minikube    Build and deploy entire cluster to Minikube Kubernetes
echo   test        Run end-to-end unit and benchmark test suite
echo   chaos       Inject or clear Linux tc netem network faults
echo.
echo Examples:
echo   scripts\hydra.bat up
echo   scripts\hydra.bat status
echo   scripts\hydra.bat chaos hydra-broker-india apply 260ms 15ms 10%%
echo   scripts\hydra.bat chaos hydra-broker-india clear
echo   scripts\hydra.bat down
echo =================================================================
exit /b 0
