# =====================================================================
# Backend — AdonisJS v6
# =====================================================================

# ---------------- Build stage ----------------
FROM node:22-alpine AS builder

WORKDIR /app

# Install deps (incl. dev — needed for build)
COPY package*.json ./
RUN npm install

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

# Install only production deps (Adonis emits a self-contained build/)
RUN npm install --omit=dev --ignore-scripts && \
    npm cache clean --force && \
    chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 3333

ENTRYPOINT ["/sbin/tini", "--", "docker-entrypoint.sh"]