#include "hydra/partition.hpp"

#include <chrono>
#include <stdexcept>

namespace hydra {

Partition::Partition(uint32_t partition_id, size_t max_capacity)
    : partition_id_(partition_id), ring_buffer_(max_capacity) {}

uint64_t Partition::append(Message msg) {
    uint64_t assigned_offset = 0;
    {
        std::lock_guard<std::mutex> lock(cv_mutex_);
        if (closed_) {
            throw std::runtime_error("cannot append to closed partition");
        }
        assigned_offset = next_offset_++;
    }

    msg.offset = assigned_offset;
    msg.partition_id = partition_id_;
    if (msg.timestamp_ns == 0) {
        msg.timestamp_ns = static_cast<uint64_t>(
            std::chrono::duration_cast<std::chrono::nanoseconds>(
                std::chrono::steady_clock::now().time_since_epoch()
            ).count()
        );
    }

    // Ultra-low latency ring buffer push (zero heap allocations!)
    ring_buffer_.push(std::move(msg));

    cv_new_message_.notify_all();
    return assigned_offset;
}

std::vector<Message> Partition::read(uint64_t start_offset, size_t max_count) const {
    return ring_buffer_.read_batch(start_offset, max_count);
}

std::vector<Message> Partition::wait_read(uint64_t start_offset, size_t max_count, std::chrono::milliseconds timeout) {
    std::unique_lock<std::mutex> lock(cv_mutex_);

    auto has_data = [this, start_offset]() {
        if (closed_) return true;
        return next_offset_ > start_offset;
    };

    if (!has_data()) {
        cv_new_message_.wait_for(lock, timeout, has_data);
    }

    return ring_buffer_.read_batch(start_offset, max_count);
}

uint64_t Partition::next_offset() const noexcept {
    std::lock_guard<std::mutex> lock(cv_mutex_);
    return next_offset_;
}

size_t Partition::size() const {
    return ring_buffer_.size();
}

void Partition::close() {
    {
        std::lock_guard<std::mutex> lock(cv_mutex_);
        closed_ = true;
    }
    cv_new_message_.notify_all();
}

} // namespace hydra
