#!/usr/bin/env node
/**
 * deep-fill.mjs — pente fino pós-validate.
 *
 * Lê validation-report.json, pega os nomes que bateram cap (returned >= 40)
 * — sinal de que a API tem MAIS resultados escondidos — e refina cada query
 * com concentrações + formas farmacêuticas.
 *
 * Exemplo: rosuvastatina retornou 44 (cap). Vamos fazer:
 *   q="rosuvastatina 10mg" → novos resultados que não cabiam em q="rosuvastatina"
 *   q="rosuvastatina 20mg" → idem
 *   q="rosuvastatina 40mg" → idem
 *   ...
 *
 * Dedupe contra medications.json. Adiciona novos meds + posologias.
 *
 * Uso: node --env-file=.env deep-fill.mjs
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { fetchProducts, fetchPosology } from './lib-api.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.join(__dirname, 'data')
const MEDS_FILE = path.join(DATA_DIR, 'medications.json')
const POS_FILE = path.join(DATA_DIR, 'posologies.json')
const REPORT_FILE = path.join(DATA_DIR, 'validation-report.json')
const DEEP_REPORT_FILE = path.join(DATA_DIR, 'deep-fill-report.json')

const CONCURRENCY = Number(process.env.SCRAPER_CONCURRENCY || 4)
const DELAY_MS = Number(process.env.SCRAPER_DELAY_MS || 180)
const FETCH_POSOLOGIES =
  String(process.env.SCRAPER_FETCH_POSOLOGIES ?? 'true') === 'true'

// Trigger: queries que retornaram >= este número são candidatas a refinamento
const CAP_THRESHOLD = 40

// Sufixos pra refinar. Concentrações + formas farmacêuticas comuns no Brasil.
const SUFFIXES = [
  // concentrações em mg
  '10mg', '20mg', '25mg', '40mg', '50mg', '75mg',
  '100mg', '200mg', '250mg', '500mg',
  // formas farmacêuticas
  'gotas', 'xarope', 'injetável', 'pomada',
]

const sleep = ms => new Promise(r => setTimeout(r, ms))
const jitter = ms => ms * (0.7 + Math.random() * 0.6)

async function loadJson(file, fb) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'))
  } catch {
    return fb
  }
}

async function saveJson(file, data) {
  const tmp = file + '.tmp'
  await fs.writeFile(tmp, JSON.stringify(data, null, 2))
  await fs.rename(tmp, file)
}

async function main() {
  const report = await loadJson(REPORT_FILE, null)
  if (!report?.perName) {
    console.error('❌ validation-report.json ausente. Roda validate.mjs primeiro.')
    process.exit(1)
  }

  // backups
  await fs.copyFile(MEDS_FILE, MEDS_FILE + '.bak2').catch(() => {})
  await fs.copyFile(POS_FILE, POS_FILE + '.bak2').catch(() => {})
  console.log('💾 Backup (.bak2) criado')

  const meds = await loadJson(MEDS_FILE, [])
  const pos = await loadJson(POS_FILE, [])
  const knownIds = new Set(meds.map(m => m.id))
  const posByMedId = new Set(pos.map(p => p.medicationId))
  const initialCount = meds.length

  // pega só os nomes que bateram cap
  const cappedNames = Object.entries(report.perName)
    .filter(([_, r]) => r.returned >= CAP_THRESHOLD)
    .map(([n]) => n)

  console.log(`🔬 Deep-fill iniciado`)
  console.log(`   Nomes que bateram cap: ${cappedNames.length}`)
  console.log(`   Sufixos por nome:      ${SUFFIXES.length}`)
  console.log(`   Total de queries:      ${cappedNames.length * SUFFIXES.length}`)
  console.log(`   Já no medications:     ${initialCount}`)
  console.log('')

  // gera fila de queries
  const queue = []
  for (const name of cappedNames) {
    for (const suffix of SUFFIXES) {
      queue.push({ base: name, suffix, query: `${name} ${suffix}` })
    }
  }
  console.log(`   Fila: ${queue.length} queries\n`)

  let processed = 0
  let totalReturned = 0
  let totalFilled = 0
  let totalEmpty = 0
  const perBaseStats = {} // base name → { queries, returned, filled }

  let stop = false
  process.on('SIGINT', async () => {
    console.log('\n⏸️  SIGINT — salvando...')
    stop = true
    await Promise.all([saveJson(MEDS_FILE, meds), saveJson(POS_FILE, pos)])
    process.exit(0)
  })

  async function persist() {
    await Promise.all([saveJson(MEDS_FILE, meds), saveJson(POS_FILE, pos)])
  }

  async function worker(id) {
    while (!stop) {
      const job = queue.shift()
      if (job === undefined) return

      const t0 = Date.now()
      let items
      try {
        items = await fetchProducts(job.query)
      } catch (e) {
        console.warn(`  ❌ [w${id}] "${job.query}": ${e.message}`)
        processed++
        continue
      }

      const newOnes = items.filter(it => !knownIds.has(it.id))
      for (const item of newOnes) {
        knownIds.add(item.id)
        meds.push(item)
      }

      let posOk = 0
      if (FETCH_POSOLOGIES && newOnes.length > 0) {
        for (const item of newOnes) {
          if (posByMedId.has(item.id)) continue
          try {
            const list = await fetchPosology(item.id)
            posByMedId.add(item.id)
            for (const p of list) pos.push({ ...p, medicationId: item.id })
            posOk++
          } catch (e) {
            console.warn(`     pos ${item.id}: ${e.message}`)
          }
          await sleep(jitter(DELAY_MS))
        }
      }

      // stats por base
      if (!perBaseStats[job.base]) {
        perBaseStats[job.base] = { queries: 0, returned: 0, filled: 0 }
      }
      perBaseStats[job.base].queries++
      perBaseStats[job.base].returned += items.length
      perBaseStats[job.base].filled += newOnes.length

      totalReturned += items.length
      totalFilled += newOnes.length
      if (items.length === 0) totalEmpty++
      processed++

      const dt = Date.now() - t0
      const tag = items.length === 0
        ? '⚠️ vazio'
        : newOnes.length === 0
        ? '✓ coberto'
        : `🆕 +${newOnes.length}`
      console.log(
        `  [w${id}] ${String(processed).padStart(4)}/${cappedNames.length * SUFFIXES.length} "${job.query.padEnd(35)}" → ${String(items.length).padStart(2)} ret, ${tag} (${dt}ms)`
      )

      if (processed % 50 === 0) {
        await persist()
        console.log(
          `     📊 ${processed} processados | +${totalFilled} novos meds | meds total: ${meds.length}`
        )
      }

      await sleep(jitter(DELAY_MS))
    }
  }

  const workers = Array.from({ length: CONCURRENCY }, (_, i) => worker(i + 1))
  await Promise.all(workers)
  await persist()

  // ---------- relatório ----------
  const topGains = Object.entries(perBaseStats)
    .filter(([_, s]) => s.filled > 0)
    .sort((a, b) => b[1].filled - a[1].filled)
    .slice(0, 30)
    .map(([name, s]) => ({ name, filled: s.filled, queries: s.queries }))

  const deepReport = {
    generatedAt: new Date().toISOString(),
    summary: {
      cappedNames: cappedNames.length,
      queriesRun: processed,
      productsReturnedTotal: totalReturned,
      newMedsAdded: totalFilled,
      emptyQueries: totalEmpty,
      medsBefore: initialCount,
      medsAfter: meds.length,
    },
    topGains,
  }
  await saveJson(DEEP_REPORT_FILE, deepReport)

  console.log(`\n${'='.repeat(60)}`)
  console.log(`✅ Deep-fill concluído`)
  console.log('='.repeat(60))
  console.log(`Queries refinadas:     ${processed}`)
  console.log(`Total retornado:       ${totalReturned}`)
  console.log(`Novos meds adicionados: ${totalFilled}`)
  console.log(`Meds: ${initialCount} → ${meds.length} (+${meds.length - initialCount})`)
  console.log(`Queries vazias:        ${totalEmpty}/${processed} (${((totalEmpty / processed) * 100).toFixed(0)}%)`)
  console.log('')
  console.log(`Top 10 princípios ativos que mais renderam:`)
  for (const t of topGains.slice(0, 10)) {
    console.log(`  ${t.filled.toString().padStart(3)} novos — ${t.name}`)
  }
  console.log(`\n📄 Relatório completo: ${DEEP_REPORT_FILE}`)
  console.log(`\n🎯 Próximo passo: npm run import`)
}

main().catch(e => {
  console.error('\n❌ Erro fatal:', e)
  process.exit(1)
})
