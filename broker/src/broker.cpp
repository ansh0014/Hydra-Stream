#include "hydra/broker.hpp"

#include <stdexcept>
#include <utility>

namespace hydra {

Broker::Broker(std::string broker_id,
               std::string region,
               std::size_t thread_pool_size,
               std::ostream& log_stream)
    : broker_id_(std::move(broker_id)),
      region_(std::move(region)),
      logger_(log_stream),
      thread_pool_(thread_pool_size) {
    logger_.info("Hydra Broker initialized [ID: " + broker_id_ + " | Region: " + region_ + "]");
}

Broker::~Broker() {
    shutdown();
}

TopicPtr Broker::create_topic(const std::string& name, uint32_t partition_count, const std::string& legal_region) {
    std::lock_guard<std::mutex> lock(mutex_);
    auto it = topics_.find(name);
    if (it != topics_.end()) {
        return it->second;
    }

    auto t = std::make_shared<Topic>(name, partition_count, legal_region);
    topics_[name] = t;
    logger_.info("Topic created: " + name + " (" + std::to_string(partition_count) + " partitions, Legal Region: " + legal_region + ")");
    return t;
}

TopicPtr Broker::topic(const std::string& name) const {
    std::lock_guard<std::mutex> lock(mutex_);
    auto it = topics_.find(name);
    return it != topics_.end() ? it->second : nullptr;
}

std::pair<uint32_t, uint64_t> Broker::produce(const std::string& topic_name,
                                              const std::string& key,
                                              const std::string& payload,
                                              const std::string& producer_id) {
    TopicPtr t = topic(topic_name);
    if (!t) {
        // Auto-create topic with 4 partitions if it does not exist
        t = create_topic(topic_name, 4, "ANY");
    }

    // Strict Legal Data Residency Enforcement:
    // If the topic requires Germany (EU GDPR) but this broker is in India or Singapore, reject!
    if (t->legal_region() != "ANY" && t->legal_region() != region_) {
        metrics_.record_error();
        std::string err = "LEGAL_RESIDENCY_VIOLATION: Topic '" + topic_name + 
                          "' restricted to region '" + t->legal_region() + 
                          "', but received on broker '" + broker_id_ + "' in '" + region_ + "'";
        logger_.error(err);
        throw std::runtime_error(err);
    }

    Message msg;
    msg.topic = topic_name;
    msg.key = key;
    msg.payload = payload;
    msg.producer_id = producer_id;
    msg.legal_region = t->legal_region();

    auto [part_id, offset] = t->publish(std::move(msg));
    metrics_.record_produced(payload.size());

    logger_.debug("Produced to " + topic_name + " [P:" + std::to_string(part_id) + " | Offset:" + std::to_string(offset) + "]");
    return {part_id, offset};
}

std::vector<Message> Broker::fetch(const std::string& topic_name,
                                   uint32_t partition_id,
                                   uint64_t start_offset,
                                   size_t max_count) {
    TopicPtr t = topic(topic_name);
    if (!t) {
        return {};
    }

    auto messages = t->read(partition_id, start_offset, max_count);
    for (const auto& msg : messages) {
        metrics_.record_consumed(msg.payload.size());
    }

    return messages;
}

MetricsSnapshot Broker::metrics() const noexcept {
    return metrics_.snapshot();
}

void Broker::shutdown() {
    logger_.info("Shutting down Hydra Broker [" + broker_id_ + "]...");
    {
        std::lock_guard<std::mutex> lock(mutex_);
        for (auto& [name, t] : topics_) {
            t->close();
        }
    }
    thread_pool_.shutdown();
    logger_.info("Hydra Broker shutdown complete.");
}

} // namespace hydra
