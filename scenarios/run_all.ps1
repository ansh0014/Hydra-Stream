# Hydra Stream - Automated Multi-Region Chaos & Verification Suite (PowerShell)
$ErrorActionPreference = "Stop"

Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "        HYDRA STREAM - GEO-RESILIENCE & RECOVERY SUITE          " -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Cyan

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = Split-Path -Parent $ScriptDir

Write-Host "`n[1/3] Running Control Plane Go Unit Tests..." -ForegroundColor Yellow
Set-Location "$RootDir\control-plane"
go test -v ./...

Write-Host "`n[2/3] Running Simulation & Chaos Engine Tests..." -ForegroundColor Yellow
Set-Location "$RootDir\simulation"
go test -v ./...

Write-Host "`n[3/3] Running Broker C++ Unit Tests via CTest..." -ForegroundColor Yellow
Set-Location "$RootDir\broker\build"
ctest --output-on-failure

Write-Host "`n=================================================================" -ForegroundColor Green
Write-Host "       ALL PHASE 1-4 COMPONENT TESTS COMPLETED SUCCESSFULLY!     " -ForegroundColor Green
Write-Host "=================================================================" -ForegroundColor Green
