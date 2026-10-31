#include "hydra/broker.hpp"
#include "hydra/ring_buffer.hpp"

#include <algorithm>
#include <atomic>
#include <chrono>
#include <iomanip>
#include <iostream>
#include <sstream>
#include <string>
#include <thread>
#include <vector>

struct LatencyStats {
    double p50_us{0.0};
    double p95_us{0.0};
    double p99_us{0.0};
    double min_us{0.0};
    double max_us{0.0};
    double avg_us{0.0};
    double throughput_msg_sec{0.0};
    double data_rate_mb_sec{0.0};
};

LatencyStats compute_stats(std::vector<uint64_t>& latencies_ns, double total_seconds, size_t total_bytes) {
    LatencyStats stats;
    if (latencies_ns.empty()) return stats;

    std::sort(latencies_ns.begin(), latencies_ns.end());

    size_t count = latencies_ns.size();
    stats.p50_us = latencies_ns[count * 50 / 100] / 1000.0;
    stats.p95_us = latencies_ns[count * 95 / 100] / 1000.0;
    stats.p99_us = latencies_ns[count * 99 / 100] / 1000.0;
    stats.min_us = latencies_ns.front() / 1000.0;
    stats.max_us = latencies_ns.back() / 1000.0;

    uint64_t sum = 0;
    for (uint64_t lat : latencies_ns) {
        sum += lat;
    }
    stats.avg_us = (static_cast<double>(sum) / count) / 1000.0;

    stats.throughput_msg_sec = count / total_seconds;
    stats.data_rate_mb_sec = (total_bytes / (1024.0 * 1024.0)) / total_seconds;

    return stats;
}

void benchmark_ring_buffer(size_t total_items) {
    std::cout << "\n=======================================================\n"
              << "  [1/2] BENCHMARKING RAW HYDRA RING BUFFER (Zero-Alloc)\n"
              << "=======================================================\n";

    hydra::RingBuffer<std::string> ring(131072); // 128K pre-allocated slots
    std::string payload(128, 'x'); // 128 bytes

    std::vector<uint64_t> latencies_ns;
    latencies_ns.resize(total_items);

    auto start = std::chrono::high_resolution_clock::now();

    for (size_t i = 0; i < total_items; ++i) {
        auto t0 = std::chrono::high_resolution_clock::now();
        ring.push(payload);
        auto t1 = std::chrono::high_resolution_clock::now();
        latencies_ns[i] = static_cast<uint64_t>(std::chrono::duration_cast<std::chrono::nanoseconds>(t1 - t0).count());
    }

    auto end = std::chrono::high_resolution_clock::now();
    double elapsed = std::chrono::duration<double>(end - start).count();

    auto stats = compute_stats(latencies_ns, elapsed, total_items * payload.size());

    std::cout << std::fixed << std::setprecision(2)
              << "  Total Items Produced : " << total_items << "\n"
              << "  Elapsed Time         : " << elapsed << " s\n"
              << "  Throughput           : " << stats.throughput_msg_sec << " msg/sec\n"
              << "  Bandwidth            : " << stats.data_rate_mb_sec << " MB/sec\n"
              << "  Latency (P50)        : " << stats.p50_us << " us (" << (stats.p50_us * 1000) << " ns)\n"
              << "  Latency (P95)        : " << stats.p95_us << " us\n"
              << "  Latency (P99)        : " << stats.p99_us << " us\n"
              << "  Latency (Min/Max)    : " << stats.min_us << " us / " << stats.max_us << " us\n";
}

void benchmark_broker_pipeline(int num_producers, int num_consumers, size_t messages_per_producer) {
    std::cout << "\n=======================================================\n"
              << "  [2/2] BENCHMARKING FULL HYDRA BROKER (Partitions + Pool)\n"
              << "=======================================================\n";

    std::ostringstream sink; // Suppress logger output during benchmark
    hydra::Broker broker("bench-broker", "India", 8, sink);
    broker.create_topic("benchmark_topic", 8, "ANY");

    std::string payload(256, 'b'); // 256 bytes payload
    size_t total_messages = num_producers * messages_per_producer;

    std::vector<std::vector<uint64_t>> worker_latencies(num_producers);
    for (auto& lats : worker_latencies) {
        lats.resize(messages_per_producer);
    }

    std::atomic<bool> start_flag{false};
    std::atomic<size_t> consumed_count{0};

    // Spawn Consumers reading by offset
    std::vector<std::thread> consumer_threads;
    consumer_threads.reserve(num_consumers);
    std::atomic<bool> consumers_stop{false};

    for (int c = 0; c < num_consumers; ++c) {
        consumer_threads.emplace_back([&broker, &consumers_stop, &consumed_count, c, num_consumers] {
            uint32_t partition_id = c % 8;
            uint64_t offset = 0;
            while (!consumers_stop.load(std::memory_order_relaxed)) {
                auto msgs = broker.fetch("benchmark_topic", partition_id, offset, 50);
                if (!msgs.empty()) {
                    consumed_count.fetch_add(msgs.size(), std::memory_order_relaxed);
                    offset += msgs.size();
                } else {
                    std::this_thread::yield();
                }
            }
        });
    }

    // Spawn Producers
    std::vector<std::thread> producer_threads;
    producer_threads.reserve(num_producers);

    for (int p = 0; p < num_producers; ++p) {
        producer_threads.emplace_back([&broker, &start_flag, &worker_latencies, p, messages_per_producer, &payload] {
            while (!start_flag.load(std::memory_order_acquire)) {
                std::this_thread::yield();
            }

            std::string key = "user_" + std::to_string(p);
            for (size_t m = 0; m < messages_per_producer; ++m) {
                auto t0 = std::chrono::high_resolution_clock::now();
                broker.produce("benchmark_topic", key, payload);
                auto t1 = std::chrono::high_resolution_clock::now();
                worker_latencies[p][m] = static_cast<uint64_t>(
                    std::chrono::duration_cast<std::chrono::nanoseconds>(t1 - t0).count()
                );
            }
        });
    }

    // Start benchmark timing
    auto start = std::chrono::high_resolution_clock::now();
    start_flag.store(true, std::memory_order_release);

    for (auto& pt : producer_threads) {
        pt.join();
    }

    auto end = std::chrono::high_resolution_clock::now();
    double elapsed = std::chrono::duration<double>(end - start).count();

    consumers_stop.store(true, std::memory_order_relaxed);
    for (auto& ct : consumer_threads) {
        ct.join();
    }

    // Aggregate all producer latencies
    std::vector<uint64_t> all_latencies;
    all_latencies.reserve(total_messages);
    for (const auto& lats : worker_latencies) {
        all_latencies.insert(all_latencies.end(), lats.begin(), lats.end());
    }

    auto stats = compute_stats(all_latencies, elapsed, total_messages * payload.size());

    std::cout << std::fixed << std::setprecision(2)
              << "  Producers / Consumers: " << num_producers << " / " << num_consumers << "\n"
              << "  Total Messages       : " << total_messages << "\n"
              << "  Elapsed Time         : " << elapsed << " s\n"
              << "  Throughput           : " << stats.throughput_msg_sec << " msg/sec\n"
              << "  Bandwidth            : " << stats.data_rate_mb_sec << " MB/sec\n"
              << "  Latency (P50 Median) : " << stats.p50_us << " us (" << (stats.p50_us * 1000) << " ns)\n"
              << "  Latency (P95)        : " << stats.p95_us << " us\n"
              << "  Latency (P99 Tail)   : " << stats.p99_us << " us\n"
              << "  Latency (Min/Max)    : " << stats.min_us << " us / " << stats.max_us << " us\n"
              << "=======================================================\n";

    broker.shutdown();
}

int main() {
    // 1. Raw RingBuffer benchmark (500K items)
    benchmark_ring_buffer(500000);

    // 2. Full Multi-Threaded Broker Pipeline (4 Producers, 4 Consumers, 100K messages)
    benchmark_broker_pipeline(4, 4, 25000);

    return 0;
}
