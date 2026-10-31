#pragma once

#include "hydra/partition.hpp"

#include <atomic>
#include <cstdint>
#include <memory>
#include <string>
#include <vector>

namespace hydra {

class Topic {
public:
    explicit Topic(std::string name, uint32_t partition_count = 4, std::string legal_region = "ANY");
    ~Topic() = default;

    Topic(const Topic&) = delete;
    Topic& operator=(const Topic&) = delete;

    const std::string& name() const noexcept { return name_; }
    const std::string& legal_region() const noexcept { return legal_region_; }
    uint32_t partition_count() const noexcept { return static_cast<uint32_t>(partitions_.size()); }

    // Publishes message: selects partition via key hash or round-robin, returns (partition_id, assigned_offset)
    std::pair<uint32_t, uint64_t> publish(Message msg);

    // Direct publish to specific partition
    uint64_t publish_to_partition(uint32_t partition_id, Message msg);

    // Reads messages from specific partition without deleting
    std::vector<Message> read(uint32_t partition_id, uint64_t start_offset, size_t max_count) const;

    // Blocking read from specific partition
    std::vector<Message> wait_read(uint32_t partition_id, uint64_t start_offset, size_t max_count, std::chrono::milliseconds timeout);

    std::shared_ptr<Partition> partition(uint32_t partition_id) const;
    size_t total_messages() const;
    void close();

private:
    uint32_t select_partition(const std::string& key);

    std::string name_;
    std::string legal_region_;
    std::vector<std::shared_ptr<Partition>> partitions_;
    std::atomic<uint32_t> round_robin_counter_{0};
};

using TopicPtr = std::shared_ptr<Topic>;

} // namespace hydra
