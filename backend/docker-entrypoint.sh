#!/bin/sh
# =====================================================================
# Backend entrypoint
#   1. roda migrations (idempotente, Adonis trackea)
#   2. roda seed se RUN_SEED=true (idempotente via firstOrCreate)
#   3. starta o servidor
# =====================================================================
set -e

echo ""
echo "================================================"
echo "  med.bula backend — starting"
echo "================================================"

echo "🔄 Running migrations..."
node ace migration:run --force

if [ "${RUN_SEED:-true}" = "true" ]; then
  echo "🌱 Running seeders (idempotent)..."
  node ace db:seed || echo "⚠️  Seed step ended with non-zero — continuing."
else
  echo "⏭  RUN_SEED=false, skipping seed."
fi

echo "🚀 Starting AdonisJS server..."
echo ""
exec node bin/server.js
