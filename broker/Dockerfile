FROM gcc:13-bookworm AS build

WORKDIR /app

COPY CMakeLists.txt ./
COPY include ./include
COPY src ./src
COPY tests ./tests

RUN cmake -S . -B build -DCMAKE_BUILD_TYPE=Release && \
    cmake --build build --config Release

FROM debian:bookworm-slim AS runtime

RUN useradd --create-home --shell /usr/sbin/nologin appuser

WORKDIR /home/appuser

COPY --from=build /app/build/hydra_broker /usr/local/bin/hydra_broker

USER appuser

EXPOSE 9092 8081

ENTRYPOINT ["/usr/local/bin/hydra_broker"]
