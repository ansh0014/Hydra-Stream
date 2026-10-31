#pragma once

#include <cstddef>
#include <cstdint>
#include <mutex>
#include <optional>
#include <stdexcept>
#include <vector>

namespace hydra {

template <typename T>
class RingBuffer {
public:
    explicit RingBuffer(size_t capacity = 65536) {
        // Round up capacity to next power of 2 for fast bitwise indexing
        size_t power_of_two = 1;
        while (power_of_two < capacity) {
            power_of_two <<= 1;
        }
        capacity_ = power_of_two;
        mask_ = capacity_ - 1;
        buffer_.resize(capacity_);
    }

    size_t capacity() const noexcept { return capacity_; }
    size_t size() const noexcept {
        std::lock_guard<std::mutex> lock(mutex_);
        return tail_ - head_;
    }
    bool empty() const noexcept {
        std::lock_guard<std::mutex> lock(mutex_);
        return head_ == tail_;
    }

    // Appends an item. If full, overwrites oldest element (moving head forward).
    // Returns index/sequence number of the added item.
    uint64_t push(T item) {
        std::lock_guard<std::mutex> lock(mutex_);
        uint64_t current_tail = tail_;

        buffer_[current_tail & mask_] = std::move(item);
        tail_++;

        if (tail_ - head_ > capacity_) {
            head_ = tail_ - capacity_; // Advance head on overwrite
        }

        return current_tail;
    }

    // Reads an item at absolute sequence/offset
    std::optional<T> get(uint64_t sequence) const {
        std::lock_guard<std::mutex> lock(mutex_);
        if (sequence < head_ || sequence >= tail_) {
            return std::nullopt;
        }
        return buffer_[sequence & mask_];
    }

    // Reads a contiguous slice of items starting from start_seq up to max_count
    std::vector<T> read_batch(uint64_t start_seq, size_t max_count) const {
        std::lock_guard<std::mutex> lock(mutex_);
        std::vector<T> result;

        if (head_ == tail_ || start_seq >= tail_ || max_count == 0) {
            return result;
        }

        if (start_seq < head_) {
            start_seq = head_; // Start from oldest available if requested has expired
        }

        size_t available = static_cast<size_t>(tail_ - start_seq);
        size_t count = (max_count < available) ? max_count : available;
        result.reserve(count);

        for (size_t i = 0; i < count; ++i) {
            result.push_back(buffer_[(start_seq + i) & mask_]);
        }

        return result;
    }

    uint64_t head() const noexcept {
        std::lock_guard<std::mutex> lock(mutex_);
        return head_;
    }

    uint64_t tail() const noexcept {
        std::lock_guard<std::mutex> lock(mutex_);
        return tail_;
    }

private:
    size_t capacity_;
    size_t mask_;
    mutable std::mutex mutex_;
    std::vector<T> buffer_;
    uint64_t head_{0};
    uint64_t tail_{0};
};

} // namespace hydra
