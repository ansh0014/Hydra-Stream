#include "hydra/broker.hpp"
#include "hydra/topic.hpp"
#include "test_framework.hpp"

int main() {
    hydra_test::TestContext context;

    // 1. Test multi-partition topic key routing
    hydra::Topic topic("orders", 4, "ANY");
    hydra_test::expect_equal(context, topic.partition_count(), static_cast<uint32_t>(4), "Topic has 4 partitions");

    hydra::Message m1;
    m1.key = "customer_101";
    m1.payload = "data_1";
    auto [part1, off1] = topic.publish(m1);

    hydra::Message m2;
    m2.key = "customer_101"; // Same key must route to SAME partition
    m2.payload = "data_2";
    auto [part2, off2] = topic.publish(m2);

    hydra_test::expect_equal(context, part1, part2, "Same key must map to identical partition");
    hydra_test::expect_equal(context, off1, static_cast<uint64_t>(0), "First message offset is 0");
    hydra_test::expect_equal(context, off2, static_cast<uint64_t>(1), "Second message offset is 1");

    // 2. Test Legal Data Residency enforcement in Broker
    // Broker in India
    hydra::Broker india_broker("broker-india-1", "India", 2);

    // Topic restricted to Germany (EU GDPR)
    india_broker.create_topic("eu-medical", 2, "Germany");

    // Attempting to produce EU medical records on an Indian broker MUST fail
    bool threw_exception = false;
    try {
        india_broker.produce("eu-medical", "patient_1", "sensitive_health_data");
    } catch (const std::runtime_error& ex) {
        threw_exception = true;
    }
    hydra_test::expect_true(context, threw_exception, "Broker must reject produce violating legal residency");

    // Producing to local topic in India MUST succeed
    india_broker.create_topic("india-orders", 2, "India");
    auto [in_part, in_off] = india_broker.produce("india-orders", "order_1", "chai_tea");
    hydra_test::expect_equal(context, in_off, static_cast<uint64_t>(0), "Local produce succeeds");

    return hydra_test::finish(context);
}
