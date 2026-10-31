#pragma once

#include "hydra/message.hpp"

#include <condition_variable>
#include <cstddef>
#include <cstdint>
#include <deque>
#include <mutex>
#include <vector>

namespace hydra {

class Partition {
public:
    explicit Partition(uint32_t partition_id, size_t max_capacity = 1000000);
    ~Partition() = default;

    Partition(const Partition&) = delete;
    Partition& operator=(const Partition&) = delete;

    uint32_t id() const noexcept { return partition_id_; }

    // Appends a message, assigns monotonic offset, notifies waiting consumers
    uint64_t append(Message msg);

    // Reads up to max_count messages starting from start_offset without popping/deleting
    std::vector<Message> read(uint64_t start_offset, size_t max_count) const;

    // Blocking read: waits until messages are available at or beyond start_offset, or timeout
    std::vector<Message> wait_read(uint64_t start_offset, size_t max_count, std::chrono::milliseconds timeout);

    uint64_t next_offset() const noexcept;
    size_t size() const;
    void close();

private:
    uint32_t partition_id_;
    size_t max_capacity_;
    uint64_t next_offset_{0};
    bool closed_{false};

    std::deque<Message> log_;
    mutable std::mutex mutex_;
    std::condition_variable cv_new_message_;
};

} // namespace hydra
