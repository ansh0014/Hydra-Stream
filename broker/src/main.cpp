#include "hydra/broker.hpp"
#include "hydra/server.hpp"

#include <atomic>
#include <chrono>
#include <csignal>
#include <cstdlib>
#include <cstring>
#include <iostream>
#include <sstream>
#include <string>
#include <thread>

#ifdef _WIN32
#include <winsock2.h>
#include <ws2tcpip.h>
#else
#include <arpa/inet.h>
#include <netdb.h>
#include <sys/socket.h>
#include <unistd.h>
#endif

namespace {
    std::atomic<bool> g_running{true};

    void signal_handler(int) {
        g_running.store(false);
    }

    std::string get_env_or_default(const char* name, const std::string& def_val) {
        const char* val = std::getenv(name);
        return (val && *val) ? std::string(val) : def_val;
    }

    const char b64_table[] = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

    std::string base64_encode(const std::string& in) {
        std::string out;
        int val = 0, valb = -6;
        for (uint8_t c : in) {
            val = (val << 8) + c;
            valb += 8;
            while (valb >= 0) {
                out.push_back(b64_table[(val >> valb) & 0x3F]);
                valb -= 6;
            }
        }
        if (valb > -6) out.push_back(b64_table[((val << 8) >> (valb + 8)) & 0x3F]);
        while (out.size() % 4) out.push_back('=');
        return out;
    }

    void register_broker_in_etcd(const std::string& etcd_addr, const std::string& broker_id,
                                const std::string& region, uint16_t port, uint16_t health_port,
                                const std::string& advertised_host = "") {
        if (etcd_addr.empty()) return;

        std::string host = etcd_addr;
        std::string port_str = "2379";
        // Strip http:// or https://
        size_t proto_pos = host.find("://");
        if (proto_pos != std::string::npos) {
            host = host.substr(proto_pos + 3);
        }
        size_t colon_pos = host.find(':');
        if (colon_pos != std::string::npos) {
            port_str = host.substr(colon_pos + 1);
            host = host.substr(0, colon_pos);
        }

        addrinfo hints{}, *res = nullptr;
        hints.ai_family = AF_INET;
        hints.ai_socktype = SOCK_STREAM;

        if (getaddrinfo(host.c_str(), port_str.c_str(), &hints, &res) != 0 || !res) {
            std::cerr << "[etcd agent] Could not resolve etcd host: " << host << std::endl;
            return;
        }

        int sock = static_cast<int>(socket(res->ai_family, res->ai_socktype, res->ai_protocol));
        if (sock < 0) {
            freeaddrinfo(res);
            return;
        }

        if (connect(sock, res->ai_addr, static_cast<int>(res->ai_addrlen)) == 0) {
            std::string key = "/registry/brokers/" + broker_id;
            std::string my_host = advertised_host.empty() ? broker_id : advertised_host;
            std::ostringstream val_json;
            val_json << "{\"id\":\"" << broker_id << "\",\"region\":\"" << region
                     << "\",\"endpoint\":\"" << my_host << ":" << port
                     << "\",\"health_port\":" << health_port << ",\"status\":\"HEALTHY\"}";

            std::string key_b64 = base64_encode(key);
            std::string val_b64 = base64_encode(val_json.str());

            std::string body = "{\"key\":\"" + key_b64 + "\",\"value\":\"" + val_b64 + "\"}";
            std::ostringstream http_req;
            http_req << "POST /v3/kv/put HTTP/1.1\r\n"
                     << "Host: " << host << ":" << port_str << "\r\n"
                     << "Content-Type: application/json\r\n"
                     << "Content-Length: " << body.length() << "\r\n"
                     << "Connection: close\r\n\r\n"
                     << body;

            std::string req_str = http_req.str();
            send(sock, req_str.c_str(), static_cast<int>(req_str.length()), 0);
            std::cout << "[etcd agent] Dynamic registration sent to etcd: " << broker_id << " (" << region << ")\n";
        }
#ifdef _WIN32
        closesocket(sock);
#else
        close(sock);
#endif
        freeaddrinfo(res);
    }
}

int main(int argc, char* argv[]) {
    std::signal(SIGINT, signal_handler);
    std::signal(SIGTERM, signal_handler);

    std::string broker_id = get_env_or_default("BROKER_ID", "broker-india-1");
    std::string region = get_env_or_default("REGION", "India");
    uint16_t port = static_cast<uint16_t>(std::stoi(get_env_or_default("PORT", "9092")));
    uint16_t health_port = static_cast<uint16_t>(std::stoi(get_env_or_default("HEALTH_PORT", "8081")));
    std::size_t threads = static_cast<std::size_t>(std::stoi(get_env_or_default("THREADS", "4")));
    std::string etcd_endpoint = get_env_or_default("ETCD_ENDPOINT", "");
    std::string advertised_host = get_env_or_default("ADVERTISED_HOST", "");

    // CLI overrides
    for (int i = 1; i < argc; ++i) {
        std::string arg = argv[i];
        if (arg.rfind("--broker-id=", 0) == 0) {
            broker_id = arg.substr(12);
        } else if (arg.rfind("--region=", 0) == 0) {
            region = arg.substr(9);
        } else if (arg.rfind("--port=", 0) == 0) {
            port = static_cast<uint16_t>(std::stoi(arg.substr(7)));
        } else if (arg.rfind("--health-port=", 0) == 0) {
            health_port = static_cast<uint16_t>(std::stoi(arg.substr(14)));
        } else if (arg.rfind("--threads=", 0) == 0) {
            threads = static_cast<std::size_t>(std::stoi(arg.substr(10)));
        } else if (arg.rfind("--etcd=", 0) == 0) {
            etcd_endpoint = arg.substr(7);
        } else if (arg.rfind("--advertised-host=", 0) == 0) {
            advertised_host = arg.substr(18);
        }
    }

    std::cout << "========================================================\n"
              << "          HYDRA STREAM — REGIONAL BROKER DAEMON         \n"
              << "========================================================\n"
              << "  Broker ID : " << broker_id << "\n"
              << "  Region    : " << region << "\n"
              << "  TCP Port  : " << port << "\n"
              << "  Health    : " << health_port << "\n"
              << "  Threads   : " << threads << "\n"
              << "  etcd      : " << (etcd_endpoint.empty() ? "None (Standalone)" : etcd_endpoint) << "\n"
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

        // Dynamic etcd self-registration
        if (!etcd_endpoint.empty()) {
            register_broker_in_etcd(etcd_endpoint, broker_id, region, port, health_port, advertised_host);
        }

        std::cout << "Broker is ready and accepting requests. Press Ctrl+C to exit.\n";

        // Keepalive loop with dynamic etcd heartbeat
        int heartbeat_counter = 0;
        while (g_running.load()) {
            std::this_thread::sleep_for(std::chrono::milliseconds(500));
            heartbeat_counter++;
            if (heartbeat_counter >= 10) { // every 5 seconds
                heartbeat_counter = 0;
                if (!etcd_endpoint.empty()) {
                    register_broker_in_etcd(etcd_endpoint, broker_id, region, port, health_port, advertised_host);
                }
            }
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
