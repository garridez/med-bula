#!/usr/bin/env node
/**
 * clean-queue.mjs — limpa prefixos profundos da fila do scrape.
 *
 * Use quando a heurística antiga (sem checar newCount) enfileirou milhares
 * de prefixos de d>=4 que claramente são lixo (mesma fuzzy-match repetida).
 *
 * Mantém os meds/pos JSONs intactos. Só edita o state.
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const STATE_FILE = path.join(__dirname, 'data', '.scrape-state.json')

// Mantém apenas prefixos com até esta quantidade de chars na fila.
// d=3 = 3 caracteres. Tudo >= 4 é descartado.
const MAX_KEEP_LENGTH = 3

const state = JSON.parse(await fs.readFile(STATE_FILE, 'utf8'))

const before = state.queue.length
state.queue = state.queue.filter(p => p.length <= MAX_KEEP_LENGTH)
const after = state.queue.length

console.log(`🧹 Limpeza da fila`)
console.log(`   Antes:    ${before.toLocaleString('pt-BR')} prefixos`)
console.log(`   Depois:   ${after.toLocaleString('pt-BR')} prefixos`)
console.log(`   Removido: ${(before - after).toLocaleString('pt-BR')} (todos com >${MAX_KEEP_LENGTH} chars)`)

state.updatedAt = new Date().toISOString()
await fs.writeFile(STATE_FILE, JSON.stringify(state, null, 2))
console.log(`✅ State salvo.`)
