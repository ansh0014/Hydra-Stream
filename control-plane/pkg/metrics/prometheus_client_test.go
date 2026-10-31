package metrics

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"testing"
	"time"
)

type roundTripFunc func(req *http.Request) *http.Response

func (f roundTripFunc) RoundTrip(req *http.Request) (*http.Response, error) {
	return f(req), nil
}

func TestPrometheusClient_QueryRTTSeconds(t *testing.T) {
	mockTransport := roundTripFunc(func(r *http.Request) *http.Response {
		header := make(http.Header)
		header.Set("Content-Type", "application/json")

		if r.URL.Path == "/api/v1/query" {
			res := PromQueryResult{
				Status: "success",
			}
			res.Data.ResultType = "vector"
			res.Data.Result = []struct {
				Metric map[string]string `json:"metric"`
				Value  []interface{}     `json:"value"`
			}{
				{
					Metric: map[string]string{"broker_id": "broker-india"},
					Value:  []interface{}{1730419200, "0.0125"}, // 12.5 milliseconds
				},
			}
			resBytes, _ := json.Marshal(res)
			return &http.Response{
				StatusCode: http.StatusOK,
				Header:     header,
				Body:       io.NopCloser(bytes.NewReader(resBytes)),
			}
		}

		return &http.Response{
			StatusCode: http.StatusNotFound,
			Header:     header,
			Body:       io.NopCloser(bytes.NewReader([]byte("{}"))),
		}
	})

	client, err := NewPrometheusClient("http://mock-prometheus:9090", 2*time.Second)
	if err != nil {
		t.Fatalf("NewPrometheusClient error: %v", err)
	}
	client.httpClient.Transport = mockTransport
	ctx := context.Background()

	rtt, err := client.QueryRTTSeconds(ctx, "broker-india")
	if err != nil {
		t.Fatalf("QueryRTTSeconds failed: %v", err)
	}

	expectedMs := int64(12)
	if rtt.Milliseconds() != expectedMs {
		t.Fatalf("expected ~12ms RTT, got %v", rtt)
	}
}

func TestPrometheusClient_MissingURLError(t *testing.T) {
	_, err := NewPrometheusClient("", 1*time.Second)
	if err == nil {
		t.Fatalf("expected error when serverURL is empty and PROMETHEUS_URL is not set")
	}
}
