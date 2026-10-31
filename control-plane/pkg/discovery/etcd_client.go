package discovery

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/hydra-stream/control-plane/pkg/types"
)

// EtcdClient provides a direct, dependency-free client for etcd v3
// using etcd's official gRPC-HTTP Gateway API.
type EtcdClient struct {
	endpoints  []string
	httpClient *http.Client
	mu         sync.RWMutex
}

// NewEtcdClient initializes an etcd client using provided endpoints or ETCD_ENDPOINTS environment variable.
// Returns an error if no endpoints are provided or found in the environment.
func NewEtcdClient(endpoints []string, timeout time.Duration) (*EtcdClient, error) {
	if len(endpoints) == 0 {
		if envVal := os.Getenv("ETCD_ENDPOINTS"); envVal != "" {
			for _, ep := range strings.Split(envVal, ",") {
				if t := strings.TrimSpace(ep); t != "" {
					endpoints = append(endpoints, t)
				}
			}
		}
	}

	if len(endpoints) == 0 {
		return nil, errors.New("cannot initialize etcd client: no endpoints provided or configured in ETCD_ENDPOINTS")
	}

	if timeout <= 0 {
		timeout = 5 * time.Second
	}
	return &EtcdClient{
		endpoints: endpoints,
		httpClient: &http.Client{
			Timeout: timeout,
		},
	}, nil
}

// GrantLease creates a dynamic lease with TTL seconds.
func (c *EtcdClient) GrantLease(ctx context.Context, ttlSeconds int64) (int64, error) {
	reqBody, _ := json.Marshal(map[string]int64{
		"TTL": ttlSeconds,
	})

	url := fmt.Sprintf("%s/v3/lease/grant", c.endpoints[0])
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(reqBody))
	if err != nil {
		return 0, err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return 0, fmt.Errorf("failed to contact etcd at %s: %w", url, err)
	}
	defer resp.Body.Close()

	var result struct {
		ID string `json:"ID"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return 0, err
	}

	var leaseID int64
	_, _ = fmt.Sscanf(result.ID, "%d", &leaseID)
	return leaseID, nil
}

// PutNode registers a broker under /registry/brokers/<id> with an optional lease.
func (c *EtcdClient) PutNode(ctx context.Context, node types.BrokerNode, leaseID int64) error {
	key := fmt.Sprintf("/registry/brokers/%s", node.ID)
	valBytes, err := json.Marshal(node)
	if err != nil {
		return err
	}

	payload := map[string]interface{}{
		"key":   base64.StdEncoding.EncodeToString([]byte(key)),
		"value": base64.StdEncoding.EncodeToString(valBytes),
	}
	if leaseID > 0 {
		payload["lease"] = fmt.Sprintf("%d", leaseID)
	}

	reqBody, _ := json.Marshal(payload)
	url := fmt.Sprintf("%s/v3/kv/put", c.endpoints[0])
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(reqBody))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to register node with etcd: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("etcd put failed (%d): %s", resp.StatusCode, string(body))
	}
	return nil
}

// FetchBrokers queries all registered brokers under /registry/brokers/ prefix.
func (c *EtcdClient) FetchBrokers(ctx context.Context) ([]types.BrokerNode, error) {
	key := "/registry/brokers/"
	// range_end calculated for prefix matching
	rangeEnd := "/registry/brokers0"

	payload := map[string]string{
		"key":       base64.StdEncoding.EncodeToString([]byte(key)),
		"range_end": base64.StdEncoding.EncodeToString([]byte(rangeEnd)),
	}

	reqBody, _ := json.Marshal(payload)
	url := fmt.Sprintf("%s/v3/kv/range", c.endpoints[0])
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(reqBody))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to query etcd /registry/brokers/: %w", err)
	}
	defer resp.Body.Close()

	var result struct {
		Kvs []struct {
			Key   string `json:"key"`
			Value string `json:"value"`
		} `json:"kvs"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	var brokers []types.BrokerNode
	for _, kv := range result.Kvs {
		decodedVal, err := base64.StdEncoding.DecodeString(kv.Value)
		if err != nil {
			continue
		}
		var node types.BrokerNode
		if err := json.Unmarshal(decodedVal, &node); err == nil {
			brokers = append(brokers, node)
		}
	}
	return brokers, nil
}

// StartWatcher starts a periodic reconciliation loop that synchronizes etcd with local registry.
func (c *EtcdClient) StartWatcher(ctx context.Context, reg *Registry, interval time.Duration) {
	if interval <= 0 {
		interval = 2 * time.Second
	}
	ticker := time.NewTicker(interval)

	go func() {
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				brokers, err := c.FetchBrokers(ctx)
				if err != nil {
					// Connection error (etcd starting up or offline)
					continue
				}
				for _, b := range brokers {
					if strings.TrimSpace(b.ID) != "" {
						reg.Register(b)
					}
				}
			}
		}
	}()
}
