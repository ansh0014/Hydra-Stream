#pragma once

#include "hydra/concurrent_queue.hpp"

#include <atomic>
#include <chrono>
#include <iostream>
#include <mutex>
#include <ostream>
#include <string>
#include <thread>

namespace hydra {

class Logger {
public:
    enum class Level {
        Debug,
        Info,
        Warning,
        Error
    };

    struct Record {
        Level level;
        std::string message;
        std::chrono::system_clock::time_point timestamp;
    };

    explicit Logger(std::ostream& output = std::cout);
    ~Logger();

    Logger(const Logger&) = delete;
    Logger& operator=(const Logger&) = delete;

    void log(Level level, std::string message);
    void debug(std::string message);
    void info(std::string message);
    void warn(std::string message);
    void error(std::string message);

    void stop();

private:
    void run();
    std::string format(const Record& record) const;
    static std::string level_to_string(Level level);

    std::ostream* output_;
    std::mutex output_mutex_;
    ConcurrentQueue<Record> records_;
    std::atomic<bool> running_{true};
    std::thread worker_;
};

} // namespace hydra
