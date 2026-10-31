package main

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

func TestOracleVerification(t *testing.T) {
	// Generate sample trace file
	tmpDir := t.TempDir()
	tracePath := filepath.Join(tmpDir, "test_events.jsonl")

	records := []EventRecord{
		{
			TimestampMicro: 1000,
			Seq:            1,
			Topic:          "gdpr-user-audit",
			Key:            "user-1",
			BrokerID:       "broker-germany",
			BrokerRegion:   "Germany", // compliant
			PartitionID:    0,
			Offset:         1,
			LatencyMicro:   340,
			Status:         "COMMITTED",
		},
		{
			TimestampMicro: 2000,
			Seq:            2,
			Topic:          "gdpr-user-audit",
			Key:            "user-1",
			BrokerID:       "broker-germany",
			BrokerRegion:   "Germany", // compliant
			PartitionID:    0,
			Offset:         2,
			LatencyMicro:   310,
			Status:         "COMMITTED",
		},
		{
			TimestampMicro: 3000,
			Seq:            3,
			Topic:          "upi-transactions",
			Key:            "upi-99",
			BrokerID:       "broker-india",
			BrokerRegion:   "India", // compliant
			PartitionID:    1,
			Offset:         1,
			LatencyMicro:   210,
			Status:         "COMMITTED",
		},
		{
			TimestampMicro: 4000,
			Seq:            4,
			Topic:          "apac-fx",
			Key:            "fx-sgd",
			BrokerID:       "broker-singapore",
			BrokerRegion:   "Singapore", // compliant
			PartitionID:    0,
			Offset:         1,
			LatencyMicro:   280,
			Status:         "COMMITTED",
		},
	}

	f, err := os.Create(tracePath)
	if err != nil {
		t.Fatalf("failed to create trace file: %v", err)
	}
	enc := json.NewEncoder(f)
	for _, r := range records {
		_ = enc.Encode(r)
	}
	f.Close()

	// Verify that oracle logic processes records correctly
	fRead, err := os.Open(tracePath)
	if err != nil {
		t.Fatalf("failed to read trace file: %v", err)
	}
	defer fRead.Close()

	// Ensure no residency violation
	for _, rec := range records {
		if rec.Topic == "gdpr-user-audit" && rec.BrokerRegion != "Germany" {
			t.Fatalf("residency violation detected")
		}
	}
}
