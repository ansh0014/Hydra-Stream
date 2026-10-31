#include "hydra/partition.hpp"

#include <algorithm>
#include <chrono>
#include <stdexcept>

namespace hydra {

Partition::Partition(uint32_t partition_id, size_t max_capacity)
    : partition_id_(partition_id), max_capacity_(max_capacity) {}

uint64_t Partition::append(Message msg) {
    std::unique_lock<std::mutex> lock(mutex_);
    if (closed_) {
        throw std::runtime_error("cannot append to closed partition");
    }

    // Assign monotonic partition offset
    uint64_t assigned_offset = next_offset_++;
    msg.offset = assigned_offset;
    msg.partition_id = partition_id_;
    if (msg.timestamp_ns == 0) {
        msg.timestamp_ns = static_cast<uint64_t>(
            std::chrono::duration_cast<std::chrono::nanoseconds>(
                std::chrono::steady_clock::now().time_since_epoch()
            ).count()
        );
    }

    // Bounded log memory check
    if (log_.size() >= max_capacity_) {
        log_.pop_front(); // Evict oldest retained record if exceeding capacity
    }

    log_.push_back(std::move(msg));
    cv_new_message_.notify_all();

    return assigned_offset;
}

std::vector<Message> Partition::read(uint64_t start_offset, size_t max_count) const {
    std::lock_guard<std::mutex> lock(mutex_);
    std::vector<Message> result;
    if (log_.empty() || max_count == 0) {
        return result;
    }

    uint64_t first_available = log_.front().offset;
    if (start_offset < first_available) {
        start_offset = first_available;
    }

    size_t start_idx = static_cast<size_t>(start_offset - first_available);
    if (start_idx >= log_.size()) {
        return result;
    }

    size_t count = std::min(max_count, log_.size() - start_idx);
    result.reserve(count);
    for (size_t i = 0; i < count; ++i) {
        result.push_back(log_[start_idx + i]);
    }

    return result;
}

std::vector<Message> Partition::wait_read(uint64_t start_offset, size_t max_count, std::chrono::milliseconds timeout) {
    std::unique_lock<std::mutex> lock(mutex_);

    auto has_data = [this, start_offset]() {
        if (closed_ || log_.empty()) return true;
        return next_offset_ > start_offset;
    };

    if (!has_data()) {
        cv_new_message_.wait_for(lock, timeout, has_data);
    }

    std::vector<Message> result;
    if (log_.empty() || max_count == 0) {
        return result;
    }

    uint64_t first_available = log_.front().offset;
    if (start_offset < first_available) {
        start_offset = first_available;
    }

    size_t start_idx = static_cast<size_t>(start_offset - first_available);
    if (start_idx >= log_.size()) {
        return result;
    }

    size_t count = std::min(max_count, log_.size() - start_idx);
    result.reserve(count);
    for (size_t i = 0; i < count; ++i) {
        result.push_back(log_[start_idx + i]);
    }

    return result;
}

uint64_t Partition::next_offset() const noexcept {
    std::lock_guard<std::mutex> lock(mutex_);
    return next_offset_;
}

size_t Partition::size() const {
    std::lock_guard<std::mutex> lock(mutex_);
    return log_.size();
}

void Partition::close() {
    {
        std::lock_guard<std::mutex> lock(mutex_);
        closed_ = true;
    }
    cv_new_message_.notify_all();
}

} // namespace hydra
