#include "hydra/server.hpp"
#include "hydra/protocol.hpp"

#include <cstring>
#include <iostream>
#include <sstream>

#ifdef _WIN32
  #include <winsock2.h>
  #include <ws2tcpip.h>
  using socket_t = SOCKET;
  #define ISVALIDSOCKET(s) ((s) != INVALID_SOCKET)
  #define CLOSESOCKET(s) closesocket(s)
#else
  #include <sys/socket.h>
  #include <netinet/in.h>
  #include <arpa/inet.h>
  #include <unistd.h>
  using socket_t = int;
  #define ISVALIDSOCKET(s) ((s) >= 0)
  #define CLOSESOCKET(s) close(s)
  #define INVALID_SOCKET (-1)
  #define SOCKET_ERROR (-1)
#endif

namespace hydra {

namespace {

void init_network() {
#ifdef _WIN32
    static bool initialized = false;
    if (!initialized) {
        WSADATA data;
        WSAStartup(MAKEWORD(2, 2), &data);
        initialized = true;
    }
#endif
}

bool send_all(socket_t sock, const void* data, size_t len) {
    const char* ptr = static_cast<const char*>(data);
    while (len > 0) {
        int sent = send(sock, ptr, static_cast<int>(len), 0);
        if (sent <= 0) {
            return false;
        }
        ptr += sent;
        len -= sent;
    }
    return true;
}

bool recv_all(socket_t sock, void* data, size_t len) {
    char* ptr = static_cast<char*>(data);
    while (len > 0) {
        int received = recv(sock, ptr, static_cast<int>(len), 0);
        if (received <= 0) {
            return false;
        }
        ptr += received;
        len -= received;
    }
    return true;
}

} // anonymous namespace

Server::Server(Broker& broker, uint16_t port)
    : broker_(broker), port_(port) {
    init_network();
}

Server::~Server() {
    stop();
}

bool Server::start() {
    if (running_.load()) {
        return true;
    }

    socket_t s = socket(AF_INET, SOCK_STREAM, IPPROTO_TCP);
    if (!ISVALIDSOCKET(s)) {
        broker_.logger().error("Failed to create TCP socket on port " + std::to_string(port_));
        return false;
    }

    int opt = 1;
#ifdef _WIN32
    setsockopt(s, SOL_SOCKET, SO_REUSEADDR, reinterpret_cast<const char*>(&opt), sizeof(opt));
#else
    setsockopt(s, SOL_SOCKET, SO_REUSEADDR, &opt, sizeof(opt));
#endif

    sockaddr_in addr{};
    addr.sin_family = AF_INET;
    addr.sin_addr.s_addr = INADDR_ANY;
    addr.sin_port = htons(port_);

    if (bind(s, reinterpret_cast<sockaddr*>(&addr), sizeof(addr)) == SOCKET_ERROR) {
        broker_.logger().error("Failed to bind TCP socket to port " + std::to_string(port_));
        CLOSESOCKET(s);
        return false;
    }

    if (listen(s, 128) == SOCKET_ERROR) {
        broker_.logger().error("Failed to listen on TCP socket on port " + std::to_string(port_));
        CLOSESOCKET(s);
        return false;
    }

    server_socket_ = static_cast<int>(s);
    running_.store(true);

    broker_.logger().info("Hydra TCP Server listening on 0.0.0.0:" + std::to_string(port_) + " [Region: " + broker_.region() + "]");

    acceptor_thread_ = std::thread([this] { accept_loop(); });
    return true;
}

void Server::stop() {
    if (running_.exchange(false)) {
        broker_.logger().info("Stopping Hydra TCP Server...");
        if (server_socket_ != -1) {
            socket_t s = static_cast<socket_t>(server_socket_);
            CLOSESOCKET(s);
            server_socket_ = -1;
        }
        if (acceptor_thread_.joinable()) {
            acceptor_thread_.join();
        }
        broker_.logger().info("Hydra TCP Server stopped.");
    }
}

void Server::accept_loop() {
    while (running_.load()) {
        sockaddr_in client_addr{};
#ifdef _WIN32
        int addr_len = sizeof(client_addr);
#else
        socklen_t addr_len = sizeof(client_addr);
#endif
        socket_t client = accept(static_cast<socket_t>(server_socket_), reinterpret_cast<sockaddr*>(&client_addr), &addr_len);
        if (!ISVALIDSOCKET(client)) {
            if (!running_.load()) break;
            continue;
        }

        // Offload client session handling to the thread pool
        int client_fd = static_cast<int>(client);
        broker_.thread_pool().submit([this, client_fd] {
            handle_client(client_fd);
        });
    }
}

void Server::handle_client(int client_sock) {
    socket_t sock = static_cast<socket_t>(client_sock);

    while (running_.load()) {
        protocol::Header header{};
        if (!recv_all(sock, &header, protocol::HEADER_SIZE)) {
            break; // Client disconnected
        }

        if (header.magic != protocol::MAGIC_BYTE || header.version != protocol::PROTOCOL_VERSION) {
            broker_.logger().warn("Invalid protocol magic/version received, dropping connection.");
            break;
        }

        std::vector<uint8_t> payload(header.payload_length);
        if (header.payload_length > 0) {
            if (!recv_all(sock, payload.data(), header.payload_length)) {
                break;
            }
        }

        if (!process_frame(client_sock, header, payload)) {
            break;
        }
    }

    CLOSESOCKET(sock);
}

bool Server::process_frame(int client_sock, const protocol::Header& header, const std::vector<uint8_t>& payload) {
    socket_t sock = static_cast<socket_t>(client_sock);

    switch (header.opcode) {
        case protocol::PRODUCE_REQ: {
            // Payload format: [2B topic_len][topic][2B key_len][key][4B val_len][payload]
            if (payload.size() < 8) return false;

            size_t offset = 0;
            uint16_t topic_len = (payload[offset] << 8) | payload[offset + 1];
            offset += 2;
            if (offset + topic_len > payload.size()) return false;
            std::string topic(reinterpret_cast<const char*>(&payload[offset]), topic_len);
            offset += topic_len;

            if (offset + 2 > payload.size()) return false;
            uint16_t key_len = (payload[offset] << 8) | payload[offset + 1];
            offset += 2;
            if (offset + key_len > payload.size()) return false;
            std::string key(reinterpret_cast<const char*>(&payload[offset]), key_len);
            offset += key_len;

            if (offset + 4 > payload.size()) return false;
            uint32_t val_len = (payload[offset] << 24) | (payload[offset + 1] << 16) | (payload[offset + 2] << 8) | payload[offset + 3];
            offset += 4;
            if (offset + val_len > payload.size()) return false;
            std::string val(reinterpret_cast<const char*>(&payload[offset]), val_len);

            try {
                auto [part_id, assigned_offset] = broker_.produce(topic, key, val);

                // Send PRODUCE_ACK: [4B partition_id][8B assigned_offset]
                protocol::Header ack_header{};
                ack_header.opcode = protocol::PRODUCE_ACK;
                ack_header.correlation_id = header.correlation_id;
                ack_header.payload_length = 12;

                uint8_t ack_payload[12];
                // partition_id (big-endian)
                ack_payload[0] = static_cast<uint8_t>((part_id >> 24) & 0xFF);
                ack_payload[1] = static_cast<uint8_t>((part_id >> 16) & 0xFF);
                ack_payload[2] = static_cast<uint8_t>((part_id >> 8) & 0xFF);
                ack_payload[3] = static_cast<uint8_t>(part_id & 0xFF);
                // assigned_offset (big-endian)
                for (int i = 0; i < 8; ++i) {
                    ack_payload[4 + i] = static_cast<uint8_t>((assigned_offset >> ((7 - i) * 8)) & 0xFF);
                }

                if (!send_all(sock, &ack_header, protocol::HEADER_SIZE)) return false;
                if (!send_all(sock, ack_payload, 12)) return false;
            } catch (const std::exception& ex) {
                // Return ERROR_RESP
                std::string err_msg = ex.what();
                protocol::Header err_header{};
                err_header.opcode = protocol::ERROR_RESP;
                err_header.correlation_id = header.correlation_id;
                err_header.payload_length = static_cast<uint32_t>(err_msg.size());

                if (!send_all(sock, &err_header, protocol::HEADER_SIZE)) return false;
                if (!send_all(sock, err_msg.data(), err_msg.size())) return false;
            }
            return true;
        }

        case protocol::FETCH_REQ: {
            // Payload format: [2B topic_len][topic][4B partition_id][8B start_offset][4B max_count]
            if (payload.size() < 18) return false;

            size_t offset = 0;
            uint16_t topic_len = (payload[offset] << 8) | payload[offset + 1];
            offset += 2;
            if (offset + topic_len > payload.size()) return false;
            std::string topic(reinterpret_cast<const char*>(&payload[offset]), topic_len);
            offset += topic_len;

            uint32_t part_id = (payload[offset] << 24) | (payload[offset + 1] << 16) | (payload[offset + 2] << 8) | payload[offset + 3];
            offset += 4;

            uint64_t start_offset = 0;
            for (int i = 0; i < 8; ++i) {
                start_offset = (start_offset << 8) | payload[offset + i];
            }
            offset += 8;

            uint32_t max_count = (payload[offset] << 24) | (payload[offset + 1] << 16) | (payload[offset + 2] << 8) | payload[offset + 3];

            auto messages = broker_.fetch(topic, part_id, start_offset, max_count);

            // Serialize FETCH_RES: [4B count] + records
            std::vector<uint8_t> res_body;
            uint32_t count = static_cast<uint32_t>(messages.size());
            res_body.push_back((count >> 24) & 0xFF);
            res_body.push_back((count >> 16) & 0xFF);
            res_body.push_back((count >> 8) & 0xFF);
            res_body.push_back(count & 0xFF);

            for (const auto& msg : messages) {
                // [8B offset]
                for (int i = 7; i >= 0; --i) {
                    res_body.push_back(static_cast<uint8_t>((msg.offset >> (i * 8)) & 0xFF));
                }
                // [2B key_len][key]
                uint16_t klen = static_cast<uint16_t>(msg.key.size());
                res_body.push_back((klen >> 8) & 0xFF);
                res_body.push_back(klen & 0xFF);
                res_body.insert(res_body.end(), msg.key.begin(), msg.key.end());
                // [4B val_len][payload]
                uint32_t vlen = static_cast<uint32_t>(msg.payload.size());
                res_body.push_back((vlen >> 24) & 0xFF);
                res_body.push_back((vlen >> 16) & 0xFF);
                res_body.push_back((vlen >> 8) & 0xFF);
                res_body.push_back(vlen & 0xFF);
                res_body.insert(res_body.end(), msg.payload.begin(), msg.payload.end());
            }

            protocol::Header res_header{};
            res_header.opcode = protocol::FETCH_RES;
            res_header.correlation_id = header.correlation_id;
            res_header.payload_length = static_cast<uint32_t>(res_body.size());

            if (!send_all(sock, &res_header, protocol::HEADER_SIZE)) return false;
            if (!send_all(sock, res_body.data(), res_body.size())) return false;
            return true;
        }

        case protocol::HEALTH_PING: {
            // Reply with HEALTH_PONG containing broker ID and region
            std::string status = "{\"broker_id\":\"" + broker_.id() + "\",\"region\":\"" + broker_.region() + "\",\"status\":\"UP\"}";
            protocol::Header pong_header{};
            pong_header.opcode = protocol::HEALTH_PONG;
            pong_header.correlation_id = header.correlation_id;
            pong_header.payload_length = static_cast<uint32_t>(status.size());

            if (!send_all(sock, &pong_header, protocol::HEADER_SIZE)) return false;
            if (!send_all(sock, status.data(), status.size())) return false;
            return true;
        }

        default:
            return false;
    }
}

} // namespace hydra
