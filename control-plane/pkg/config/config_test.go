package config

import (
	"os"
	"path/filepath"
	"testing"
)

func TestLoadConfig_FromEnvAndFile(t *testing.T) {
	tmpDir := t.TempDir()
	envPath := filepath.Join(tmpDir, "test.env")

	envContent := `
# Hydra Test Config
CONTROLLER_PORT=8099
ETCD_ENDPOINTS=http://etcd-1:2379,http://etcd-2:2379
PROMETHEUS_URL=http://prom-server:9090
ENABLE_ETCD=true
ENABLE_PROMETHEUS=true
SEED_FALLBACK=false
LOG_LEVEL=debug
`
	if err := os.WriteFile(envPath, []byte(envContent), 0644); err != nil {
		t.Fatalf("failed to write test env: %v", err)
	}

	cfg, err := LoadConfig(envPath)
	if err != nil {
		t.Fatalf("LoadConfig failed: %v", err)
	}

	if cfg.Port != 8099 {
		t.Fatalf("expected port 8099, got %d", cfg.Port)
	}
	if len(cfg.EtcdEndpoints) != 2 || cfg.EtcdEndpoints[0] != "http://etcd-1:2379" {
		t.Fatalf("unexpected etcd endpoints: %v", cfg.EtcdEndpoints)
	}
	if cfg.PrometheusURL != "http://prom-server:9090" {
		t.Fatalf("unexpected prometheus url: %s", cfg.PrometheusURL)
	}
	if cfg.LogLevel != "debug" {
		t.Fatalf("unexpected log level: %s", cfg.LogLevel)
	}

	if err := cfg.Validate(); err != nil {
		t.Fatalf("validation failed unexpectedly: %v", err)
	}
}

func TestConfig_ValidationFailure(t *testing.T) {
	cfg := &Config{
		EnableEtcd:    true,
		EtcdEndpoints: nil, // missing
		SeedFallback:  false,
	}

	if err := cfg.Validate(); err == nil {
		t.Fatalf("expected validation error for missing etcd endpoints")
	}
}
