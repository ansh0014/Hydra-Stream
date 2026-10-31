package metrics

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"time"

	"github.com/hydra-stream/control-plane/pkg/discovery"
)

// PrometheusClient queries the Prometheus HTTP API v1 to fetch live latency and packet loss.
type PrometheusClient struct {
	serverURL  string
	httpClient *http.Client
}

func NewPrometheusClient(serverURL string, timeout time.Duration) *PrometheusClient {
	if serverURL == "" {
		serverURL = "http://127.0.0.1:9090"
	}
	if timeout <= 0 {
		timeout = 3 * time.Second
	}
	return &PrometheusClient{
		serverURL: serverURL,
		httpClient: &http.Client{
			Timeout: timeout,
		},
	}
}

type PromQueryResult struct {
	Status string `json:"status"`
	Data   struct {
		ResultType string `json:"resultType"`
		Result     []struct {
			Metric map[string]string `json:"metric"`
			Value  []interface{}     `json:"value"` // [timestamp, "value_string"]
		} `json:"result"`
	} `json:"data"`
}

// QueryRTTSeconds queries Prometheus for inter-broker or client-broker probe duration.
func (p *PrometheusClient) QueryRTTSeconds(ctx context.Context, brokerID string) (time.Duration, error) {
	// PromQL query targeting probe duration for specified broker
	query := fmt.Sprintf(`hydra_broker_ping_rtt_seconds{broker_id="%s"}`, brokerID)
	endpoint := fmt.Sprintf("%s/api/v1/query?query=%s", p.serverURL, url.QueryEscape(query))

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return 0, err
	}

	resp, err := p.httpClient.Do(req)
	if err != nil {
		return 0, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return 0, fmt.Errorf("prometheus query failed with status %d", resp.StatusCode)
	}

	var res PromQueryResult
	if err := json.NewDecoder(resp.Body).Decode(&res); err != nil {
		return 0, err
	}

	if len(res.Data.Result) == 0 {
		return 0, fmt.Errorf("no metric data found for broker %s", brokerID)
	}

	valStr, ok := res.Data.Result[0].Value[1].(string)
	if !ok {
		return 0, fmt.Errorf("invalid value format in prometheus response")
	}

	seconds, err := strconv.ParseFloat(valStr, 64)
	if err != nil {
		return 0, err
	}

	return time.Duration(seconds * float64(time.Second)), nil
}

// StartMetricsScraper periodically queries Prometheus and updates the Discovery Registry.
func (p *PrometheusClient) StartMetricsScraper(ctx context.Context, reg *discovery.Registry, interval time.Duration) {
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
				brokers := reg.ListAll()
				for _, b := range brokers {
					rtt, err := p.QueryRTTSeconds(ctx, b.ID)
					if err == nil {
						status := "HEALTHY"
						if rtt > 200*time.Millisecond {
							status = "DEGRADED"
						}
						_ = reg.UpdateMetrics(b.ID, rtt, b.PacketLoss, status)
					}
				}
			}
		}
	}()
}
