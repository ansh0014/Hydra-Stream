package main

import (
	"bytes"
	"encoding/binary"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"net"
	"os"
	"sort"
	"sync"
	"sync/atomic"
	"time"
)

const (
	MagicByte       = 0x48
	ProtocolVersion = 0x01
	OpProduceReq    = 0x0001
	OpProduceAck    = 0x0002
)

type BenchmarkReport struct {
	TotalMessages      int64            `json:"total_messages"`
	SuccessfulMessages int64            `json:"successful_messages"`
	FailedMessages     int64            `json:"failed_messages"`
	Concurrency        int              `json:"concurrency_workers"`
	TotalDurationSec   float64          `json:"duration_seconds"`
	ThroughputMsgSec   float64          `json:"throughput_msg_per_sec"`
	ThroughputMBSec    float64          `json:"throughput_mb_per_sec"`
	P50LatencyUs       int64            `json:"p50_latency_us"`
	P90LatencyUs       int64            `json:"p90_latency_us"`
	P95LatencyUs       int64            `json:"p95_latency_us"`
	P99LatencyUs       int64            `json:"p99_latency_us"`
	P999LatencyUs      int64            `json:"p999_latency_us"`
	MaxLatencyUs       int64            `json:"max_latency_us"`
	PartitionCounts    map[string]int64 `json:"partition_distribution"`
}

type EmulatorWorker struct {
	id          int
	targetAddr  string
	conn        net.Conn
	msgPayload  []byte
	connMu      sync.Mutex
	corrCounter uint64
}

func newWorker(id int, targetAddr string, payloadSize int) *EmulatorWorker {
	data := make([]byte, payloadSize)
	for i := range data {
		data[i] = byte('A' + (i % 26))
	}
	return &EmulatorWorker{
		id:         id,
		targetAddr: targetAddr,
		msgPayload: data,
	}
}

func (w *EmulatorWorker) connect() error {
	w.connMu.Lock()
	defer w.connMu.Unlock()
	conn, err := net.DialTimeout("tcp", w.targetAddr, 3*time.Second)
	if err != nil {
		return err
	}
	w.conn = conn
	return nil
}

func (w *EmulatorWorker) produce(topic, key string) (uint32, uint64, error) {
	if w.conn == nil {
		if err := w.connect(); err != nil {
			return 0, 0, err
		}
	}

	w.corrCounter++
	corr := w.corrCounter

	// Build payload: [2B topic_len][topic][2B key_len][key][4B val_len][val]
	var payload bytes.Buffer
	_ = binary.Write(&payload, binary.BigEndian, uint16(len(topic)))
	payload.WriteString(topic)
	_ = binary.Write(&payload, binary.BigEndian, uint16(len(key)))
	payload.WriteString(key)
	_ = binary.Write(&payload, binary.BigEndian, uint32(len(w.msgPayload)))
	payload.Write(w.msgPayload)

	payloadBytes := payload.Bytes()

	// Header: [1B magic][1B version][2B opcode][8B corr_id][4B payload_len]
	var hdr bytes.Buffer
	hdr.WriteByte(MagicByte)
	hdr.WriteByte(ProtocolVersion)
	_ = binary.Write(&hdr, binary.LittleEndian, uint16(OpProduceReq))
	_ = binary.Write(&hdr, binary.LittleEndian, corr)
	_ = binary.Write(&hdr, binary.LittleEndian, uint32(len(payloadBytes)))

	if _, err := w.conn.Write(hdr.Bytes()); err != nil {
		w.conn.Close()
		w.conn = nil
		return 0, 0, err
	}
	if _, err := w.conn.Write(payloadBytes); err != nil {
		w.conn.Close()
		w.conn = nil
		return 0, 0, err
	}

	// Read response header (16 bytes)
	respHdr := make([]byte, 16)
	if _, err := io.ReadFull(w.conn, respHdr); err != nil {
		w.conn.Close()
		w.conn = nil
		return 0, 0, err
	}

	payLen := binary.LittleEndian.Uint32(respHdr[12:16])
	respPayload := make([]byte, payLen)
	if _, err := io.ReadFull(w.conn, respPayload); err != nil {
		w.conn.Close()
		w.conn = nil
		return 0, 0, err
	}

	if payLen < 12 {
		return 0, 0, fmt.Errorf("short response payload: %d", payLen)
	}

	partID := binary.BigEndian.Uint32(respPayload[0:4])
	offset := binary.BigEndian.Uint64(respPayload[4:12])
	return partID, offset, nil
}

func main() {
	totalMsgs := flag.Int64("messages", 100000, "Total number of messages to produce")
	workersCount := flag.Int("workers", 8, "Number of concurrent worker goroutines")
	msgSizeBytes := flag.Int("size", 256, "Message payload size in bytes")
	targetEndpoint := flag.String("endpoint", "127.0.0.1:9092", "Target Hydra broker TCP endpoint")
	outputReport := flag.String("output", "benchmark_summary.json", "Path to save benchmark report JSON")
	flag.Parse()

	fmt.Println("=================================================================")
	fmt.Println("        HYDRA STREAM - HIGH-THROUGHPUT STRESS EMULATOR           ")
	fmt.Println("=================================================================")
	fmt.Printf("Target Endpoint:  %s\n", *targetEndpoint)
	fmt.Printf("Total Messages:   %d\n", *totalMsgs)
	fmt.Printf("Workers:          %d\n", *workersCount)
	fmt.Printf("Message Size:     %d bytes\n", *msgSizeBytes)
	fmt.Println("-----------------------------------------------------------------")

	topics := []string{
		"upi-transactions", // Indian high-frequency financial traffic
		"gdpr-user-audit",  // European GDPR compliant audit stream
		"apac-fx",          // Singapore foreign exchange streaming rates
		"global-telemetry", // Low-latency distributed infrastructure telemetry
	}

	var successfulCount int64
	var failedCount int64
	partitionDistribution := sync.Map{}

	latencies := make([]int64, 0, *totalMsgs)
	latenciesMu := sync.Mutex{}

	msgsPerWorker := *totalMsgs / int64(*workersCount)
	var wg sync.WaitGroup

	startTime := time.Now()

	// Progress reporter goroutine
	doneReporting := make(chan struct{})
	go func() {
		ticker := time.NewTicker(1 * time.Second)
		defer ticker.Stop()
		for {
			select {
			case <-doneReporting:
				return
			case <-ticker.C:
				current := atomic.LoadInt64(&successfulCount)
				elapsed := time.Since(startTime).Seconds()
				rate := float64(current) / elapsed
				fmt.Printf("\r[Emulator Progress] Produced: %d/%d (%.1f%%) | Rate: %.0f msg/sec...",
					current, *totalMsgs, float64(current)/float64(*totalMsgs)*100.0, rate)
			}
		}
	}()

	for w := 0; w < *workersCount; w++ {
		wg.Add(1)
		go func(workerID int) {
			defer wg.Done()
			worker := newWorker(workerID, *targetEndpoint, *msgSizeBytes)
			localLatencies := make([]int64, 0, msgsPerWorker)

			for i := int64(0); i < msgsPerWorker; i++ {
				topic := topics[i%int64(len(topics))]
				key := fmt.Sprintf("key-w%d-%d", workerID, i%500)

				sendStart := time.Now()
				partID, _, err := worker.produce(topic, key)
				elapsedUs := time.Since(sendStart).Microseconds()

				if err != nil {
					atomic.AddInt64(&failedCount, 1)
				} else {
					atomic.AddInt64(&successfulCount, 1)
					localLatencies = append(localLatencies, elapsedUs)

					streamKey := fmt.Sprintf("%s-p%d", topic, partID)
					val, _ := partitionDistribution.LoadOrStore(streamKey, new(int64))
					atomic.AddInt64(val.(*int64), 1)
				}
			}

			latenciesMu.Lock()
			latencies = append(latencies, localLatencies...)
			latenciesMu.Unlock()
		}(w)
	}

	wg.Wait()
	close(doneReporting)
	totalDuration := time.Since(startTime)

	fmt.Println("\n\nSorting latencies and computing statistics...")
	sort.Slice(latencies, func(i, j int) bool { return latencies[i] < latencies[j] })

	var p50, p90, p95, p99, p999, maxLat int64
	n := len(latencies)
	if n > 0 {
		p50 = latencies[n*50/100]
		p90 = latencies[n*90/100]
		p95 = latencies[n*95/100]
		p99 = latencies[n*99/100]
		p999 = latencies[n*999/1000]
		maxLat = latencies[n-1]
	}

	throughputMsgSec := float64(successfulCount) / totalDuration.Seconds()
	totalMB := float64(successfulCount*int64(*msgSizeBytes)) / (1024 * 1024)
	throughputMBSec := totalMB / totalDuration.Seconds()

	partMap := make(map[string]int64)
	partitionDistribution.Range(func(k, v interface{}) bool {
		partMap[k.(string)] = *v.(*int64)
		return true
	})

	report := BenchmarkReport{
		TotalMessages:      *totalMsgs,
		SuccessfulMessages: successfulCount,
		FailedMessages:     failedCount,
		Concurrency:        *workersCount,
		TotalDurationSec:   totalDuration.Seconds(),
		ThroughputMsgSec:   throughputMsgSec,
		ThroughputMBSec:    throughputMBSec,
		P50LatencyUs:       p50,
		P90LatencyUs:       p90,
		P95LatencyUs:       p95,
		P99LatencyUs:       p99,
		P999LatencyUs:      p999,
		MaxLatencyUs:       maxLat,
		PartitionCounts:    partMap,
	}

	reportBytes, _ := json.MarshalIndent(report, "", "  ")
	_ = os.WriteFile(*outputReport, reportBytes, 0644)

	fmt.Println("\n=================================================================")
	fmt.Println("              HYDRA STREAM - BENCHMARK RESULTS                   ")
	fmt.Println("=================================================================")
	fmt.Printf("Total Elapsed:         %.3f seconds\n", totalDuration.Seconds())
	fmt.Printf("Committed Messages:    %d / %d (Success: %.2f%%)\n",
		successfulCount, *totalMsgs, float64(successfulCount)/float64(*totalMsgs)*100.0)
	fmt.Printf("Peak Throughput:       %.2f msg/sec (%.2f MB/sec)\n", throughputMsgSec, throughputMBSec)
	fmt.Printf("Latency P50:           %d µs (%.3f ms)\n", p50, float64(p50)/1000.0)
	fmt.Printf("Latency P90:           %d µs (%.3f ms)\n", p90, float64(p90)/1000.0)
	fmt.Printf("Latency P95:           %d µs (%.3f ms)\n", p95, float64(p95)/1000.0)
	fmt.Printf("Latency P99:           %d µs (%.3f ms)\n", p99, float64(p99)/1000.0)
	fmt.Printf("Latency P99.9:         %d µs (%.3f ms)\n", p999, float64(p999)/1000.0)
	fmt.Printf("Latency Max:           %d µs (%.3f ms)\n", maxLat, float64(maxLat)/1000.0)
	fmt.Println("-----------------------------------------------------------------")
	fmt.Printf("Report successfully saved to: %s\n", *outputReport)
	fmt.Println("=================================================================")
}
