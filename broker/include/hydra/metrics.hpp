#pragma once

#include <atomic>
#include <cstdint>

namespace hydra {

struct MetricsSnapshot {
    uint64_t produced{0};
    uint64_t consumed{0};
    uint64_t bytes_in{0};
    uint64_t bytes_out{0};
    uint64_t errors{0};
    uint64_t active_connections{0};
};

class Metrics {
public:
    void record_produced(uint64_t bytes = 0) noexcept {
        produced_.fetch_add(1, std::memory_order_relaxed);
        bytes_in_.fetch_add(bytes, std::memory_order_relaxed);
    }

    void record_consumed(uint64_t bytes = 0) noexcept {
        consumed_.fetch_add(1, std::memory_order_relaxed);
        bytes_out_.fetch_add(bytes, std::memory_order_relaxed);
    }

    void record_error() noexcept {
        errors_.fetch_add(1, std::memory_order_relaxed);
    }

    void connection_opened() noexcept {
        active_connections_.fetch_add(1, std::memory_order_relaxed);
    }

    void connection_closed() noexcept {
        active_connections_.fetch_sub(1, std::memory_order_relaxed);
    }

    MetricsSnapshot snapshot() const noexcept {
        return MetricsSnapshot{
            produced_.load(std::memory_order_relaxed),
            consumed_.load(std::memory_order_relaxed),
            bytes_in_.load(std::memory_order_relaxed),
            bytes_out_.load(std::memory_order_relaxed),
            errors_.load(std::memory_order_relaxed),
            active_connections_.load(std::memory_order_relaxed)
        };
    }

private:
    std::atomic<uint64_t> produced_{0};
    std::atomic<uint64_t> consumed_{0};
    std::atomic<uint64_t> bytes_in_{0};
    std::atomic<uint64_t> bytes_out_{0};
    std::atomic<uint64_t> errors_{0};
    std::atomic<uint64_t> active_connections_{0};
};

} // namespace hydra
