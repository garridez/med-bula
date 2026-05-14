#!/usr/bin/env node
/**
 * search.mjs — busca local nos dados scraped.
 *
 * Procura por substring (case-insensitive, sem acento) em title,
 * description e laboratoryName. Não chama a API — só lê os JSONs locais.
 *
 * Uso:
 *   npm run search -- "novalgina"
 *   npm run search -- "mounjaro"
 *   npm run search -- "dorflex"
 *
 * Ou direto:
 *   node search.mjs novalgina
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const MEDS_FILE = path.join(__dirname, 'data', 'medications.json')
const POS_FILE = path.join(__dirname, 'data', 'posologies.json')

function normalize(s) {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
}

async function main() {
  const queries = process.argv.slice(2).filter(a => !a.startsWith('--'))
  if (queries.length === 0) {
    console.error('Uso: npm run search -- "termo"')
    console.error('Ex:  npm run search -- "novalgina"')
    process.exit(1)
  }

  const meds = JSON.parse(await fs.readFile(MEDS_FILE, 'utf8'))
  const pos = JSON.parse(await fs.readFile(POS_FILE, 'utf8'))
  const posByMed = new Map()
  for (const p of pos) {
    posByMed.set(p.medicationId, (posByMed.get(p.medicationId) || 0) + 1)
  }

  for (const q of queries) {
    const term = normalize(q)
    const matches = meds.filter(m =>
      normalize(m.title).includes(term) ||
      normalize(m.description).includes(term) ||
      normalize(m.laboratoryName).includes(term)
    )

    console.log(`\n${'='.repeat(70)}`)
    console.log(`🔍 "${q}"`)
    console.log('='.repeat(70))
    console.log(`Encontrados: ${matches.length} medicamentos`)

    if (matches.length === 0) {
      console.log(`❌ NADA — esse termo não aparece em title/description/lab.`)
      continue
    }

    // estatísticas
    const withPos = matches.filter(m => posByMed.has(m.id)).length
    const labs = [...new Set(matches.map(m => m.laboratoryName))].filter(Boolean)
    const cats = [...new Set(matches.map(m => m.category))].filter(Boolean)

    console.log(`Com posologia:     ${withPos}/${matches.length} (${((withPos / matches.length) * 100).toFixed(0)}%)`)
    console.log(`Laboratórios:      ${labs.length} (${labs.slice(0, 5).join(', ')}${labs.length > 5 ? '...' : ''})`)
    console.log(`Categorias:        ${cats.join(', ')}`)

    console.log(`\nPrimeiros 15:`)
    for (const m of matches.slice(0, 15)) {
      const posCount = posByMed.get(m.id) || 0
      const tag = posCount > 0 ? `✓${posCount}p` : '—'
      console.log(`  [${tag.padStart(4)}] ${(m.title || '').padEnd(45)} | ${m.category?.padEnd(15) || '?'} | ${m.laboratoryName || '?'}`)
    }
    if (matches.length > 15) {
      console.log(`  ... (+${matches.length - 15})`)
    }
  }
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
