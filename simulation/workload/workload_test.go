package main

import (
	"bytes"
	"encoding/binary"
	"testing"
)

func TestPayloadFraming(t *testing.T) {
	topic := "gdpr-user-audit"
	key := "entity-10"
	val := `{"msg":1}`

	var payload bytes.Buffer
	_ = binary.Write(&payload, binary.BigEndian, uint16(len(topic)))
	payload.WriteString(topic)
	_ = binary.Write(&payload, binary.BigEndian, uint16(len(key)))
	payload.WriteString(key)
	_ = binary.Write(&payload, binary.BigEndian, uint32(len(val)))
	payload.WriteString(val)

	payloadBytes := payload.Bytes()

	// Verify framing header
	var hdr bytes.Buffer
	hdr.WriteByte(MagicByte)
	hdr.WriteByte(ProtocolVersion)
	_ = binary.Write(&hdr, binary.LittleEndian, uint16(OpProduceReq))
	_ = binary.Write(&hdr, binary.LittleEndian, uint64(42))
	_ = binary.Write(&hdr, binary.LittleEndian, uint32(len(payloadBytes)))

	hdrBytes := hdr.Bytes()
	if len(hdrBytes) != 16 {
		t.Fatalf("expected header length 16 bytes, got %d", len(hdrBytes))
	}

	if hdrBytes[0] != 0x48 {
		t.Fatalf("expected magic 0x48, got 0x%02x", hdrBytes[0])
	}
	if hdrBytes[1] != 0x01 {
		t.Fatalf("expected version 0x01, got 0x%02x", hdrBytes[1])
	}

	opcode := binary.LittleEndian.Uint16(hdrBytes[2:4])
	if opcode != OpProduceReq {
		t.Fatalf("expected opcode 0x0001, got 0x%04x", opcode)
	}

	corrID := binary.LittleEndian.Uint64(hdrBytes[4:12])
	if corrID != 42 {
		t.Fatalf("expected correlation ID 42, got %d", corrID)
	}

	payLen := binary.LittleEndian.Uint32(hdrBytes[12:16])
	if int(payLen) != len(payloadBytes) {
		t.Fatalf("expected payload len %d, got %d", len(payloadBytes), payLen)
	}
}
