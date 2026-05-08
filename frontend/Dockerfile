# =====================================================================
# Frontend — Nuxt 3 (SSR via Nitro)
# =====================================================================

# ---------------- Build stage ----------------
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# ---------------- Runtime stage ----------------
FROM node:22-alpine AS runner

ENV NODE_ENV=production
ENV NITRO_PORT=3000
ENV NITRO_HOST=0.0.0.0

WORKDIR /app

RUN apk add --no-cache tini wget

# .output is self-contained (Nitro bundles deps)
COPY --from=builder /app/.output /app/.output

EXPOSE 3000

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", ".output/server/index.mjs"]