package policy

import (
	"errors"
	"strings"
	"sync"

	"github.com/hydra-stream/control-plane/pkg/types"
)

var (
	ErrResidencyViolation = errors.New("legal data residency violation: topic data cannot leave designated jurisdiction")
	ErrPolicyNotFound     = errors.New("policy not found for specified topic")
)

// PolicyEngine maintains topic governance rules and validates compliance.
type PolicyEngine struct {
	mu       sync.RWMutex
	policies map[string]types.TopicPolicy
}

// NewPolicyEngine initializes the policy engine with standard geo-residency rules.
func NewPolicyEngine() *PolicyEngine {
	pe := &PolicyEngine{
		policies: make(map[string]types.TopicPolicy),
	}
	pe.loadDefaultPolicies()
	return pe
}

func (pe *PolicyEngine) loadDefaultPolicies() {
	// Standard regional jurisdictions
	defaults := []types.TopicPolicy{
		{Name: "gdpr-user-audit", LegalRegion: "Germany", Partitions: 4},
		{Name: "eu-payments", LegalRegion: "Germany", Partitions: 4},
		{Name: "orders-germany", LegalRegion: "Germany", Partitions: 4},

		{Name: "upi-transactions", LegalRegion: "India", Partitions: 4},
		{Name: "india-kyc", LegalRegion: "India", Partitions: 4},
		{Name: "orders-india", LegalRegion: "India", Partitions: 4},

		{Name: "apac-fx", LegalRegion: "Singapore", Partitions: 4},
		{Name: "orders-singapore", LegalRegion: "Singapore", Partitions: 4},

		{Name: "telemetry", LegalRegion: "ANY", Partitions: 8},
		{Name: "global-logs", LegalRegion: "ANY", Partitions: 8},
	}

	for _, p := range defaults {
		pe.policies[p.Name] = p
	}
}

// RegisterPolicy registers or updates governance policy for a topic.
func (pe *PolicyEngine) RegisterPolicy(policy types.TopicPolicy) {
	pe.mu.Lock()
	defer pe.mu.Unlock()
	pe.policies[policy.Name] = policy
}

// GetPolicy retrieves the policy for a topic. If not explicitly registered,
// it applies inferential heuristics (e.g. topic prefix/suffix) or defaults to ANY.
func (pe *PolicyEngine) GetPolicy(topic string) types.TopicPolicy {
	pe.mu.RLock()
	p, exists := pe.policies[topic]
	pe.mu.RUnlock()

	if exists {
		return p
	}

	// Heuristic inferences based on naming
	lower := strings.ToLower(topic)
	if strings.Contains(lower, "gdpr") || strings.Contains(lower, "germany") || strings.Contains(lower, "eu-") {
		return types.TopicPolicy{Name: topic, LegalRegion: "Germany", Partitions: 4}
	}
	if strings.Contains(lower, "upi") || strings.Contains(lower, "india") {
		return types.TopicPolicy{Name: topic, LegalRegion: "India", Partitions: 4}
	}
	if strings.Contains(lower, "singapore") || strings.Contains(lower, "apac") {
		return types.TopicPolicy{Name: topic, LegalRegion: "Singapore", Partitions: 4}
	}

	return types.TopicPolicy{Name: topic, LegalRegion: "ANY", Partitions: 4}
}

// ValidateTargetBroker checks if targetBrokerRegion satisfies the legal jurisdiction for the topic.
func (pe *PolicyEngine) ValidateTargetBroker(topic string, targetBrokerRegion string) error {
	policy := pe.GetPolicy(topic)
	if policy.LegalRegion == "ANY" || policy.LegalRegion == "" {
		return nil
	}

	if !strings.EqualFold(policy.LegalRegion, targetBrokerRegion) {
		return ErrResidencyViolation
	}
	return nil
}
