#include "hydra/broker.hpp"
#include "hydra/server.hpp"

#include <csignal>
#include <cstdlib>
#include <iostream>
#include <string>

namespace {
    std::atomic<bool> g_running{true};

    void signal_handler(int) {
        g_running.store(false);
    }

    std::string get_env_or_default(const char* name, const std::string& def_val) {
        const char* val = std::getenv(name);
        return (val && *val) ? std::string(val) : def_val;
    }
}

int main(int argc, char* argv[]) {
    std::signal(SIGINT, signal_handler);
    std::signal(SIGTERM, signal_handler);

    std::string broker_id = get_env_or_default("BROKER_ID", "broker-india-1");
    std::string region = get_env_or_default("REGION", "India");
    uint16_t port = static_cast<uint16_t>(std::stoi(get_env_or_default("PORT", "9092")));
    std::size_t threads = static_cast<std::size_t>(std::stoi(get_env_or_default("THREADS", "4")));

    // CLI overrides
    for (int i = 1; i < argc; ++i) {
        std::string arg = argv[i];
        if (arg.rfind("--broker-id=", 0) == 0) {
            broker_id = arg.substr(12);
        } else if (arg.rfind("--region=", 0) == 0) {
            region = arg.substr(9);
        } else if (arg.rfind("--port=", 0) == 0) {
            port = static_cast<uint16_t>(std::stoi(arg.substr(7)));
        } else if (arg.rfind("--threads=", 0) == 0) {
            threads = static_cast<std::size_t>(std::stoi(arg.substr(10)));
        }
    }

    std::cout << "========================================================\n"
              << "          HYDRA STREAM — REGIONAL BROKER DAEMON         \n"
              << "========================================================\n"
              << "  Broker ID : " << broker_id << "\n"
              << "  Region    : " << region << "\n"
              << "  TCP Port  : " << port << "\n"
              << "  Threads   : " << threads << "\n"
              << "========================================================\n"
              << std::endl;

    try {
        hydra::Broker broker(broker_id, region, threads);

        // Pre-create regional topics with legal boundaries
        broker.create_topic("india-orders", 4, "India");
        broker.create_topic("eu-payments", 4, "Germany");
        broker.create_topic("global-telemetry", 4, "ANY");

        hydra::Server server(broker, port);
        if (!server.start()) {
            std::cerr << "Fatal: Failed to start Hydra TCP Server on port " << port << std::endl;
            return 1;
        }

        std::cout << "Broker is ready and accepting requests. Press Ctrl+C to exit.\n";

        while (g_running.load()) {
            std::this_thread::sleep_for(std::chrono::milliseconds(200));
        }

        std::cout << "\nShutdown signal received. Stopping server..." << std::endl;
        server.stop();
        broker.shutdown();

        auto snapshot = broker.metrics();
        std::cout << "Execution Summary:\n"
                  << "  Messages Produced : " << snapshot.produced << "\n"
                  << "  Messages Consumed : " << snapshot.consumed << "\n"
                  << "  Bytes In          : " << snapshot.bytes_in << "\n"
                  << "  Bytes Out         : " << snapshot.bytes_out << "\n"
                  << "  Errors Recorded   : " << snapshot.errors << "\n";

        return 0;
    } catch (const std::exception& ex) {
        std::cerr << "Fatal Exception: " << ex.what() << std::endl;
        return 1;
    }
}
