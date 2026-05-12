# =====================================================================
# Backend — AdonisJS v6
# =====================================================================

# ---------------- Build stage ----------------
FROM node:22-alpine AS builder

WORKDIR /app

# Install deps (incl. dev — needed for build)
COPY package*.json ./
# Strip UTF-8 BOM se algum editor Windows salvou o arquivo com bom.
# Node.js recusa parsear JSON com BOM e cospe "Invalid package config".
RUN sed -i '1s/^\xEF\xBB\xBF//' package.json && \
    npm install

# Copy source and build
COPY . .
RUN node ace build

# ---------------- Runtime stage ----------------
FROM node:22-alpine AS runner

ENV NODE_ENV=production
WORKDIR /app

# tini for proper signal handling (Ctrl+C, SIGTERM from Coolify)
RUN apk add --no-cache tini wget

# Copy built app + entrypoint
COPY --from=builder /app/build /app/
COPY --from=builder /app/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

# Strip BOM defensivo (caso o build tenha propagado)
RUN find /app -maxdepth 3 -name '*.json' -type f \
    -exec sed -i '1s/^\xEF\xBB\xBF//' {} \;

# Install only production deps (Adonis emits a self-contained build/)
RUN npm install --omit=dev --ignore-scripts && \
    npm cache clean --force && \
    sed -i 's/\r$//' /usr/local/bin/docker-entrypoint.sh && \
    chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 3333

ENTRYPOINT ["/sbin/tini", "--", "docker-entrypoint.sh"]
