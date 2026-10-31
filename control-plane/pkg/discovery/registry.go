package discovery

import (
	"errors"
	"sync"
	"time"

	"github.com/hydra-stream/control-plane/pkg/types"
)

var (
	ErrBrokerNotFound = errors.New("broker not registered in cluster")
)

type EventType string

const (
	EventBrokerRegistered EventType = "REGISTERED"
	EventBrokerUpdated    EventType = "UPDATED"
	EventBrokerOffline    EventType = "OFFLINE"
)

type RegistryEvent struct {
	Type   EventType
	Broker types.BrokerNode
}

// Registry manages cluster membership and node health for Hydra brokers.
type Registry struct {
	mu           sync.RWMutex
	brokers      map[string]types.BrokerNode
	subscribers  []chan RegistryEvent
	subMu        sync.Mutex
	heartbeatTTL time.Duration
}

// NewRegistry creates a new broker registry.
func NewRegistry(heartbeatTTL time.Duration) *Registry {
	if heartbeatTTL <= 0 {
		heartbeatTTL = 10 * time.Second
	}
	r := &Registry{
		brokers:      make(map[string]types.BrokerNode),
		heartbeatTTL: heartbeatTTL,
	}
	return r
}

// Register registers or refreshes a broker.
func (r *Registry) Register(broker types.BrokerNode) {
	r.mu.Lock()
	defer r.mu.Unlock()

	broker.LastHeartbeat = time.Now()
	if broker.Status == "" {
		broker.Status = "HEALTHY"
	}
	r.brokers[broker.ID] = broker

	r.notify(RegistryEvent{
		Type:   EventBrokerRegistered,
		Broker: broker,
	})
}

// Heartbeat refreshes the last seen timestamp for a broker.
func (r *Registry) Heartbeat(brokerID string) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	node, exists := r.brokers[brokerID]
	if !exists {
		return ErrBrokerNotFound
	}

	node.LastHeartbeat = time.Now()
	if node.Status == "OFFLINE" {
		node.Status = "HEALTHY"
	}
	r.brokers[brokerID] = node
	return nil
}

// UpdateMetrics updates RTT and packet loss for dynamic routing calculations.
func (r *Registry) UpdateMetrics(brokerID string, rtt time.Duration, loss float64, status string) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	node, exists := r.brokers[brokerID]
	if !exists {
		return ErrBrokerNotFound
	}

	node.RTT = rtt
	node.PacketLoss = loss
	if status != "" {
		node.Status = status
	}
	node.LastHeartbeat = time.Now()
	r.brokers[brokerID] = node

	r.notify(RegistryEvent{
		Type:   EventBrokerUpdated,
		Broker: node,
	})
	return nil
}

// GetBroker retrieves a broker by ID.
func (r *Registry) GetBroker(id string) (types.BrokerNode, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	b, ok := r.brokers[id]
	return b, ok
}

// ListAll returns all registered brokers.
func (r *Registry) ListAll() []types.BrokerNode {
	r.mu.RLock()
	defer r.mu.RUnlock()

	result := make([]types.BrokerNode, 0, len(r.brokers))
	for _, b := range r.brokers {
		result = append(result, b)
	}
	return result
}

// ListHealthy returns all brokers considered alive and not OFFLINE.
func (r *Registry) ListHealthy() []types.BrokerNode {
	r.mu.RLock()
	defer r.mu.RUnlock()

	now := time.Now()
	result := make([]types.BrokerNode, 0, len(r.brokers))
	for _, b := range r.brokers {
		if b.Status == "OFFLINE" {
			continue
		}
		if now.Sub(b.LastHeartbeat) > r.heartbeatTTL {
			continue
		}
		result = append(result, b)
	}
	return result
}

// Subscribe returns an event channel for registry updates.
func (r *Registry) Subscribe() <-chan RegistryEvent {
	r.subMu.Lock()
	defer r.subMu.Unlock()

	ch := make(chan RegistryEvent, 16)
	r.subscribers = append(r.subscribers, ch)
	return ch
}

func (r *Registry) notify(event RegistryEvent) {
	r.subMu.Lock()
	defer r.subMu.Unlock()

	for _, ch := range r.subscribers {
		select {
		case ch <- event:
		default:
			// Non-blocking drop if consumer buffer is full
		}
	}
}
