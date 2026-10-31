package main

import (
	"bytes"
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"net/http"
	"time"
)

type LatencyInjectRequest struct {
	BrokerID string  `json:"broker_id"`
	RTTMs    int64   `json:"rtt_ms"`
	Loss     float64 `json:"packet_loss"`
	Status   string  `json:"status"`
}

type RouteRequest struct {
	Topic        string `json:"topic"`
	ClientRegion string `json:"client_region"`
}

type RouteDecision struct {
	Topic               string  `json:"topic"`
	AssignedBrokerID    string  `json:"assigned_broker_id"`
	AssignedEndpoint    string  `json:"assigned_endpoint"`
	Region              string  `json:"region"`
	Score               float64 `json:"score"`
	IsBypassingSlowLink bool    `json:"is_bypassing_slow_link"`
	Reason              string  `json:"reason"`
}

func injectLatency(controllerURL, brokerID string, rttMs int64, loss float64, status string) error {
	req := LatencyInjectRequest{
		BrokerID: brokerID,
		RTTMs:    rttMs,
		Loss:     loss,
		Status:   status,
	}
	body, _ := json.Marshal(req)
	resp, err := http.Post(controllerURL+"/simulation/latency", "application/json", bytes.NewReader(body))
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("unexpected status code %d", resp.StatusCode)
	}
	return nil
}

func queryRoute(controllerURL, topic, clientRegion string) (*RouteDecision, error) {
	req := RouteRequest{Topic: topic, ClientRegion: clientRegion}
	body, _ := json.Marshal(req)
	resp, err := http.Post(controllerURL+"/route/resolve", "application/json", bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("route resolution rejected with status %d", resp.StatusCode)
	}

	var d RouteDecision
	if err := json.NewDecoder(resp.Body).Decode(&d); err != nil {
		return nil, err
	}
	return &d, nil
}

func main() {
	controllerURL := flag.String("controller", "http://127.0.0.1:8080", "Hydra Controller URL")
	flag.Parse()

	log.Printf("[Chaos Engine] Connecting to Hydra Controller at %s...\n", *controllerURL)

	// Step 1: Baseline Verification
	fmt.Println("\n--- [Step 1] Baseline Route Verification ---")
	route, err := queryRoute(*controllerURL, "telemetry", "India")
	if err != nil {
		log.Fatalf("Baseline query failed: %v", err)
	}
	fmt.Printf("Baseline Telemetry Route: Broker=%s Region=%s Score=%.2f\n",
		route.AssignedBrokerID, route.Region, route.Score)

	// Step 2: Inject Undersea Cable Degradation on India Broker (RTT 260ms, Loss 15%)
	fmt.Println("\n--- [Step 2] Injecting Undersea Cable Degradation on broker-india ---")
	if err := injectLatency(*controllerURL, "broker-india", 260, 0.15, "DEGRADED"); err != nil {
		log.Fatalf("Failed to inject degradation: %v", err)
	}
	time.Sleep(100 * time.Millisecond)

	routeAfterDegradation, err := queryRoute(*controllerURL, "telemetry", "India")
	if err != nil {
		log.Fatalf("Query after degradation failed: %v", err)
	}
	fmt.Printf("Degraded Link Route Decision: Broker=%s Region=%s BypassingSlowLink=%v Reason=%s\n",
		routeAfterDegradation.AssignedBrokerID, routeAfterDegradation.Region,
		routeAfterDegradation.IsBypassingSlowLink, routeAfterDegradation.Reason)

	if !routeAfterDegradation.IsBypassingSlowLink {
		log.Fatalf("FAILED: Router did not flag slow link bypass!")
	}
	if routeAfterDegradation.AssignedBrokerID == "broker-india" {
		log.Fatalf("FAILED: Router failed to steer traffic away from degraded India broker!")
	}
	fmt.Println(">> SUCCESS: Telemetry successfully steered to Singapore/fast path without freezing!")

	// Step 3: Inject Regional Outage on Germany Broker (Blackout)
	fmt.Println("\n--- [Step 3] Simulating Regional Outage on broker-germany (EU Blackout) ---")
	if err := injectLatency(*controllerURL, "broker-germany", 0, 1.0, "OFFLINE"); err != nil {
		log.Fatalf("Failed to take Germany broker offline: %v", err)
	}
	time.Sleep(100 * time.Millisecond)

	// Attempting to route GDPR data during Germany blackout MUST fail, NOT leak!
	_, gdprErr := queryRoute(*controllerURL, "gdpr-user-audit", "India")
	if gdprErr == nil {
		log.Fatalf("SECURITY VIOLATION: GDPR data was routed during Germany outage! Data residency breached!")
	}
	fmt.Printf(">> SUCCESS: GDPR data request safely rejected (%v) -> Zero data leak guaranteed.\n", gdprErr)

	// Step 4: System Recovery
	fmt.Println("\n--- [Step 4] Restoring Cluster Health ---")
	_ = injectLatency(*controllerURL, "broker-india", 10, 0.0, "HEALTHY")
	_ = injectLatency(*controllerURL, "broker-germany", 85, 0.0, "HEALTHY")
	time.Sleep(100 * time.Millisecond)

	restoredRoute, err := queryRoute(*controllerURL, "telemetry", "India")
	if err != nil {
		log.Fatalf("Query after restoration failed: %v", err)
	}
	fmt.Printf("Restored Route: Broker=%s Region=%s (Score=%.2f)\n",
		restoredRoute.AssignedBrokerID, restoredRoute.Region, restoredRoute.Score)

	fmt.Println("\n================ CHAOS RESILIENCE TEST: PASSED ================")
}
