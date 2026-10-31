# Multi-stage Docker build for Hydra Stream Sovereign Control Plane
FROM golang:1.22-alpine AS builder

WORKDIR /app

RUN apk add --no-cache git

COPY go.mod ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /hydra-controller ./cmd/hydra-controller

# Stage 2: Runtime Minimal Alpine Container
FROM alpine:3.19

RUN apk --no-cache add ca-certificates tzdata curl

WORKDIR /app

COPY --from=builder /hydra-controller /app/hydra-controller
COPY --from=builder /app/config /app/config

EXPOSE 8080

ENTRYPOINT ["/app/hydra-controller", "-env", "/app/config/hydra.env"]
