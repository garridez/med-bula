#!/bin/sh
# docker-entrypoint.sh — boot sequence pro Coolify
#
# IMPORTANTE: arquivo precisa ter line endings LF (não CRLF) e estar
# sem BOM UTF-8 — o Dockerfile já trata isso, mas se editar no Windows,
# converta antes (no VSCode: bottom-right "CRLF" → "LF").
set -e

echo "🔧 Aplicando migrations pendentes..."
node ace migration:run --force

echo "💊 Importando catálogo de medicamentos (skip se hash bater)..."
node ace medications:import --by=auto || {
  # Se o import falhar, AVISA mas não bloqueia o boot.
  # O app ainda funciona com o catálogo da última importação válida.
  echo "⚠️  Import de medicamentos falhou — seguindo com catálogo atual."
}

echo "🚀 Iniciando servidor..."
exec node bin/server.js
