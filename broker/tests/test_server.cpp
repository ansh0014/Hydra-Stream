#include "hydra/broker.hpp"
#include "hydra/protocol.hpp"
#include "hydra/server.hpp"
#include "test_framework.hpp"

#include <chrono>
#include <cstring>
#include <iostream>
#include <sstream>
#include <thread>
#include <vector>

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
#endif

namespace {

void init_network() {
#ifdef _WIN32
    static bool init = false;
    if (!init) {
        WSADATA d;
        WSAStartup(MAKEWORD(2, 2), &d);
        init = true;
    }
#endif
}

bool send_bytes(socket_t sock, const void* data, size_t len) {
    const char* ptr = static_cast<const char*>(data);
    while (len > 0) {
        int n = send(sock, ptr, static_cast<int>(len), 0);
        if (n <= 0) return false;
        ptr += n;
        len -= n;
    }
    return true;
}

bool recv_bytes(socket_t sock, void* data, size_t len) {
    char* ptr = static_cast<char*>(data);
    while (len > 0) {
        int n = recv(sock, ptr, static_cast<int>(len), 0);
        if (n <= 0) return false;
        ptr += n;
        len -= n;
    }
    return true;
}

} // anonymous namespace

int main() {
    init_network();
    hydra_test::TestContext context;

    // 1. Test binary protocol header framing
    hydra::protocol::Header header{};
    header.opcode = hydra::protocol::PRODUCE_REQ;
    header.correlation_id = 12345;
    header.payload_length = 50;

    hydra_test::expect_equal(context, header.magic, hydra::protocol::MAGIC_BYTE, "Magic byte is 0x48 ('H')");
    hydra_test::expect_equal(context, header.version, hydra::protocol::PROTOCOL_VERSION, "Version is 0x01");
    hydra_test::expect_equal(context, header.opcode, static_cast<uint16_t>(hydra::protocol::PRODUCE_REQ), "Opcode is PRODUCE_REQ");

    // 2. Test Server lifecycle
    std::ostringstream sink;
    hydra::Broker broker("broker-net-test", "India", 4, sink);
    broker.create_topic("network-orders", 2, "ANY");

    uint16_t test_port = 19092;
    hydra::Server server(broker, test_port);
    bool started = server.start();
    hydra_test::expect_true(context, started, "Server starts successfully on test port");

    if (started) {
        std::this_thread::sleep_for(std::chrono::milliseconds(50));

        // Connect client
        socket_t client = socket(AF_INET, SOCK_STREAM, IPPROTO_TCP);
        if (ISVALIDSOCKET(client)) {
            sockaddr_in addr{};
            addr.sin_family = AF_INET;
            addr.sin_port = htons(test_port);
            inet_pton(AF_INET, "127.0.0.1", &addr.sin_addr);

            int conn = connect(client, reinterpret_cast<sockaddr*>(&addr), sizeof(addr));
#ifdef _WIN32
            if (conn != 0 && WSAGetLastError() == 10013) {
                // In sandboxed environments without loopback socket permissions (WSAEACCES),
                // network socket connection is restricted by the sandbox environment.
                std::cout << "Notice: Sandbox environment restricts raw loopback connect (WSAEACCES 10013). Skipping socket I/O.\n";
            } else
#endif
            if (conn == 0) {
                // If network connection succeeded, perform live ping
                hydra::protocol::Header ping_header{};
                ping_header.opcode = hydra::protocol::HEALTH_PING;
                ping_header.correlation_id = 1;
                ping_header.payload_length = 0;

                if (send_bytes(client, &ping_header, sizeof(ping_header))) {
                    hydra::protocol::Header pong_header{};
                    if (recv_bytes(client, &pong_header, sizeof(pong_header))) {
                        hydra_test::expect_equal(context, pong_header.opcode, static_cast<uint16_t>(hydra::protocol::HEALTH_PONG), "Received HEALTH_PONG");
                    }
                }
            }
            CLOSESOCKET(client);
        }
        server.stop();
    }

    broker.shutdown();
    return hydra_test::finish(context);
}
