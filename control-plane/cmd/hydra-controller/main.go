package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/hydra-stream/control-plane/pkg/discovery"
	"github.com/hydra-stream/control-plane/pkg/metrics"
	"github.com/hydra-stream/control-plane/pkg/policy"
	"github.com/hydra-stream/control-plane/pkg/routing"
	"github.com/hydra-stream/control-plane/pkg/types"
)

type ControllerServer struct {
	registry     *discovery.Registry
	policyEngine *policy.PolicyEngine
	router       *routing.Router
	etcdClient   *discovery.EtcdClient
	promClient   *metrics.PrometheusClient
}

func NewControllerServer(seedDefaults bool) *ControllerServer {
	reg := discovery.NewRegistry(30 * time.Second)
	pe := policy.NewPolicyEngine()
	r := routing.NewRouter(reg, pe)

	if seedDefaults {
		// Fallback seed topology when running without live etcd cluster
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
	}

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
	etcdEndpoint := flag.String("etcd", "http://127.0.0.1:2379", "etcd v3 endpoint URL")
	promEndpoint := flag.String("prometheus", "http://127.0.0.1:9090", "Prometheus API endpoint URL")
	enableEtcd := flag.Bool("enable-etcd", true, "Enable dynamic discovery via etcd watcher")
	enableProm := flag.Bool("enable-prom", true, "Enable live latency scraping via Prometheus")
	seedFallback := flag.Bool("seed-fallback", true, "Pre-seed fallback topology if external cluster is offline")
	flag.Parse()

	server := NewControllerServer(*seedFallback)
	ctx := context.Background()

	// 1. Open Source Integration: etcd dynamic discovery watcher
	if *enableEtcd {
		log.Printf("[Hydra Controller] Connecting to etcd v3 at %s...\n", *etcdEndpoint)
		server.etcdClient = discovery.NewEtcdClient([]string{*etcdEndpoint}, 3*time.Second)
		server.etcdClient.StartWatcher(ctx, server.registry, 2*time.Second)
	}

	// 2. Open Source Integration: Prometheus live link latency scraper
	if *enableProm {
		log.Printf("[Hydra Controller] Connecting to Prometheus at %s...\n", *promEndpoint)
		server.promClient = metrics.NewPrometheusClient(*promEndpoint, 3*time.Second)
		server.promClient.StartMetricsScraper(ctx, server.registry, 2*time.Second)
	}

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
