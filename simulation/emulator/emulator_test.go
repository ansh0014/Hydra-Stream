package main

import (
	"testing"
)

func TestEmulatorWorkerInitialization(t *testing.T) {
	w := newWorker(1, "127.0.0.1:9092", 256)
	if w.id != 1 {
		t.Fatalf("expected worker id 1, got %d", w.id)
	}
	if len(w.msgPayload) != 256 {
		t.Fatalf("expected payload length 256, got %d", len(w.msgPayload))
	}
}
