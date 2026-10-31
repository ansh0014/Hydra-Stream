package config

import (
	"bufio"
	"errors"
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"
)

var (
	ErrMissingEtcdEndpoints = errors.New("configuration error: ETCD_ENDPOINTS is required and cannot be empty")
	ErrMissingPrometheusURL = errors.New("configuration error: PROMETHEUS_URL is required and cannot be empty")
)

// Config represents runtime configuration for the Hydra Control Plane.
type Config struct {
	Port             int           `json:"port"`
	EtcdEndpoints    []string      `json:"etcd_endpoints"`
	PrometheusURL    string        `json:"prometheus_url"`
	EnableEtcd       bool          `json:"enable_etcd"`
	EnablePrometheus bool          `json:"enable_prometheus"`
	SeedFallback     bool          `json:"seed_fallback"`
	SyncInterval     time.Duration `json:"sync_interval"`
	LogLevel         string        `json:"log_level"`
}

// LoadEnvFile parses a .env or key-value config file and loads it into os.Environ if not already set.
func LoadEnvFile(path string) error {
	f, err := os.Open(path)
	if err != nil {
		if os.IsNotExist(err) {
			return nil // Optional file
		}
		return err
	}
	defer f.Close()

	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if len(line) == 0 || strings.HasPrefix(line, "#") {
			continue
		}
		parts := strings.SplitN(line, "=", 2)
		if len(parts) == 2 {
			k := strings.TrimSpace(parts[0])
			v := strings.TrimSpace(parts[1])
			// Strip surrounding quotes
			v = strings.Trim(v, `"'`)
			if os.Getenv(k) == "" {
				_ = os.Setenv(k, v)
			}
		}
	}
	return scanner.Err()
}

// GetEnv retrieves an environment variable or returns the provided default.
func GetEnv(key, def string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return def
}

// GetEnvBool retrieves a boolean environment variable.
func GetEnvBool(key string, def bool) bool {
	if val := os.Getenv(key); val != "" {
		lower := strings.ToLower(val)
		return lower == "true" || lower == "1" || lower == "yes"
	}
	return def
}

// GetEnvInt retrieves an integer environment variable.
func GetEnvInt(key string, def int) int {
	if val := os.Getenv(key); val != "" {
		if i, err := strconv.Atoi(val); err == nil {
			return i
		}
	}
	return def
}

// LoadConfig resolves configuration by layering:
// 1. Config file (.env / hydra.env)
// 2. System Environment variables
// 3. Command-line flag overrides
func LoadConfig(envFilePath string) (*Config, error) {
	if envFilePath != "" {
		_ = LoadEnvFile(envFilePath)
	}

	port := GetEnvInt("CONTROLLER_PORT", 8080)
	etcdRaw := GetEnv("ETCD_ENDPOINTS", "")
	promURL := GetEnv("PROMETHEUS_URL", "")
	enableEtcd := GetEnvBool("ENABLE_ETCD", true)
	enableProm := GetEnvBool("ENABLE_PROMETHEUS", true)
	seedFallback := GetEnvBool("SEED_FALLBACK", false)
	logLevel := GetEnv("LOG_LEVEL", "info")

	var etcdEndpoints []string
	if etcdRaw != "" {
		for _, ep := range strings.Split(etcdRaw, ",") {
			trimmed := strings.TrimSpace(ep)
			if trimmed != "" {
				etcdEndpoints = append(etcdEndpoints, trimmed)
			}
		}
	}

	cfg := &Config{
		Port:             port,
		EtcdEndpoints:    etcdEndpoints,
		PrometheusURL:    promURL,
		EnableEtcd:       enableEtcd,
		EnablePrometheus: enableProm,
		SeedFallback:     seedFallback,
		SyncInterval:     2 * time.Second,
		LogLevel:         logLevel,
	}

	return cfg, nil
}

// Validate ensures all mandatory runtime dependencies are configured.
func (c *Config) Validate() error {
	if c.EnableEtcd && len(c.EtcdEndpoints) == 0 && !c.SeedFallback {
		return fmt.Errorf("%w: pass ETCD_ENDPOINTS via environment or --etcd flag", ErrMissingEtcdEndpoints)
	}
	if c.EnablePrometheus && c.PrometheusURL == "" && !c.SeedFallback {
		return fmt.Errorf("%w: pass PROMETHEUS_URL via environment or --prometheus flag", ErrMissingPrometheusURL)
	}
	return nil
}
