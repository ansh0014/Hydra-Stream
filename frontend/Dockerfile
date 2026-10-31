# Multi-stage Docker build for Hydra Stream Frontend Dashboard
FROM node:20-alpine AS builder

WORKDIR /app

# Cache package dependencies
COPY package*.json ./
RUN npm install

# Copy source code and build production bundle
COPY . .
RUN npm run build

# Stage 2: Runtime Minimal Node server
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV CONTROLLER_URL=http://control-plane:8080
ENV PROMETHEUS_URL=http://prometheus:9090

COPY package*.json ./
RUN npm install --omit=dev

COPY --from=builder /app/dist ./dist
COPY server.js ./

EXPOSE 3000

CMD ["node", "server.js"]
