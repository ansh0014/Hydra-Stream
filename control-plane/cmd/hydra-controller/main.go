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

	"github.com/hydra-stream/control-plane/pkg/config"
	"github.com/hydra-stream/control-plane/pkg/discovery"
	"github.com/hydra-stream/control-plane/pkg/metrics"
	"github.com/hydra-stream/control-plane/pkg/policy"
	"github.com/hydra-stream/control-plane/pkg/routing"
	"github.com/hydra-stream/control-plane/pkg/types"
)

type ControllerServer struct {
	cfg          *config.Config
	registry     *discovery.Registry
	policyEngine *policy.PolicyEngine
	router       *routing.Router
	etcdClient   *discovery.EtcdClient
	promClient   *metrics.PrometheusClient
}

func NewControllerServer(cfg *config.Config) *ControllerServer {
	reg := discovery.NewRegistry(30 * time.Second)
	pe := policy.NewPolicyEngine()
	r := routing.NewRouter(reg, pe)

	if cfg.SeedFallback {
		log.Println("[Hydra Controller] Pre-seeding fallback topology (SEED_FALLBACK=true)...")
		reg.Register(types.BrokerNode{
			ID:         "broker-india-1",
			Region:     "India",
			Endpoint:   "127.0.0.1:9092",
			HealthPort: 9092,
			Status:     "HEALTHY",
			RTT:        10 * time.Millisecond,
		})
		reg.Register(types.BrokerNode{
			ID:         "broker-germany-1",
			Region:     "Germany",
			Endpoint:   "127.0.0.1:9093",
			HealthPort: 9093,
			Status:     "HEALTHY",
			RTT:        85 * time.Millisecond,
		})
		reg.Register(types.BrokerNode{
			ID:         "broker-singapore-1",
			Region:     "Singapore",
			Endpoint:   "127.0.0.1:9094",
			HealthPort: 9094,
			Status:     "HEALTHY",
			RTT:        40 * time.Millisecond,
		})
	}

	return &ControllerServer{
		cfg:          cfg,
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

func (s *ControllerServer) handleMetrics(w http.ResponseWriter, r *http.Request) {
	brokers := s.registry.ListAll()
	healthyCount := 0
	degradedCount := 0
	for _, b := range brokers {
		if b.Status == "HEALTHY" {
			healthyCount++
		} else if b.Status == "DEGRADED" {
			degradedCount++
		}
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"active_brokers":   len(brokers),
		"healthy_brokers":  healthyCount,
		"degraded_brokers": degradedCount,
		"etcd_connected":   s.etcdClient != nil,
		"prom_connected":   s.promClient != nil,
		"timestamp":        time.Now().UTC().Format(time.RFC3339),
	})
}

type RouteRequest struct {
	Topic        string `json:"topic"`
	ClientRegion string `json:"client_region"`
}

func (s *ControllerServer) handleTopics(w http.ResponseWriter, r *http.Request) {
	topics := s.policyEngine.ListPolicies()
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"topics": topics,
		"count":  len(topics),
	})
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

func main() {
	envFile := flag.String("env", "config/hydra.env", "Path to environment config file")
	portFlag := flag.Int("port", 0, "Override port for HTTP API")
	etcdFlag := flag.String("etcd", "", "Override etcd v3 endpoint URLs (comma-separated)")
	promFlag := flag.String("prometheus", "", "Override Prometheus URL")
	seedFallbackFlag := flag.Bool("seed-fallback", false, "Override seed fallback flag")
	flag.Parse()

	// 1. Load config layered from file & environment
	cfg, err := config.LoadConfig(*envFile)
	if err != nil {
		log.Fatalf("Failed to load configuration: %v\n", err)
	}

	// Apply CLI overrides if explicitly passed
	if *portFlag > 0 {
		cfg.Port = *portFlag
	}
	if *etcdFlag != "" {
		cfg.EtcdEndpoints = []string{*etcdFlag}
	}
	if *promFlag != "" {
		cfg.PrometheusURL = *promFlag
	}
	if *seedFallbackFlag {
		cfg.SeedFallback = true
	}

	// Validate required environment settings
	if err := cfg.Validate(); err != nil {
		log.Fatalf("Configuration validation failed: %v\n", err)
	}

	log.Printf("[Hydra Controller] Starting with config: Port=%d, etcd=%v, Prometheus=%s\n",
		cfg.Port, cfg.EtcdEndpoints, cfg.PrometheusURL)

	server := NewControllerServer(cfg)
	ctx := context.Background()

	// 2. Start dynamic etcd watcher
	if cfg.EnableEtcd && len(cfg.EtcdEndpoints) > 0 {
		etcdCli, err := discovery.NewEtcdClient(cfg.EtcdEndpoints, 3*time.Second)
		if err != nil {
			log.Fatalf("Failed to initialize etcd client: %v\n", err)
		}
		server.etcdClient = etcdCli
		server.etcdClient.StartWatcher(ctx, server.registry, cfg.SyncInterval)
		log.Printf("[Hydra Controller] etcd dynamic discovery watcher active on %v\n", cfg.EtcdEndpoints)
	}

	// 3. Start live Prometheus metrics scraper
	if cfg.EnablePrometheus && cfg.PrometheusURL != "" {
		promCli, err := metrics.NewPrometheusClient(cfg.PrometheusURL, 3*time.Second)
		if err != nil {
			log.Fatalf("Failed to initialize prometheus client: %v\n", err)
		}
		server.promClient = promCli
		server.promClient.StartMetricsScraper(ctx, server.registry, cfg.SyncInterval)
		log.Printf("[Hydra Controller] Prometheus live metrics scraper active on %s\n", cfg.PrometheusURL)
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/health", server.handleHealth)
	mux.HandleFunc("/api/v1/health", server.handleHealth)
	mux.HandleFunc("/cluster/topology", server.handleTopology)
	mux.HandleFunc("/api/v1/topology", server.handleTopology)
	mux.HandleFunc("/cluster/topics", server.handleTopics)
	mux.HandleFunc("/api/v1/topics", server.handleTopics)
	mux.HandleFunc("/route/resolve", server.handleRouteResolve)
	mux.HandleFunc("/api/v1/route/resolve", server.handleRouteResolve)
	mux.HandleFunc("/api/v1/metrics", server.handleMetrics)

	// Wrap in CORS middleware
	corsHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}
		mux.ServeHTTP(w, r)
	})

	addr := fmt.Sprintf(":%d", cfg.Port)
	log.Printf("[Hydra Control Plane] Coordinator daemon listening on %s...\n", addr)
	if err := http.ListenAndServe(addr, corsHandler); err != nil {
		log.Fatalf("Server error: %v\n", err)
		os.Exit(1)
	}
}
