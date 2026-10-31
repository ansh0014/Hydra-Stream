#pragma once

#include "hydra/broker.hpp"
#include "hydra/protocol.hpp"

#include <atomic>
#include <cstdint>
#include <string>
#include <thread>
#include <vector>

namespace hydra {

class Server {
public:
    explicit Server(Broker& broker, uint16_t port = 9092);
    ~Server();

    Server(const Server&) = delete;
    Server& operator=(const Server&) = delete;

    bool start();
    void stop();

    uint16_t port() const noexcept { return port_; }
    bool is_running() const noexcept { return running_.load(); }

private:
    void accept_loop();
    void handle_client(int client_sock);
    bool process_frame(int client_sock, const protocol::Header& header, const std::vector<uint8_t>& payload);

    Broker& broker_;
    uint16_t port_;
    std::atomic<bool> running_{false};
    int server_socket_{-1};
    std::thread acceptor_thread_;
};

} // namespace hydra
