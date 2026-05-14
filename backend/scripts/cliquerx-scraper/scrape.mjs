#!/usr/bin/env node
/**
 * scrape.mjs — scrape adaptativo do catálogo Cliquerx.
 *
 * Algoritmo (BFS por prefixo):
 *   1. fila inicial = ['a'..'z']
 *   2. desfila um prefixo, faz GET, dedupe e salva os produtos novos
 *   3. SE o count == SCRAPER_PAGE_LIMIT → significa que provavelmente tem mais
 *      → enfila prefixos filhos (prefix + 'a', prefix + 'b', ..., prefix + 'z')
 *   4. SE count < limite → marca prefixo como completo
 *   5. Para cada produto NOVO, também busca posologias
 *
 * Resume:
 *   - state em data/.scrape-state.json
 *   - medications.json e posologies.json gravados depois de cada prefixo
 *   - Ctrl+C salva e sai limpo
 *
 * Uso:
 *   node --env-file=.env scrape.mjs           # resume ou começa
 *   node --env-file=.env scrape.mjs --reset   # apaga state e recomeça
 *   node --env-file=.env scrape.mjs --stats   # só mostra estatísticas
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { fetchProducts, fetchPosology } from './lib-api.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.join(__dirname, 'data')
const STATE_FILE = path.join(DATA_DIR, '.scrape-state.json')
const MEDS_FILE = path.join(DATA_DIR, 'medications.json')
const POS_FILE = path.join(DATA_DIR, 'posologies.json')

const CONCURRENCY = Number(process.env.SCRAPER_CONCURRENCY || 4)
const DELAY_MS = Number(process.env.SCRAPER_DELAY_MS || 180)
const PAGE_LIMIT = Number(process.env.SCRAPER_PAGE_LIMIT || 50)
const MAX_DEPTH = Number(process.env.SCRAPER_MAX_DEPTH || 5)
const FETCH_POSOLOGIES =
  String(process.env.SCRAPER_FETCH_POSOLOGIES ?? 'true') === 'true'

// Caracteres usados pra expandir prefixos. Letras + dígitos cobrem 99%.
const CHARSET = 'abcdefghijklmnopqrstuvwxyz0123456789'

// ---------- helpers ----------

const sleep = ms => new Promise(r => setTimeout(r, ms))
const jitter = ms => ms * (0.7 + Math.random() * 0.6)

async function loadJson(file, fallback) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'))
  } catch {
    return fallback
  }
}

async function saveJson(file, data) {
  await fs.mkdir(path.dirname(file), { recursive: true })
  // grava em .tmp e renomeia (atômico, sobrevive a crash)
  const tmp = file + '.tmp'
  await fs.writeFile(tmp, JSON.stringify(data, null, 2))
  await fs.rename(tmp, file)
}

// ---------- state ----------

/**
 * state = {
 *   queue: string[]            // prefixos ainda a processar
 *   doneCount: number          // prefixos já processados
 *   doneSample: string[]       // últimos 10 prefixos processados (debug)
 *   startedAt: ISO string
 *   updatedAt: ISO string
 *   medsById: { [id]: meta }   // só pra dedupe O(1); convertido em array no save
 * }
 */
async function loadState() {
  const initialQueue = CHARSET.split('')
  return loadJson(STATE_FILE, {
    queue: initialQueue,
    doneCount: 0,
    doneSample: [],
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  })
}

async function loadMeds() {
  return loadJson(MEDS_FILE, [])
}
async function loadPos() {
  return loadJson(POS_FILE, [])
}

// ---------- core ----------

async function processPrefix(prefix, knownIds, newProducts, depth, expandQueue) {
  if (depth > MAX_DEPTH) {
    console.log(`   ⏭️  ${prefix} — profundidade máxima atingida, parando aqui`)
    return { count: 0, newCount: 0, shouldExpand: false }
  }

  let items
  try {
    items = await fetchProducts(prefix)
  } catch (e) {
    console.warn(`   ❌ ${prefix}: ${e.message}`)
    return { count: -1, newCount: 0, shouldExpand: false }
  }

  let newCount = 0
  for (const item of items) {
    if (!item.id || knownIds.has(item.id)) continue
    knownIds.add(item.id)
    newProducts.push(item)
    newCount++
  }

  // O cap da API varia entre ~40 e ~44 dependendo da query (descoberto no probe).
  // Expandimos quando count >= PAGE_LIMIT (default 40) — pode dar expansões
  // ligeiramente desnecessárias, mas garante cobertura total.
  const shouldExpand = items.length >= PAGE_LIMIT && depth < MAX_DEPTH && newCount > 0

  if (shouldExpand) {
    // adiciona filhos
    for (const ch of CHARSET) {
      expandQueue.push(prefix + ch)
    }
  }

  return { count: items.length, newCount, shouldExpand }
}

async function fetchPosologiesFor(products, allPos, posByMedId) {
  // só busca pros que ainda não têm
  const todo = products.filter(p => !posByMedId.has(p.id))
  if (todo.length === 0) return 0

  let ok = 0
  for (const product of todo) {
    try {
      const list = await fetchPosology(product.id)
      posByMedId.add(product.id)
      for (const item of list) {
        allPos.push({ ...item, medicationId: product.id })
      }
      ok++
    } catch (e) {
      console.warn(`   ⚠️  posologia ${product.id} (${product.title}): ${e.message}`)
    }
    await sleep(jitter(DELAY_MS))
  }
  return ok
}

async function main() {
  await fs.mkdir(DATA_DIR, { recursive: true })

  // ---------- comandos ----------
  if (process.argv.includes('--reset')) {
    await fs.rm(STATE_FILE, { force: true })
    await fs.rm(MEDS_FILE, { force: true })
    await fs.rm(POS_FILE, { force: true })
    console.log('🗑️  State e arquivos de dados apagados.')
    return
  }

  const meds = await loadMeds()
  const pos = await loadPos()
  const state = await loadState()

  if (process.argv.includes('--stats')) {
    console.log(`📊 Estatísticas:`)
    console.log(`   Medicamentos únicos: ${meds.length}`)
    console.log(`   Posologias:          ${pos.length}`)
    console.log(`   Prefixos processados: ${state.doneCount}`)
    console.log(`   Prefixos na fila:     ${state.queue.length}`)
    console.log(`   Iniciado em:          ${state.startedAt}`)
    console.log(`   Última atualização:   ${state.updatedAt}`)
    return
  }

  // ---------- estruturas em memória ----------
  const knownIds = new Set(meds.map(m => m.id))
  const posByMedId = new Set(pos.map(p => p.medicationId))

  console.log(`🚀 Scraper iniciado`)
  console.log(`   Concorrência:   ${CONCURRENCY}`)
  console.log(`   Delay/req:      ${DELAY_MS}ms (com jitter)`)
  console.log(`   Page limit:     ${PAGE_LIMIT}`)
  console.log(`   Max depth:      ${MAX_DEPTH}`)
  console.log(`   Posologias:     ${FETCH_POSOLOGIES ? 'sim' : 'não'}`)
  console.log(`   Já no disco:    ${meds.length} medicamentos, ${pos.length} posologias`)
  console.log(`   Fila atual:     ${state.queue.length} prefixos`)
  console.log('')

  // ---------- save handler (Ctrl+C, etc.) ----------
  let saving = false
  async function persistAll() {
    if (saving) return
    saving = true
    state.updatedAt = new Date().toISOString()
    await Promise.all([
      saveJson(STATE_FILE, state),
      saveJson(MEDS_FILE, meds),
      saveJson(POS_FILE, pos),
    ])
    saving = false
  }

  let stopRequested = false
  process.on('SIGINT', async () => {
    console.log('\n⏸️  SIGINT recebido. Salvando state...')
    stopRequested = true
    await persistAll()
    console.log('💾 State salvo. Tchau.')
    process.exit(0)
  })

  // ---------- workers ----------
  // BFS com pool: workers pegam o próximo prefixo da fila;
  // se a fila esvazia mas alguém ainda está processando (pode adicionar filhos),
  // o worker espera. Quando todos terminam e a fila está vazia, finaliza.
  let activeWorkers = 0
  const expandQueue = state.queue // ref direta — workers fazem push aqui

  async function worker(id) {
    while (!stopRequested) {
      // pega próximo prefixo (FIFO)
      const prefix = expandQueue.shift()
      if (prefix === undefined) {
        // fila vazia. Se ninguém mais tá processando, encerra.
        if (activeWorkers === 0) return
        await sleep(50)
        continue
      }

      activeWorkers++
      const depth = prefix.length
      const t0 = Date.now()
      const newProducts = []

      const result = await processPrefix(
        prefix,
        knownIds,
        newProducts,
        depth,
        expandQueue
      )

      const dt = Date.now() - t0
      // adiciona em meds (o array do disco)
      for (const p of newProducts) meds.push(p)

      // busca posologias dos novos
      let posOk = 0
      if (FETCH_POSOLOGIES && newProducts.length > 0) {
        posOk = await fetchPosologiesFor(newProducts, pos, posByMedId)
      }

      state.doneCount++
      state.doneSample.push(prefix)
      if (state.doneSample.length > 10) state.doneSample.shift()

      const expandTag = result.shouldExpand ? '↳' : '✓'
      const ratio = state.doneCount % 20 === 0 ? ` [salvando]` : ''
      console.log(
        `  ${expandTag} [w${id} d=${depth}] q=${prefix.padEnd(MAX_DEPTH)} → ${String(result.count).padStart(3)} itens, +${newProducts.length} novos, +${posOk} pos (${dt}ms)${ratio}`
      )

      // salva periodicamente (a cada 20 prefixos)
      if (state.doneCount % 20 === 0) {
        await persistAll()
        const totalMeds = meds.length
        const totalPos = pos.length
        const remaining = expandQueue.length
        console.log(
          `     📊 ${totalMeds} meds, ${totalPos} pos, fila=${remaining}, processados=${state.doneCount}`
        )
      }

      activeWorkers--
      await sleep(jitter(DELAY_MS))
    }
  }

  const workers = Array.from({ length: CONCURRENCY }, (_, i) => worker(i + 1))
  await Promise.all(workers)

  // save final
  await persistAll()

  console.log(`\n✅ Scrape concluído!`)
  console.log(`   Medicamentos únicos: ${meds.length}`)
  console.log(`   Posologias:          ${pos.length}`)
  console.log(`   Prefixos processados: ${state.doneCount}`)
  console.log(`\n   Próximo passo: node import.mjs`)
}

main().catch(async e => {
  console.error('\n❌ Erro fatal:', e)
  process.exit(1)
})
