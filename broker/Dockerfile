FROM gcc:13-bookworm AS build

RUN apt-get update && apt-get install -y --no-install-recommends \
    cmake \
    make \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY CMakeLists.txt ./
COPY include ./include
COPY src ./src
COPY tests ./tests
COPY benchmark ./benchmark

RUN cmake -S . -B build -DCMAKE_BUILD_TYPE=Release && \
    cmake --build build --config Release

FROM debian:bookworm-slim AS runtime

RUN apt-get update && apt-get install -y --no-install-recommends \
    iproute2 \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=build /app/build/hydra_broker /usr/local/bin/hydra_broker
COPY --from=build /app/build/hydra_benchmark /usr/local/bin/hydra_benchmark

EXPOSE 9092 8081

ENTRYPOINT ["/usr/local/bin/hydra_broker"]
