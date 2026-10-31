#pragma once

#include "hydra/concurrent_queue.hpp"

#include <functional>
#include <future>
#include <memory>
#include <thread>
#include <type_traits>
#include <vector>

namespace hydra {

class ThreadPool {
public:
    explicit ThreadPool(std::size_t threads = std::thread::hardware_concurrency());
    ~ThreadPool();

    ThreadPool(const ThreadPool&) = delete;
    ThreadPool& operator=(const ThreadPool&) = delete;

    template <typename F, typename... Args>
    auto submit(F&& f, Args&&... args)
        -> std::future<typename std::invoke_result<F, Args...>::type> {
        using ReturnType = typename std::invoke_result<F, Args...>::type;

        auto task = std::make_shared<std::packaged_task<ReturnType()>>(
            std::bind(std::forward<F>(f), std::forward<Args>(args)...)
        );

        std::future<ReturnType> result = task->get_future();

        work_queue_.push([task]() { (*task)(); });

        return result;
    }

    void shutdown();
    std::size_t worker_count() const noexcept { return workers_.size(); }

private:
    void worker_thread();

    std::vector<std::thread> workers_;
    ConcurrentQueue<std::function<void()>> work_queue_;
};

} // namespace hydra
