#pragma once

#include <cstdint>
#include <string>
#include <vector>

namespace hydra {

namespace protocol {

constexpr uint8_t MAGIC_BYTE = 0x48; // 'H'
constexpr uint8_t PROTOCOL_VERSION = 0x01;

enum OpCode : uint16_t {
    PRODUCE_REQ = 0x0001,
    PRODUCE_ACK = 0x0002,
    FETCH_REQ   = 0x0003,
    FETCH_RES   = 0x0004,
    HEALTH_PING = 0x0005,
    HEALTH_PONG = 0x0006,
    ERROR_RESP  = 0x00FF
};

#pragma pack(push, 1)
struct Header {
    uint8_t magic{MAGIC_BYTE};
    uint8_t version{PROTOCOL_VERSION};
    uint16_t opcode{0};
    uint64_t correlation_id{0};
    uint32_t payload_length{0};
};
#pragma pack(pop)

constexpr size_t HEADER_SIZE = sizeof(Header);

} // namespace protocol

} // namespace hydra
