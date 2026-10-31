#pragma once

#include <iostream>
#include <sstream>
#include <string>

namespace hydra_test {

struct TestContext {
    int failures{0};
};

inline void expect_true(TestContext& context, bool condition, const std::string& message) {
    if (!condition) {
        ++context.failures;
        std::cerr << "FAIL: " << message << '\n';
    }
}

template <typename Left, typename Right>
inline void expect_equal(TestContext& context, const Left& left, const Right& right, const std::string& message) {
    if (!(left == right)) {
        ++context.failures;
        std::ostringstream stream;
        stream << "FAIL: " << message << " expected=" << right << " actual=" << left;
        std::cerr << stream.str() << '\n';
    }
}

inline int finish(const TestContext& context) {
    if (context.failures == 0) {
        std::cout << "ALL TESTS PASSED\n";
        return 0;
    }

    std::cerr << context.failures << " test(s) failed\n";
    return 1;
}

} // namespace hydra_test
