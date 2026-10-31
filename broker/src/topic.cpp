#include "hydra/topic.hpp"

#include <functional>
#include <stdexcept>

namespace hydra {

Topic::Topic(std::string name, uint32_t partition_count, std::string legal_region)
    : name_(std::move(name)), legal_region_(std::move(legal_region)) {
    if (name_.empty()) {
        throw std::invalid_argument("topic name cannot be empty");
    }
    if (partition_count == 0) {
        partition_count = 1;
    }

    partitions_.reserve(partition_count);
    for (uint32_t i = 0; i < partition_count; ++i) {
        partitions_.push_back(std::make_shared<Partition>(i));
    }
}

uint32_t Topic::select_partition(const std::string& key) {
    if (partitions_.empty()) {
        throw std::runtime_error("topic has no partitions");
    }

    if (key.empty()) {
        // Round-robin distribution for empty keys
        return round_robin_counter_.fetch_add(1, std::memory_order_relaxed) % partitions_.size();
    }

    // Hash distribution for non-empty keys (guarantees same key -> same partition)
    std::hash<std::string> hasher;
    return static_cast<uint32_t>(hasher(key) % partitions_.size());
}

std::pair<uint32_t, uint64_t> Topic::publish(Message msg) {
    uint32_t part_id = select_partition(msg.key);
    uint64_t offset = partitions_[part_id]->append(std::move(msg));
    return {part_id, offset};
}

uint64_t Topic::publish_to_partition(uint32_t partition_id, Message msg) {
    if (partition_id >= partitions_.size()) {
        throw std::out_of_range("partition id out of range: " + std::to_string(partition_id));
    }
    return partitions_[partition_id]->append(std::move(msg));
}

std::vector<Message> Topic::read(uint32_t partition_id, uint64_t start_offset, size_t max_count) const {
    if (partition_id >= partitions_.size()) {
        throw std::out_of_range("partition id out of range: " + std::to_string(partition_id));
    }
    return partitions_[partition_id]->read(start_offset, max_count);
}

std::vector<Message> Topic::wait_read(uint32_t partition_id, uint64_t start_offset, size_t max_count, std::chrono::milliseconds timeout) {
    if (partition_id >= partitions_.size()) {
        throw std::out_of_range("partition id out of range: " + std::to_string(partition_id));
    }
    return partitions_[partition_id]->wait_read(start_offset, max_count, timeout);
}

std::shared_ptr<Partition> Topic::partition(uint32_t partition_id) const {
    if (partition_id >= partitions_.size()) {
        return nullptr;
    }
    return partitions_[partition_id];
}

size_t Topic::total_messages() const {
    size_t total = 0;
    for (const auto& p : partitions_) {
        total += p->size();
    }
    return total;
}

void Topic::close() {
    for (auto& p : partitions_) {
        p->close();
    }
}

} // namespace hydra
