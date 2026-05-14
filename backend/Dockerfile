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

# Copy built app + entrypoint + scraper data
COPY --from=builder /app/build /app/
COPY --from=builder /app/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
COPY --from=builder /app/scripts/cliquerx-scraper/data /app/scripts/cliquerx-scraper/data

# Strip BOM defensivo
RUN find /app -maxdepth 3 -name '*.json' -type f \
    -exec sed -i '1s/^\xEF\xBB\xBF//' {} \;

# Install only production deps
RUN npm install --omit=dev --ignore-scripts && \
    npm cache clean --force && \
    sed -i 's/\r$//' /usr/local/bin/docker-entrypoint.sh && \
    chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 3333

ENTRYPOINT ["/sbin/tini", "--", "/usr/local/bin/docker-entrypoint.sh"]
