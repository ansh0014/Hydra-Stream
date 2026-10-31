package policy

import (
	"testing"
)

func TestPolicyEngine_ValidateTargetBroker(t *testing.T) {
	pe := NewPolicyEngine()

	tests := []struct {
		name         string
		topic        string
		brokerRegion string
		expectErr    bool
	}{
		{"EU data on Germany broker", "gdpr-user-audit", "Germany", false},
		{"EU data on India broker rejected", "gdpr-user-audit", "India", true},
		{"EU data on Singapore broker rejected", "eu-payments", "Singapore", true},
		{"India data on India broker", "upi-transactions", "India", false},
		{"India data on Germany broker rejected", "upi-transactions", "Germany", true},
		{"Singapore data on Singapore broker", "apac-fx", "Singapore", false},
		{"Global data on India broker", "telemetry", "India", false},
		{"Global data on Germany broker", "telemetry", "Germany", false},
		{"Inferred EU topic", "custom-eu-users", "Germany", false},
		{"Inferred EU topic rejected on India", "custom-eu-users", "India", true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := pe.ValidateTargetBroker(tt.topic, tt.brokerRegion)
			if (err != nil) != tt.expectErr {
				t.Errorf("ValidateTargetBroker(%q, %q) error = %v, expectErr %v", tt.topic, tt.brokerRegion, err, tt.expectErr)
			}
		})
	}
}
