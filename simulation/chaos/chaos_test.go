package main

import (
	"testing"
	"time"

	"github.com/hydra-stream/control-plane/pkg/discovery"
	"github.com/hydra-stream/control-plane/pkg/policy"
	"github.com/hydra-stream/control-plane/pkg/routing"
	"github.com/hydra-stream/control-plane/pkg/types"
)

func TestChaosSimulationScenarios(t *testing.T) {
	reg := discovery.NewRegistry(30 * time.Second)
	pe := policy.NewPolicyEngine()
	router := routing.NewRouter(reg, pe)

	// Step 1: Register initial topology
	reg.Register(types.BrokerNode{
		ID:         "broker-india",
		Region:     "India",
		Endpoint:   "127.0.0.1:9092",
		Status:     "HEALTHY",
		RTT:        10 * time.Millisecond,
		PacketLoss: 0.0,
	})
	reg.Register(types.BrokerNode{
		ID:         "broker-germany",
		Region:     "Germany",
		Endpoint:   "127.0.0.1:9093",
		Status:     "HEALTHY",
		RTT:        85 * time.Millisecond,
		PacketLoss: 0.0,
	})
	reg.Register(types.BrokerNode{
		ID:         "broker-singapore",
		Region:     "Singapore",
		Endpoint:   "127.0.0.1:9094",
		Status:     "HEALTHY",
		RTT:        40 * time.Millisecond,
		PacketLoss: 0.0,
	})

	// Baseline routing check
	decision, err := router.ResolveRoute("telemetry", "India")
	if err != nil {
		t.Fatalf("unexpected error resolving baseline route: %v", err)
	}
	if decision.AssignedBrokerID != "broker-india" {
		t.Fatalf("expected broker-india for local traffic, got: %s", decision.AssignedBrokerID)
	}

	// Step 2: Chaos Injection - Undersea Cable Degradation (India RTT = 260ms, Loss = 15%)
	err = reg.UpdateMetrics("broker-india", 260*time.Millisecond, 0.15, "DEGRADED")
	if err != nil {
		t.Fatalf("failed to update metrics: %v", err)
	}

	degradedDecision, err := router.ResolveRoute("telemetry", "India")
	if err != nil {
		t.Fatalf("failed to resolve route during degradation: %v", err)
	}
	if degradedDecision.AssignedBrokerID == "broker-india" {
		t.Fatalf("traffic was not steered away from degraded link!")
	}
	if degradedDecision.AssignedBrokerID != "broker-singapore" {
		t.Fatalf("expected routing to Singapore fast path, got %s", degradedDecision.AssignedBrokerID)
	}
	if !degradedDecision.IsBypassingSlowLink {
		t.Fatalf("expected IsBypassingSlowLink to be true")
	}

	// Step 3: Chaos Injection - Regional Outage on Germany
	err = reg.UpdateMetrics("broker-germany", 0, 1.0, "OFFLINE")
	if err != nil {
		t.Fatalf("failed to update Germany status: %v", err)
	}

	// Route GDPR data during outage -> MUST return error and NEVER leak to Singapore or India
	_, err = router.ResolveRoute("gdpr-user-audit", "India")
	if err == nil {
		t.Fatalf("CRITICAL SECURITY VIOLATION: GDPR data allowed to route while Germany broker is offline!")
	}

	// Step 4: Cluster Recovery
	_ = reg.UpdateMetrics("broker-india", 10*time.Millisecond, 0.0, "HEALTHY")
	_ = reg.UpdateMetrics("broker-germany", 85*time.Millisecond, 0.0, "HEALTHY")

	restoredDecision, err := router.ResolveRoute("telemetry", "India")
	if err != nil {
		t.Fatalf("failed to resolve route after recovery: %v", err)
	}
	if restoredDecision.AssignedBrokerID != "broker-india" {
		t.Fatalf("expected restored route to broker-india, got: %s", restoredDecision.AssignedBrokerID)
	}
}
