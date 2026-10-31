package discovery

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"io"
	"net/http"
	"testing"
	"time"

	"github.com/hydra-stream/control-plane/pkg/types"
)

type roundTripFunc func(req *http.Request) *http.Response

func (f roundTripFunc) RoundTrip(req *http.Request) (*http.Response, error) {
	return f(req), nil
}

func TestEtcdClient_GrantLeaseAndFetch(t *testing.T) {
	mockTransport := roundTripFunc(func(r *http.Request) *http.Response {
		header := make(http.Header)
		header.Set("Content-Type", "application/json")

		if r.URL.Path == "/v3/lease/grant" {
			resBytes, _ := json.Marshal(map[string]string{
				"ID": "12345678",
			})
			return &http.Response{
				StatusCode: http.StatusOK,
				Header:     header,
				Body:       io.NopCloser(bytes.NewReader(resBytes)),
			}
		}

		if r.URL.Path == "/v3/kv/put" {
			resBytes, _ := json.Marshal(map[string]interface{}{
				"header": map[string]int{"revision": 2},
			})
			return &http.Response{
				StatusCode: http.StatusOK,
				Header:     header,
				Body:       io.NopCloser(bytes.NewReader(resBytes)),
			}
		}

		if r.URL.Path == "/v3/kv/range" {
			node := types.BrokerNode{
				ID:       "broker-india-1",
				Region:   "India",
				Endpoint: "127.0.0.1:9092",
				Status:   "HEALTHY",
			}
			valBytes, _ := json.Marshal(node)
			resBytes, _ := json.Marshal(map[string]interface{}{
				"kvs": []map[string]string{
					{
						"key":   base64.StdEncoding.EncodeToString([]byte("/registry/brokers/broker-india-1")),
						"value": base64.StdEncoding.EncodeToString(valBytes),
					},
				},
			})
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

	client, err := NewEtcdClient([]string{"http://mock-etcd:2379"}, 2*time.Second)
	if err != nil {
		t.Fatalf("NewEtcdClient error: %v", err)
	}
	client.httpClient.Transport = mockTransport
	ctx := context.Background()

	leaseID, err := client.GrantLease(ctx, 5)
	if err != nil {
		t.Fatalf("GrantLease error: %v", err)
	}
	if leaseID != 12345678 {
		t.Fatalf("expected lease ID 12345678, got %d", leaseID)
	}

	node := types.BrokerNode{
		ID:       "broker-india-1",
		Region:   "India",
		Endpoint: "127.0.0.1:9092",
	}
	err = client.PutNode(ctx, node, leaseID)
	if err != nil {
		t.Fatalf("PutNode error: %v", err)
	}

	brokers, err := client.FetchBrokers(ctx)
	if err != nil {
		t.Fatalf("FetchBrokers error: %v", err)
	}
	if len(brokers) != 1 || brokers[0].ID != "broker-india-1" {
		t.Fatalf("expected 1 broker, got: %+v", brokers)
	}
}

func TestEtcdClient_MissingEndpointsError(t *testing.T) {
	_, err := NewEtcdClient(nil, 1*time.Second)
	if err == nil {
		t.Fatalf("expected error when no endpoints provided and ETCD_ENDPOINTS is empty")
	}
}
