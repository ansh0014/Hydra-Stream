package discovery

import (
	"testing"
	"time"

	"github.com/hydra-stream/control-plane/pkg/types"
)

func TestRegistry_RegisterAndHeartbeat(t *testing.T) {
	reg := NewRegistry(100 * time.Millisecond)

	node := types.BrokerNode{
		ID:       "broker-india",
		Region:   "India",
		Endpoint: "127.0.0.1:9092",
		Status:   "HEALTHY",
	}

	reg.Register(node)

	retrieved, ok := reg.GetBroker("broker-india")
	if !ok || retrieved.ID != "broker-india" {
		t.Fatalf("expected broker-india to be registered")
	}

	healthy := reg.ListHealthy()
	if len(healthy) != 1 {
		t.Fatalf("expected 1 healthy broker, got %d", len(healthy))
	}

	// Wait for TTL expiration
	time.Sleep(150 * time.Millisecond)
	healthyAfterTTL := reg.ListHealthy()
	if len(healthyAfterTTL) != 0 {
		t.Fatalf("expected 0 healthy brokers after TTL expiration, got %d", len(healthyAfterTTL))
	}

	// Heartbeat revives
	err := reg.Heartbeat("broker-india")
	if err != nil {
		t.Fatalf("unexpected error on heartbeat: %v", err)
	}
	if len(reg.ListHealthy()) != 1 {
		t.Fatalf("expected broker to be healthy again after heartbeat")
	}
}
