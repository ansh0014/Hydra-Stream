package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/hydra-stream/control-plane/pkg/discovery"
	"github.com/hydra-stream/control-plane/pkg/policy"
	"github.com/hydra-stream/control-plane/pkg/routing"
	"github.com/hydra-stream/control-plane/pkg/types"
)

type ControllerServer struct {
	registry     *discovery.Registry
	policyEngine *policy.PolicyEngine
	router       *routing.Router
}

func NewControllerServer() *ControllerServer {
	reg := discovery.NewRegistry(30 * time.Second)
	pe := policy.NewPolicyEngine()
	r := routing.NewRouter(reg, pe)

	// Pre-seed default 3-region topology
	reg.Register(types.BrokerNode{
		ID:         "broker-india",
		Region:     "India",
		Endpoint:   "127.0.0.1:9092",
		HealthPort: 9092,
		Status:     "HEALTHY",
		RTT:        10 * time.Millisecond,
	})
	reg.Register(types.BrokerNode{
		ID:         "broker-germany",
		Region:     "Germany",
		Endpoint:   "127.0.0.1:9093",
		HealthPort: 9093,
		Status:     "HEALTHY",
		RTT:        85 * time.Millisecond,
	})
	reg.Register(types.BrokerNode{
		ID:         "broker-singapore",
		Region:     "Singapore",
		Endpoint:   "127.0.0.1:9094",
		HealthPort: 9094,
		Status:     "HEALTHY",
		RTT:        40 * time.Millisecond,
	})

	return &ControllerServer{
		registry:     reg,
		policyEngine: pe,
		router:       r,
	}
}

func (s *ControllerServer) handleHealth(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(map[string]string{
		"status":  "UP",
		"service": "hydra-controller",
		"version": "1.0.0",
	})
}

func (s *ControllerServer) handleTopology(w http.ResponseWriter, r *http.Request) {
	brokers := s.registry.ListAll()
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"brokers": brokers,
		"count":   len(brokers),
	})
}

type RouteRequest struct {
	Topic        string `json:"topic"`
	ClientRegion string `json:"client_region"`
}

func (s *ControllerServer) handleRouteResolve(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req RouteRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid JSON payload: "+err.Error(), http.StatusBadRequest)
		return
	}

	if req.Topic == "" {
		http.Error(w, "Missing required field: topic", http.StatusBadRequest)
		return
	}

	decision, err := s.router.ResolveRoute(req.Topic, req.ClientRegion)
	w.Header().Set("Content-Type", "application/json")

	if err != nil {
		w.WriteHeader(http.StatusForbidden) // 403 for policy/residency rejection or 503 for offline
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"error":    err.Error(),
			"decision": decision,
		})
		return
	}

	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(decision)
}

type LatencyInjectRequest struct {
	BrokerID string  `json:"broker_id"`
	RTTMs    int64   `json:"rtt_ms"`
	Loss     float64 `json:"packet_loss"`
	Status   string  `json:"status"`
}

func (s *ControllerServer) handleLatencyInject(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req LatencyInjectRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid JSON: "+err.Error(), http.StatusBadRequest)
		return
	}

	err := s.registry.UpdateMetrics(req.BrokerID, time.Duration(req.RTTMs)*time.Millisecond, req.Loss, req.Status)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]string{
		"message": fmt.Sprintf("Updated %s: RTT=%dms Loss=%.2f Status=%s", req.BrokerID, req.RTTMs, req.Loss, req.Status),
	})
}

func main() {
	port := flag.Int("port", 8080, "Port for Hydra Controller HTTP API")
	flag.Parse()

	server := NewControllerServer()

	http.HandleFunc("/health", server.handleHealth)
	http.HandleFunc("/cluster/topology", server.handleTopology)
	http.HandleFunc("/route/resolve", server.handleRouteResolve)
	http.HandleFunc("/simulation/latency", server.handleLatencyInject)

	addr := fmt.Sprintf(":%d", *port)
	log.Printf("[Hydra Control Plane] Starting coordinator daemon on %s...\n", addr)
	if err := http.ListenAndServe(addr, nil); err != nil {
		log.Fatalf("Server error: %v\n", err)
		os.Exit(1)
	}
}
