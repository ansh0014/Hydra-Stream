package routing

import (
	"testing"
	"time"

	"github.com/hydra-stream/control-plane/pkg/discovery"
	"github.com/hydra-stream/control-plane/pkg/policy"
	"github.com/hydra-stream/control-plane/pkg/types"
)

func setupTestCluster() (*Router, *discovery.Registry, *policy.PolicyEngine) {
	pe := policy.NewPolicyEngine()
	reg := discovery.NewRegistry(30 * time.Second)

	reg.Register(types.BrokerNode{
		ID:       "broker-india",
		Region:   "India",
		Endpoint: "127.0.0.1:9092",
		Status:   "HEALTHY",
		RTT:      10 * time.Millisecond,
	})

	reg.Register(types.BrokerNode{
		ID:       "broker-germany",
		Region:   "Germany",
		Endpoint: "127.0.0.1:9093",
		Status:   "HEALTHY",
		RTT:      70 * time.Millisecond,
	})

	reg.Register(types.BrokerNode{
		ID:       "broker-singapore",
		Region:   "Singapore",
		Endpoint: "127.0.0.1:9094",
		Status:   "HEALTHY",
		RTT:      45 * time.Millisecond,
	})

	router := NewRouter(reg, pe)
	return router, reg, pe
}

func TestRouter_StrictLegalResidencyOverridesLatency(t *testing.T) {
	router, _, _ := setupTestCluster()

	// Even though India has 10ms RTT and Germany has 70ms RTT,
	// gdpr-user-audit MUST route to Germany to comply with European legal boundaries.
	decision, err := router.ResolveRoute("gdpr-user-audit", "India")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if decision.Region != "Germany" || decision.AssignedBrokerID != "broker-germany" {
		t.Fatalf("residency violation: expected Germany, got %s (%s)", decision.AssignedBrokerID, decision.Region)
	}
}

func TestRouter_DegradedLinkAvoidance(t *testing.T) {
	router, reg, _ := setupTestCluster()

	// Simulate India undersea cable degradation (RTT 250ms, packet loss 12%)
	reg.UpdateMetrics("broker-india", 250*time.Millisecond, 0.12, "DEGRADED")

	// Global telemetry topic from India client: router should bypass degraded Indian broker and pick Singapore (45ms)
	decision, err := router.ResolveRoute("telemetry", "India")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if decision.AssignedBrokerID != "broker-singapore" {
		t.Fatalf("expected broker-singapore due to degraded India link, got %s", decision.AssignedBrokerID)
	}

	if !decision.IsBypassingSlowLink {
		t.Fatalf("expected IsBypassingSlowLink to be true")
	}
}

func TestRouter_GermanyOutagePreventsResidencyLeak(t *testing.T) {
	router, reg, _ := setupTestCluster()

	// Germany suffers a regional blackout
	reg.UpdateMetrics("broker-germany", 0, 1.0, "OFFLINE")

	// Routing GDPR data when Germany is down MUST fail with residency error, NEVER leak to India/Singapore
	_, err := router.ResolveRoute("gdpr-user-audit", "India")
	if err != ErrNoCompliantBroker {
		t.Fatalf("expected ErrNoCompliantBroker to preserve data residency, got: %v", err)
	}
}
