package types

import "time"

// BrokerNode represents an active broker registered dynamically in the cluster.
type BrokerNode struct {
	ID            string        `json:"id"`
	Region        string        `json:"region"` // "India", "Germany", "Singapore"
	Endpoint      string        `json:"endpoint"`
	HealthPort    int           `json:"health_port"`
	Status        string        `json:"status"` // "HEALTHY", "DEGRADED", "OFFLINE"
	RTT           time.Duration `json:"rtt"`
	PacketLoss    float64       `json:"packet_loss"`
	LastHeartbeat time.Time     `json:"last_heartbeat"`
}

// TopicPolicy defines governance and legal residency rules for a topic.
type TopicPolicy struct {
	Name         string `json:"name"`
	LegalRegion  string `json:"legal_region"` // "Germany", "India", "Singapore", or "ANY"
	Partitions   int    `json:"partitions"`
}

// RouteDecision is the result of policy validation and latency-aware route selection.
type RouteDecision struct {
	Topic               string  `json:"topic"`
	AssignedBrokerID    string  `json:"assigned_broker_id"`
	AssignedEndpoint    string  `json:"assigned_endpoint"`
	Region              string  `json:"region"`
	Score               float64 `json:"score"`
	IsBypassingSlowLink bool    `json:"is_bypassing_slow_link"`
	Reason              string  `json:"reason"`
}
