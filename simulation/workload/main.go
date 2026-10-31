package main

import (
	"bytes"
	"encoding/binary"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"os"
	"sort"
	"sync"
	"time"
)

const (
	MagicByte       = 0x48
	ProtocolVersion = 0x01

	OpProduceReq = 0x0001
	OpProduceAck = 0x0002
	OpErrorResp  = 0x00FF
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

type RouteDecision struct {
	Topic               string  `json:"topic"`
	AssignedBrokerID    string  `json:"assigned_broker_id"`
	AssignedEndpoint    string  `json:"assigned_endpoint"`
	Region              string  `json:"region"`
	Score               float64 `json:"score"`
	IsBypassingSlowLink bool    `json:"is_bypassing_slow_link"`
	Reason              string  `json:"reason"`
}

type WorkloadRunner struct {
	controllerURL string
	clientRegion  string
	connCache     map[string]net.Conn
	connMu        sync.Mutex
	corrID        uint64
}

func NewWorkloadRunner(controllerURL, clientRegion string) *WorkloadRunner {
	return &WorkloadRunner{
		controllerURL: controllerURL,
		clientRegion:  clientRegion,
		connCache:     make(map[string]net.Conn),
	}
}

func (w *WorkloadRunner) resolveRoute(topic string) (*RouteDecision, error) {
	reqBody, _ := json.Marshal(map[string]string{
		"topic":         topic,
		"client_region": w.clientRegion,
	})

	resp, err := http.Post(w.controllerURL+"/route/resolve", "application/json", bytes.NewReader(reqBody))
	if err != nil {
		return nil, fmt.Errorf("failed to call controller: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		var errResp map[string]interface{}
		_ = json.NewDecoder(resp.Body).Decode(&errResp)
		return nil, fmt.Errorf("route rejection (%d): %v", resp.StatusCode, errResp["error"])
	}

	var decision RouteDecision
	if err := json.NewDecoder(resp.Body).Decode(&decision); err != nil {
		return nil, err
	}
	return &decision, nil
}

func (w *WorkloadRunner) getBrokerConn(endpoint string) (net.Conn, error) {
	w.connMu.Lock()
	defer w.connMu.Unlock()

	if conn, ok := w.connCache[endpoint]; ok {
		return conn, nil
	}

	conn, err := net.DialTimeout("tcp", endpoint, 2*time.Second)
	if err != nil {
		return nil, err
	}
	w.connCache[endpoint] = conn
	return conn, nil
}

func (w *WorkloadRunner) sendProduce(conn net.Conn, topic, key, val string) (uint32, uint64, error) {
	w.corrID++
	corr := w.corrID

	// Build payload: [2B topic_len][topic][2B key_len][key][4B val_len][val]
	var payload bytes.Buffer
	_ = binary.Write(&payload, binary.BigEndian, uint16(len(topic)))
	payload.WriteString(topic)
	_ = binary.Write(&payload, binary.BigEndian, uint16(len(key)))
	payload.WriteString(key)
	_ = binary.Write(&payload, binary.BigEndian, uint32(len(val)))
	payload.WriteString(val)

	payloadBytes := payload.Bytes()

	// Header: [1B magic][1B version][2B opcode][8B corr_id][4B payload_len]
	var hdr bytes.Buffer
	hdr.WriteByte(MagicByte)
	hdr.WriteByte(ProtocolVersion)
	_ = binary.Write(&hdr, binary.LittleEndian, uint16(OpProduceReq))
	_ = binary.Write(&hdr, binary.LittleEndian, corr)
	_ = binary.Write(&hdr, binary.LittleEndian, uint32(len(payloadBytes)))

	// Send header + payload
	if _, err := conn.Write(hdr.Bytes()); err != nil {
		return 0, 0, err
	}
	if _, err := conn.Write(payloadBytes); err != nil {
		return 0, 0, err
	}

	// Read response header (16 bytes)
	respHdrBuf := make([]byte, 16)
	if _, err := io.ReadFull(conn, respHdrBuf); err != nil {
		return 0, 0, err
	}

	opcode := binary.LittleEndian.Uint16(respHdrBuf[2:4])
	payLen := binary.LittleEndian.Uint32(respHdrBuf[12:16])

	respPayload := make([]byte, payLen)
	if _, err := io.ReadFull(conn, respPayload); err != nil {
		return 0, 0, err
	}

	if opcode == OpErrorResp {
		return 0, 0, fmt.Errorf("broker error: %s", string(respPayload))
	}

	if opcode != OpProduceAck || payLen < 12 {
		return 0, 0, fmt.Errorf("unexpected broker response opcode=0x%04x len=%d", opcode, payLen)
	}

	partID := binary.BigEndian.Uint32(respPayload[0:4])
	offset := binary.BigEndian.Uint64(respPayload[4:12])
	return partID, offset, nil
}

func main() {
	controllerURL := flag.String("controller", "http://127.0.0.1:8080", "Hydra Controller URL")
	clientRegion := flag.String("region", "India", "Client geographic origin")
	numMessages := flag.Int("messages", 1000, "Number of workload messages to produce")
	traceFile := flag.String("trace", "events.jsonl", "Path to write event trace JSONL")
	directBroker := flag.String("broker", "", "Direct broker endpoint override (e.g. 127.0.0.1:9092)")
	flag.Parse()

	log.Printf("[Workload Generator] Initializing workload: %d messages from region %s\n", *numMessages, *clientRegion)

	f, err := os.Create(*traceFile)
	if err != nil {
		log.Fatalf("Failed to create trace file: %v\n", err)
	}
	defer f.Close()
	jsonEncoder := json.NewEncoder(f)

	runner := NewWorkloadRunner(*controllerURL, *clientRegion)

	// Workload dataset spanning multiple legal and global topics
	topics := []string{
		"gdpr-user-audit", // Germany legal requirement
		"upi-transactions", // India legal requirement
		"apac-fx",          // Singapore legal requirement
		"telemetry",        // Global / latency-optimized
	}

	var latencies []int64
	startTime := time.Now()
	successCount := 0
	errorCount := 0

	for i := 1; i <= *numMessages; i++ {
		topic := topics[i%len(topics)]
		key := fmt.Sprintf("entity-%d", i%100)
		val := fmt.Sprintf(`{"msg_id":%d,"ts":%d,"payload":"hydra-geo-stream-benchmark-data"}`, i, time.Now().UnixNano())

		sendStart := time.Now()
		var brokerID, brokerRegion string
		var partID uint32
		var offset uint64
		var sendErr error

		if *directBroker != "" {
			brokerID = "broker-direct"
			brokerRegion = "Direct"
			conn, err := runner.getBrokerConn(*directBroker)
			if err != nil {
				sendErr = err
			} else {
				partID, offset, sendErr = runner.sendProduce(conn, topic, key, val)
			}
		} else {
			// Resolve route through Hydra Controller
			decision, err := runner.resolveRoute(topic)
			if err != nil {
				sendErr = err
			} else {
				brokerID = decision.AssignedBrokerID
				brokerRegion = decision.Region

				conn, err := runner.getBrokerConn(decision.AssignedEndpoint)
				if err != nil {
					sendErr = err
				} else {
					partID, offset, sendErr = runner.sendProduce(conn, topic, key, val)
				}
			}
		}

		elapsedUs := time.Since(sendStart).Microseconds()
		latencies = append(latencies, elapsedUs)

		record := EventRecord{
			TimestampMicro: sendStart.UnixMicro(),
			Seq:            i,
			Topic:          topic,
			Key:            key,
			BrokerID:       brokerID,
			BrokerRegion:   brokerRegion,
			PartitionID:    partID,
			Offset:         offset,
			LatencyMicro:   elapsedUs,
		}

		if sendErr != nil {
			record.Status = "FAILED"
			record.ErrorMsg = sendErr.Error()
			errorCount++
		} else {
			record.Status = "COMMITTED"
			successCount++
		}

		_ = jsonEncoder.Encode(record)
	}

	totalDuration := time.Since(startTime)
	sort.Slice(latencies, func(i, j int) bool { return latencies[i] < latencies[j] })

	p50 := latencies[len(latencies)*50/100]
	p90 := latencies[len(latencies)*90/100]
	p95 := latencies[len(latencies)*95/100]
	p99 := latencies[len(latencies)*99/100]
	max := latencies[len(latencies)-1]
	throughput := float64(len(latencies)) / totalDuration.Seconds()

	fmt.Println("\n================ WORKLOAD EXECUTION BENCHMARK ================")
	fmt.Printf("Total Messages:       %d (Committed: %d, Failed: %d)\n", len(latencies), successCount, errorCount)
	fmt.Printf("Total Elapsed Time:   %v\n", totalDuration)
	fmt.Printf("Throughput:           %.2f msg/sec\n", throughput)
	fmt.Printf("Latency P50:          %d µs (%.3f ms)\n", p50, float64(p50)/1000.0)
	fmt.Printf("Latency P90:          %d µs (%.3f ms)\n", p90, float64(p90)/1000.0)
	fmt.Printf("Latency P95:          %d µs (%.3f ms)\n", p95, float64(p95)/1000.0)
	fmt.Printf("Latency P99:          %d µs (%.3f ms)\n", p99, float64(p99)/1000.0)
	fmt.Printf("Latency Max:          %d µs (%.3f ms)\n", max, float64(max)/1000.0)
	fmt.Printf("Trace Written To:     %s\n", *traceFile)
	fmt.Println("==============================================================")
}
