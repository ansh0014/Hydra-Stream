#include "hydra/broker.hpp"
#include "test_framework.hpp"

#include <atomic>
#include <chrono>
#include <sstream>

int main() {
    hydra_test::TestContext context;

    std::ostringstream log_sink;
    hydra::Broker broker("broker-test-1", "India", 4, log_sink);

    broker.create_topic("payments", 4, "ANY");

    constexpr size_t total_messages = 50;
    for (size_t i = 0; i < total_messages; ++i) {
        broker.produce("payments", "user_" + std::to_string(i % 5), "payment_payload_" + std::to_string(i));
    }

    auto snapshot = broker.metrics();
    hydra_test::expect_equal(context, snapshot.produced, static_cast<uint64_t>(total_messages), "All messages recorded as produced");

    // Fetch messages across partitions
    size_t fetched_total = 0;
    for (uint32_t p = 0; p < 4; ++p) {
        auto msgs = broker.fetch("payments", p, 0, 100);
        fetched_total += msgs.size();
    }

    hydra_test::expect_equal(context, fetched_total, total_messages, "All messages fetched successfully across partitions");

    return hydra_test::finish(context);
}
