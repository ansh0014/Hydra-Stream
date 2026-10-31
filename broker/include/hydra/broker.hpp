#pragma once

#include "hydra/logger.hpp"
#include "hydra/message.hpp"
#include "hydra/metrics.hpp"
#include "hydra/thread_pool.hpp"
#include "hydra/topic.hpp"

#include <iostream>
#include <memory>
#include <mutex>
#include <string>
#include <unordered_map>
#include <vector>

namespace hydra {

class Broker {
public:
    explicit Broker(std::string broker_id = "hydra-broker-1",
                    std::string region = "India",
                    std::size_t thread_pool_size = 4,
                    std::ostream& log_stream = std::cout);
    ~Broker();

    Broker(const Broker&) = delete;
    Broker& operator=(const Broker&) = delete;

    const std::string& id() const noexcept { return broker_id_; }
    const std::string& region() const noexcept { return region_; }

    TopicPtr create_topic(const std::string& name, uint32_t partition_count = 4, const std::string& legal_region = "ANY");
    TopicPtr topic(const std::string& name) const;

    // Publishes a message with strict legal data residency validation
    std::pair<uint32_t, uint64_t> produce(const std::string& topic_name,
                                          const std::string& key,
                                          const std::string& payload,
                                          const std::string& producer_id = "client");

    // Fetches messages starting at offset without deleting
    std::vector<Message> fetch(const std::string& topic_name,
                               uint32_t partition_id,
                               uint64_t start_offset,
                               size_t max_count);

    MetricsSnapshot metrics() const noexcept;
    Logger& logger() noexcept { return logger_; }
    ThreadPool& thread_pool() noexcept { return thread_pool_; }

    void shutdown();

private:
    std::string broker_id_;
    std::string region_;

    mutable std::mutex mutex_;
    std::unordered_map<std::string, TopicPtr> topics_;

    Metrics metrics_;
    Logger logger_;
    ThreadPool thread_pool_;
};

} // namespace hydra
