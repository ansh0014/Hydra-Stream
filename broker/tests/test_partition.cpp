#include "hydra/partition.hpp"
#include "test_framework.hpp"

int main() {
    hydra_test::TestContext context;

    hydra::Partition partition(0, 1000);

    hydra::Message m1;
    m1.key = "user_1";
    m1.payload = "order_created";
    uint64_t off1 = partition.append(m1);

    hydra::Message m2;
    m2.key = "user_2";
    m2.payload = "order_paid";
    uint64_t off2 = partition.append(m2);

    hydra_test::expect_equal(context, off1, static_cast<uint64_t>(0), "First offset must be 0");
    hydra_test::expect_equal(context, off2, static_cast<uint64_t>(1), "Second offset must be 1");
    hydra_test::expect_equal(context, partition.size(), static_cast<size_t>(2), "Partition size must be 2");

    // Consumer A reads from offset 0
    auto read_a = partition.read(0, 10);
    hydra_test::expect_equal(context, read_a.size(), static_cast<size_t>(2), "Consumer A reads 2 messages");
    hydra_test::expect_equal(context, read_a[0].payload, std::string("order_created"), "First message matches");
    hydra_test::expect_equal(context, read_a[1].payload, std::string("order_paid"), "Second message matches");

    // Consumer B reads from offset 1 (verify messages are retained, NOT popped!)
    auto read_b = partition.read(1, 10);
    hydra_test::expect_equal(context, read_b.size(), static_cast<size_t>(1), "Consumer B reads from offset 1");
    hydra_test::expect_equal(context, read_b[0].payload, std::string("order_paid"), "Message retained");

    // Partition size is STILL 2 because messages are retained
    hydra_test::expect_equal(context, partition.size(), static_cast<size_t>(2), "Messages are retained in partition log");

    return hydra_test::finish(context);
}
