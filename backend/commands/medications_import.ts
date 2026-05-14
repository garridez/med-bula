import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import env from '#start/env'
import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import pg from 'pg'
import { from as copyFrom } from 'pg-copy-streams'

/**
 * Importa o catálogo de medicamentos a partir dos JSONs gerados pelo
 * scraper Cliquerx (scripts/cliquerx-scraper/data/).
 *
 * - Calcula SHA256 dos arquivos
 * - Compara com a última importação registrada em medication_imports
 * - Se igual: SKIP (boot rápido)
 * - Se diferente: TRUNCATE + COPY transacional → registra hashes
 *
 * Roda automaticamente no entrypoint (docker-entrypoint.sh) após migrations.
 * Pode rodar manual: node ace medications:import [--force]
 */
export default class MedicationsImport extends BaseCommand {
  static commandName = 'medications:import'
  static description = 'Importa o catálogo de medicamentos dos JSONs do scraper Cliquerx'

  static options: CommandOptions = {
    // Não precisa do app inicializado completo — usamos pg direto + env.
    startApp: false,
  }

  @flags.boolean({
    description: 'Força reimportação mesmo se o hash bater',
    default: false,
  })
  declare force: boolean

  @flags.string({
    description: 'Diretório dos JSONs (default: ../scripts/cliquerx-scraper/data)',
  })
  declare dataDir: string | undefined

  @flags.string({
    description: 'Origem da importação (auto|manual)',
    default: 'manual',
  })
  declare by: string

  async run() {
    const t0 = Date.now()

    // ---------- resolução de caminhos ----------
    const dataDir = path.resolve(
      this.dataDir ||
		env.get('MEDICATIONS_DATA_DIR', '') ||
		path.join(process.cwd(), 'scripts', 'cliquerx-scraper', 'data')
    )
    const medsFile = path.join(dataDir, 'medications.json')
    const posFile = path.join(dataDir, 'posologies.json')

    this.logger.info(`📁 Data dir: ${dataDir}`)

    // ---------- arquivos existem? ----------
    try {
      await fs.access(medsFile)
      await fs.access(posFile)
    } catch {
      this.logger.warning(
        `⚠️  JSONs não encontrados em ${dataDir}. Skip do import.`
      )
      this.logger.warning(`    Esperado: medications.json e posologies.json`)
      // No boot do Coolify, não queremos quebrar a app se faltar os JSONs.
      // Retorna 0 (sucesso) mas avisa.
      return
    }

    // ---------- hashes ----------
    const medsBuf = await fs.readFile(medsFile)
    const posBuf = await fs.readFile(posFile)
    const medsHash = crypto.createHash('sha256').update(medsBuf).digest('hex')
    const posHash = crypto.createHash('sha256').update(posBuf).digest('hex')

    this.logger.info(`🔑 medications.json hash: ${medsHash.slice(0, 12)}...`)
    this.logger.info(`🔑 posologies.json hash:  ${posHash.slice(0, 12)}...`)

    // ---------- conexão ----------
    const client = new pg.Client({
      host: env.get('DB_HOST', 'localhost'),
      port: Number(env.get('DB_PORT', 5432)),
      user: env.get('DB_USER'),
      password: env.get('DB_PASSWORD'),
      database: env.get('DB_DATABASE'),
    })

    try {
      await client.connect()
    } catch (e: any) {
      this.logger.error(`❌ Falha conectando ao banco: ${e.message}`)
      this.exitCode = 1
      return
    }

    try {
      // ---------- checagem de hash (skip se já importado) ----------
      const last = await client.query<{
        medications_hash: string
        posologies_hash: string
        medications_count: number
        posologies_count: number
        imported_at: Date
      }>(
        `SELECT medications_hash, posologies_hash, medications_count, posologies_count, imported_at
           FROM medication_imports
          ORDER BY id DESC
          LIMIT 1`
      )

      if (
        !this.force &&
        last.rows[0] &&
        last.rows[0].medications_hash === medsHash &&
        last.rows[0].posologies_hash === posHash
      ) {
        this.logger.success(
          `✅ Catálogo já atualizado (importado em ${last.rows[0].imported_at.toISOString()}). ` +
            `${last.rows[0].medications_count} meds, ${last.rows[0].posologies_count} posologias. Skip.`
        )
        return
      }

      // ---------- parse ----------
      const meds = JSON.parse(medsBuf.toString('utf8'))
      const pos = JSON.parse(posBuf.toString('utf8'))

      this.logger.info(
        `📦 ${meds.length.toLocaleString('pt-BR')} medicamentos, ` +
          `${pos.length.toLocaleString('pt-BR')} posologias`
      )

      // dedupe defensivo
      const ids = new Set<string>(meds.map((m: any) => m.id))
      const posClean = pos.filter((p: any) => p.medicationId && ids.has(p.medicationId))
      if (posClean.length !== pos.length) {
        this.logger.warning(
          `⚠️  ${pos.length - posClean.length} posologias órfãs descartadas`
        )
      }

      // ---------- transação ----------
      await client.query('BEGIN')

      this.logger.info('🗑️  TRUNCATE medication_posologies, medications...')
      await client.query(
        'TRUNCATE medication_posologies, medications RESTART IDENTITY CASCADE'
      )

      const tCopyMeds = Date.now()
      this.logger.info('📥 COPY medications...')
      await copyMedications(client, meds)
      this.logger.info(`   ✓ ${Date.now() - tCopyMeds}ms`)

      const tCopyPos = Date.now()
      this.logger.info('📥 COPY medication_posologies...')
      await copyPosologies(client, posClean)
      this.logger.info(`   ✓ ${Date.now() - tCopyPos}ms`)

      // registra a importação
      await client.query(
        `INSERT INTO medication_imports
           (medications_hash, posologies_hash, medications_count,
            posologies_count, imported_by, duration_ms)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [medsHash, posHash, meds.length, posClean.length, this.by, Date.now() - t0]
      )

      await client.query('COMMIT')

      this.logger.success(
        `✅ Import concluído em ${Date.now() - t0}ms: ` +
          `${meds.length} meds, ${posClean.length} posologias`
      )
    } catch (e: any) {
      await client.query('ROLLBACK').catch(() => {})
      this.logger.error(`❌ Import falhou — ROLLBACK: ${e.message}`)
      this.logger.error(e.stack ?? '')
      this.exitCode = 1
    } finally {
      await client.end()
    }
  }
}

// ---------- helpers COPY ----------

function csvEscape(v: any): string {
  if (v === null || v === undefined) return '\\N'
  if (typeof v === 'string' && v.trim() === '') return '\\N'
  let s = typeof v === 'string' ? v : String(v)
  if (/[",\n\r\t]/.test(s)) {
    s = '"' + s.replace(/"/g, '""') + '"'
  }
  return s
}

function csvLine(values: any[]): string {
  return values.map(csvEscape).join(',') + '\n'
}

function parsePrice(v: any): string | null {
  if (v == null || v === '') return null
  if (typeof v === 'number') return v.toFixed(2)
  return String(v).replace(/\./g, '').replace(',', '.')
}

function bool(v: any): string {
  if (v === true) return 't'
  if (v === false) return 'f'
  return '\\N'
}

async function copyMedications(client: pg.Client, meds: any[]) {
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
      const campaign = m.campaign != null ? JSON.stringify(m.campaign) : null
      yield csvLine([
        m.id, m.title, m.subtitle, m.description, m.laboratoryName,
        m.category, parsePrice(m.maxPrice), bool(m.available),
        m.listType, m.prescriptionType, m.ean1, bool(m.requiresCpf),
        m.unit?.singular, m.unit?.plural, campaign, now,
      ])
    }
  }

  await pipeline(Readable.from(gen()), stream)
}

async function copyPosologies(client: pg.Client, pos: any[]) {
  const cols = [
    'medication_id', 'posology_id', 'content', 'usage_quantity',
    'indication', 'population', 'age_range', 'type', 'created_at',
  ]
  const sql = `COPY medication_posologies (${cols.join(',')}) FROM STDIN WITH (FORMAT csv, NULL '\\N')`
  const stream = client.query(copyFrom(sql))

  const now = new Date().toISOString()

  async function* gen() {
    for (const p of pos) {
      yield csvLine([
        p.medicationId, p.posologyId, p.content ?? '',
        p.usageQuantity, p.indication, p.population, p.ageRange,
        p.type, now,
      ])
    }
  }

  await pipeline(Readable.from(gen()), stream)
}
