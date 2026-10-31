package routing

import (
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/hydra-stream/control-plane/pkg/discovery"
	"github.com/hydra-stream/control-plane/pkg/policy"
	"github.com/hydra-stream/control-plane/pkg/types"
)

var (
	ErrNoBrokersAvailable = errors.New("no healthy brokers available in cluster")
	ErrNoCompliantBroker  = errors.New("no broker satisfies legal residency requirements for topic")
)

const (
	SlowLinkLatencyThreshold = 200 * time.Millisecond
	SlowLinkLossThreshold    = 0.10 // 10% packet loss
)

// Router evaluates policy constraints and real-time metrics to produce optimal routing decisions.
type Router struct {
	registry     *discovery.Registry
	policyEngine *policy.PolicyEngine
}

// NewRouter constructs a new latency-aware, policy-compliant router.
func NewRouter(registry *discovery.Registry, policyEngine *policy.PolicyEngine) *Router {
	return &Router{
		registry:     registry,
		policyEngine: policyEngine,
	}
}

// ScoreBroker calculates link suitability based on latency and packet loss.
// Score = 1000.0 / (RTT_ms * (1 + Loss) + 1.0)
func (r *Router) ScoreBroker(broker types.BrokerNode, clientRegion string) float64 {
	rttMs := float64(broker.RTT.Milliseconds())
	if rttMs < 0.1 {
		rttMs = 0.5 // Base floor for intra-cluster/local loopback
	}

	loss := broker.PacketLoss
	if loss < 0.0 {
		loss = 0.0
	}

	score := 1000.0 / (rttMs*(1.0+loss) + 1.0)

	// Preference boost for intra-region locality when not degraded
	if strings.EqualFold(broker.Region, clientRegion) && broker.RTT < SlowLinkLatencyThreshold {
		score *= 1.25
	}

	return score
}

// ResolveRoute finds the best broker for a given topic and client origin.
func (r *Router) ResolveRoute(topic string, clientRegion string) (types.RouteDecision, error) {
	brokers := r.registry.ListHealthy()
	if len(brokers) == 0 {
		return types.RouteDecision{}, ErrNoBrokersAvailable
	}

	topicPolicy := r.policyEngine.GetPolicy(topic)

	var candidates []types.BrokerNode
	for _, b := range brokers {
		if err := r.policyEngine.ValidateTargetBroker(topic, b.Region); err == nil {
			candidates = append(candidates, b)
		}
	}

	if len(candidates) == 0 {
		return types.RouteDecision{
			Topic:  topic,
			Reason: fmt.Sprintf("Rejected: Legal residency for %q strictly requires region %q, but no healthy broker exists in that region", topic, topicPolicy.LegalRegion),
		}, ErrNoCompliantBroker
	}

	var bestBroker types.BrokerNode
	bestScore := -1.0
	hasSlowAlternative := false

	for _, candidate := range candidates {
		// Check if any candidate link is slow
		if candidate.RTT >= SlowLinkLatencyThreshold || candidate.PacketLoss >= SlowLinkLossThreshold {
			hasSlowAlternative = true
		}

		score := r.ScoreBroker(candidate, clientRegion)
		if score > bestScore {
			bestScore = score
			bestBroker = candidate
		}
	}

	bypassingSlowLink := false
	reason := fmt.Sprintf("Routed to broker %s (%s) based on latency score %.2f", bestBroker.ID, bestBroker.Region, bestScore)

	// If there were degraded options and we chose a fast path, or if local path is degraded and rerouted
	if hasSlowAlternative && bestBroker.RTT < SlowLinkLatencyThreshold {
		bypassingSlowLink = true
		reason = fmt.Sprintf("Bypassing degraded link (RTT >= 200ms or loss >= 10%%) -> Selected optimized path to %s (%s, RTT=%v)",
			bestBroker.ID, bestBroker.Region, bestBroker.RTT)
	}

	return types.RouteDecision{
		Topic:               topic,
		AssignedBrokerID:    bestBroker.ID,
		AssignedEndpoint:    bestBroker.Endpoint,
		Region:              bestBroker.Region,
		Score:               bestScore,
		IsBypassingSlowLink: bypassingSlowLink,
		Reason:              reason,
	}, nil
}
