#include "hydra/concurrent_queue.hpp"
#include "test_framework.hpp"

int main() {
    hydra_test::TestContext context;

    hydra::ConcurrentQueue<int> queue(10);

    queue.push(7);
    queue.push(11);

    int value = 0;
    hydra_test::expect_true(context, queue.try_pop(value), "try_pop should succeed");
    hydra_test::expect_equal(context, value, 7, "first value should match");

    hydra_test::expect_true(context, queue.wait_and_pop(value), "wait_and_pop should succeed");
    hydra_test::expect_equal(context, value, 11, "second value should match");

    queue.close();
    hydra_test::expect_true(context, !queue.wait_and_pop(value), "closed empty queue should return false");

    return hydra_test::finish(context);
}
