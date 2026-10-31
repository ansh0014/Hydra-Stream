#pragma once

#include <chrono>
#include <cstdint>
#include <string>

namespace hydra {

struct Message {
    uint64_t offset{0};             // Assigned monotonic partition offset
    std::string key;                // Routing key for partition hashing
    std::string payload;            // Message data bytes
    std::string topic;              // Target topic name
    uint32_t partition_id{0};       // Assigned partition ID
    std::string producer_id;        // Client producer identity
    std::string legal_region;       // Required legal jurisdiction (e.g. "Germany", "India")
    uint64_t timestamp_ns{0};       // Nanosecond monotonic timestamp
};

} // namespace hydra
