#!/usr/bin/env node
/**
 * import.mjs — popula o Postgres a partir dos JSONs gerados pelo scrape.
 *
 * Estratégia: COPY FROM STDIN em formato CSV. Bem mais rápido que INSERT em batch.
 *
 * Fluxo:
 *   1. abre transação
 *   2. TRUNCATE medication_posologies, medications (idempotente, CASCADE)
 *   3. COPY medications a partir do JSON
 *   4. COPY medication_posologies a partir do JSON
 *   5. COMMIT
 *
 * Uso: node --env-file=.env import.mjs
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'
import { from as copyFrom } from 'pg-copy-streams'
import { pipeline } from 'node:stream/promises'
import { Readable } from 'node:stream'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.join(__dirname, 'data')
const MEDS_FILE = path.join(DATA_DIR, 'medications.json')
const POS_FILE = path.join(DATA_DIR, 'posologies.json')

// ---------- CSV helpers ----------

function csvEscape(v) {
  if (v === null || v === undefined) return '' // virará NULL com NULL ''
  let s = typeof v === 'string' ? v : String(v)
  // pra COPY CSV: precisa quotar se tem vírgula, aspas, quebra ou começa com espaço
  if (/[",\n\r]/.test(s) || s.includes('\t')) {
    s = '"' + s.replace(/"/g, '""') + '"'
    return s
  }
  return s
}

function csvLine(values) {
  return values.map(csvEscape).join(',') + '\n'
}

// preço vem como string "19,78" — converte pra numeric do Postgres
function parsePrice(v) {
  if (v == null || v === '') return null
  if (typeof v === 'number') return v.toFixed(2)
  return String(v).replace(/\./g, '').replace(',', '.')
}

function bool(v) {
  if (v === true) return 't'
  if (v === false) return 'f'
  return null
}

function nullIfEmpty(v) {
  if (v === null || v === undefined) return null
  if (typeof v === 'string' && v.trim() === '') return null
  return v
}

// ---------- main ----------

async function loadJson(file) {
  return JSON.parse(await fs.readFile(file, 'utf8'))
}

async function copyMedications(client, meds) {
  const cols = [
    'id', 'title', 'subtitle', 'description', 'laboratory_name',
    'category', 'max_price', 'available', 'list_type', 'prescription_type',
    'ean1', 'requires_cpf', 'unit_singular', 'unit_plural', 'campaign',
    'created_at',
  ]

  const sql = `COPY medications (${cols.join(',')}) FROM STDIN WITH (FORMAT csv, NULL '\\N')`
  const stream = client.query(copyFrom(sql))

  const now = new Date().toISOString()
  async function* gen() {
    for (const m of meds) {
      // campaign vem como objeto/null — serializa como JSON
      const campaign = m.campaign != null ? JSON.stringify(m.campaign) : null
      yield csvLine([
        m.id,
        m.title,
        nullIfEmpty(m.subtitle) ?? '\\N',
        nullIfEmpty(m.description) ?? '\\N',
        nullIfEmpty(m.laboratoryName) ?? '\\N',
        nullIfEmpty(m.category) ?? '\\N',
        parsePrice(m.maxPrice) ?? '\\N',
        bool(m.available) ?? '\\N',
        nullIfEmpty(m.listType) ?? '\\N',
        nullIfEmpty(m.prescriptionType) ?? '\\N',
        nullIfEmpty(m.ean1) ?? '\\N',
        bool(m.requiresCpf) ?? '\\N',
        nullIfEmpty(m.unit?.singular) ?? '\\N',
        nullIfEmpty(m.unit?.plural) ?? '\\N',
        campaign ?? '\\N',
        now,
      ])
    }
  }

  await pipeline(Readable.from(gen()), stream)
}

async function copyPosologies(client, pos) {
  const cols = [
    'medication_id', 'posology_id', 'content', 'usage_quantity',
    'indication', 'population', 'age_range', 'type', 'created_at',
  ]
  const sql = `COPY medication_posologies (${cols.join(',')}) FROM STDIN WITH (FORMAT csv, NULL '\\N')`
  const stream = client.query(copyFrom(sql))

  const now = new Date().toISOString()
  async function* gen() {
    for (const p of pos) {
      // p.medicationId foi atribuído pelo scraper
      yield csvLine([
        p.medicationId,
        nullIfEmpty(p.posologyId) ?? '\\N',
        p.content ?? '',
        p.usageQuantity ?? '\\N',
        nullIfEmpty(p.indication) ?? '\\N',
        nullIfEmpty(p.population) ?? '\\N',
        nullIfEmpty(p.ageRange) ?? '\\N',
        nullIfEmpty(p.type) ?? '\\N',
        now,
      ])
    }
  }

  await pipeline(Readable.from(gen()), stream)
}

async function main() {
  console.log('📥 Importer Cliquerx → Postgres\n')

  let meds, pos
  try {
    meds = await loadJson(MEDS_FILE)
    pos = await loadJson(POS_FILE)
  } catch (e) {
    console.error(`❌ Não consegui ler os JSONs: ${e.message}`)
    console.error(`   Rode o scrape.mjs primeiro.`)
    process.exit(1)
  }

  console.log(`   ${meds.length.toLocaleString('pt-BR')} medicamentos`)
  console.log(`   ${pos.length.toLocaleString('pt-BR')} posologias`)
  console.log(`   Banco: ${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_DATABASE}`)
  console.log('')

  // valida: cada posologia tem medication_id existente?
  const ids = new Set(meds.map(m => m.id))
  const orphan = pos.filter(p => !ids.has(p.medicationId))
  if (orphan.length) {
    console.warn(`⚠️  ${orphan.length} posologias sem medicamento correspondente — vão ser descartadas.`)
  }
  const posClean = pos.filter(p => ids.has(p.medicationId))

  const client = new pg.Client({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
  })
  await client.connect()

  try {
    await client.query('BEGIN')

    console.log('🗑️  TRUNCATE medication_posologies, medications...')
    await client.query('TRUNCATE medication_posologies, medications RESTART IDENTITY CASCADE')

    console.log(`📦 COPY medications (${meds.length})...`)
    const t1 = Date.now()
    await copyMedications(client, meds)
    console.log(`   ✓ ${Date.now() - t1}ms`)

    console.log(`📦 COPY medication_posologies (${posClean.length})...`)
    const t2 = Date.now()
    await copyPosologies(client, posClean)
    console.log(`   ✓ ${Date.now() - t2}ms`)

    await client.query('COMMIT')
    console.log('\n✅ Import concluído com sucesso.')

    // estatísticas pós-import
    const r1 = await client.query('SELECT COUNT(*) FROM medications')
    const r2 = await client.query('SELECT COUNT(*) FROM medication_posologies')
    console.log(`   medications:           ${r1.rows[0].count}`)
    console.log(`   medication_posologies: ${r2.rows[0].count}`)
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {})
    console.error('\n❌ Erro no import — ROLLBACK feito:', e)
    process.exit(1)
  } finally {
    await client.end()
  }
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
