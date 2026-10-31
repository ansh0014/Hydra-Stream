cmake_minimum_required(VERSION 3.16)

project(hydra_stream VERSION 1.0.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

find_package(Threads REQUIRED)

add_library(hydra_core STATIC
    src/partition.cpp
    src/topic.cpp
    src/thread_pool.cpp
    src/logger.cpp
    src/broker.cpp
    src/server.cpp
)

target_include_directories(hydra_core
    PUBLIC
        ${CMAKE_CURRENT_SOURCE_DIR}/include
)

target_link_libraries(hydra_core
    PUBLIC
        Threads::Threads
)

if(WIN32)
    target_link_libraries(hydra_core PUBLIC ws2_32)
endif()

add_executable(hydra_broker
    src/main.cpp
)

target_link_libraries(hydra_broker
    PRIVATE
        hydra_core
)

add_executable(hydra_benchmark
    benchmark/benchmark.cpp
)

target_link_libraries(hydra_benchmark
    PRIVATE
        hydra_core
)

enable_testing()

add_executable(test_concurrent_queue tests/test_concurrent_queue.cpp)
target_link_libraries(test_concurrent_queue PRIVATE hydra_core)
add_test(NAME concurrent_queue COMMAND test_concurrent_queue)

add_executable(test_partition tests/test_partition.cpp)
target_link_libraries(test_partition PRIVATE hydra_core)
add_test(NAME partition COMMAND test_partition)

add_executable(test_topic tests/test_topic.cpp)
target_link_libraries(test_topic PRIVATE hydra_core)
add_test(NAME topic COMMAND test_topic)

add_executable(test_pipeline tests/test_pipeline.cpp)
target_link_libraries(test_pipeline PRIVATE hydra_core)
add_test(NAME pipeline COMMAND test_pipeline)

add_executable(test_server tests/test_server.cpp)
target_link_libraries(test_server PRIVATE hydra_core)
add_test(NAME server COMMAND test_server)
