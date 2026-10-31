package main

import (
	"bufio"
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"os"
	"sort"
	"strings"
)

type EventRecord struct {
	TimestampMicro int64  `json:"timestamp_us"`
	Seq            int    `json:"seq"`
	Topic          string `json:"topic"`
	Key            string `json:"key"`
	BrokerID       string `json:"broker_id"`
	BrokerRegion   string `json:"broker_region"`
	PartitionID    uint32 `json:"partition_id"`
	Offset         uint64 `json:"offset"`
	LatencyMicro   int64  `json:"latency_us"`
	Status         string `json:"status"`
	ErrorMsg       string `json:"error_msg,omitempty"`
}

type PartitionTracker struct {
	LastOffset    uint64
	HasLastOffset bool
	Count         int
}

type VerificationSummary struct {
	TotalEvents           int            `json:"total_events"`
	CommittedEvents       int            `json:"committed_events"`
	FailedEvents          int            `json:"failed_events"`
	ResidencyViolations   int            `json:"residency_violations"`
	OrderingViolations    int            `json:"ordering_violations"`
	PartitionCounts       map[string]int `json:"partition_counts"`
	P50LatencyUs          int64          `json:"p50_latency_us"`
	P99LatencyUs          int64          `json:"p99_latency_us"`
	MaxLatencyUs          int64          `json:"max_latency_us"`
	ResidencyAuditPassed  bool           `json:"residency_audit_passed"`
	OrderingAuditPassed   bool           `json:"ordering_audit_passed"`
	OverallVerdict        string         `json:"overall_verdict"`
}

func main() {
	traceFile := flag.String("trace", "events.jsonl", "Path to event trace JSONL file")
	flag.Parse()

	f, err := os.Open(*traceFile)
	if err != nil {
		log.Fatalf("Failed to open trace file %s: %v\n", *traceFile, err)
	}
	defer f.Close()

	scanner := bufio.NewScanner(f)
	var records []EventRecord

	for scanner.Scan() {
		line := scanner.Bytes()
		if len(line) == 0 {
			continue
		}
		var r EventRecord
		if err := json.Unmarshal(line, &r); err != nil {
			log.Fatalf("JSON parse error: %v\n", err)
		}
		records = append(records, r)
	}

	if len(records) == 0 {
		fmt.Println("Warning: Trace file is empty.")
		os.Exit(1)
	}

	summary := VerificationSummary{
		TotalEvents:     len(records),
		PartitionCounts: make(map[string]int),
	}

	partitionState := make(map[string]*PartitionTracker)
	var latencies []int64

	for _, rec := range records {
		if rec.Status != "COMMITTED" {
			summary.FailedEvents++
			continue
		}

		summary.CommittedEvents++
		latencies = append(latencies, rec.LatencyMicro)

		// 1. Audit Legal Data Residency
		lowerTopic := strings.ToLower(rec.Topic)
		if strings.Contains(lowerTopic, "gdpr") || strings.Contains(lowerTopic, "germany") || strings.Contains(lowerTopic, "eu-") {
			if !strings.EqualFold(rec.BrokerRegion, "Germany") {
				summary.ResidencyViolations++
				fmt.Printf("[VIOLATION] GDPR topic %q landed on unauthorized broker %s in region %s!\n",
					rec.Topic, rec.BrokerID, rec.BrokerRegion)
			}
		} else if strings.Contains(lowerTopic, "upi") || strings.Contains(lowerTopic, "india") {
			if !strings.EqualFold(rec.BrokerRegion, "India") {
				summary.ResidencyViolations++
				fmt.Printf("[VIOLATION] India topic %q landed on unauthorized broker %s in region %s!\n",
					rec.Topic, rec.BrokerID, rec.BrokerRegion)
			}
		} else if strings.Contains(lowerTopic, "singapore") || strings.Contains(lowerTopic, "apac") {
			if !strings.EqualFold(rec.BrokerRegion, "Singapore") {
				summary.ResidencyViolations++
				fmt.Printf("[VIOLATION] Singapore topic %q landed on unauthorized broker %s in region %s!\n",
					rec.Topic, rec.BrokerID, rec.BrokerRegion)
			}
		}

		// 2. Audit Monotonic Offset & Ordering
		streamKey := fmt.Sprintf("%s-p%d", rec.Topic, rec.PartitionID)
		summary.PartitionCounts[streamKey]++

		tracker, exists := partitionState[streamKey]
		if !exists {
			tracker = &PartitionTracker{
				LastOffset:    rec.Offset,
				HasLastOffset: true,
				Count:         1,
			}
			partitionState[streamKey] = tracker
		} else {
			if rec.Offset <= tracker.LastOffset {
				summary.OrderingViolations++
				fmt.Printf("[ORDERING VIOLATION] Stream %s had non-monotonic offset %d after %d!\n",
					streamKey, rec.Offset, tracker.LastOffset)
			}
			tracker.LastOffset = rec.Offset
			tracker.Count++
		}
	}

	// Calculate latency percentiles
	if len(latencies) > 0 {
		sort.Slice(latencies, func(i, j int) bool { return latencies[i] < latencies[j] })
		summary.P50LatencyUs = latencies[len(latencies)*50/100]
		summary.P99LatencyUs = latencies[len(latencies)*99/100]
		summary.MaxLatencyUs = latencies[len(latencies)-1]
	}

	summary.ResidencyAuditPassed = (summary.ResidencyViolations == 0)
	summary.OrderingAuditPassed = (summary.OrderingViolations == 0)

	if summary.ResidencyAuditPassed && summary.OrderingAuditPassed && summary.CommittedEvents > 0 {
		summary.OverallVerdict = "PASS"
	} else {
		summary.OverallVerdict = "FAIL"
	}

	fmt.Println("\n================= HYDRA VERIFICATION ORACLE REPORT =================")
	fmt.Printf("Overall Verdict:            %s\n", summary.OverallVerdict)
	fmt.Printf("Total Events Analyzed:      %d\n", summary.TotalEvents)
	fmt.Printf("Committed Events:           %d\n", summary.CommittedEvents)
	fmt.Printf("Failed Events:              %d\n", summary.FailedEvents)
	fmt.Printf("Legal Residency Violations: %d (Passed: %v)\n", summary.ResidencyViolations, summary.ResidencyAuditPassed)
	fmt.Printf("Monotonic Order Violations: %d (Passed: %v)\n", summary.OrderingViolations, summary.OrderingAuditPassed)
	fmt.Printf("Latency P50:                %d µs (%.3f ms)\n", summary.P50LatencyUs, float64(summary.P50LatencyUs)/1000.0)
	fmt.Printf("Latency P99:                %d µs (%.3f ms)\n", summary.P99LatencyUs, float64(summary.P99LatencyUs)/1000.0)
	fmt.Printf("Latency Max:                %d µs (%.3f ms)\n", summary.MaxLatencyUs, float64(summary.MaxLatencyUs)/1000.0)
	fmt.Println("----------------- Stream Partition Distribution -----------------")
	for pKey, count := range summary.PartitionCounts {
		fmt.Printf("  • %-25s: %d events\n", pKey, count)
	}
	fmt.Println("====================================================================")

	if summary.OverallVerdict != "PASS" {
		os.Exit(1)
	}
}
