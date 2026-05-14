#!/usr/bin/env node
/**
 * refetch-pos.mjs — recupera posologias que ficaram pra trás durante o scrape.
 *
 * Identifica meds SEM posologia (que não estão em posByMedId) e filtra os que
 * fazem sentido ter posologia (exclui radiofármacos, contrastes, suplementos,
 * etc — categorias que normalmente não têm dosagem clínica).
 *
 * Pra cada um, faz UMA tentativa de fetchPosology. Se vier vazia, marca como
 * "checado" em data/.no-pos-meds.json pra não retentar no futuro.
 *
 * NÃO mexe em medications.json. Só adiciona em posologies.json.
 *
 * Uso:
 *   node --env-file=.env refetch-pos.mjs            # default: filtros conservadores
 *   node --env-file=.env refetch-pos.mjs --all      # tenta TODOS sem posologia
 *   node --env-file=.env refetch-pos.mjs --dry      # só lista, não puxa
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { fetchPosology } from './lib-api.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.join(__dirname, 'data')
const MEDS_FILE = path.join(DATA_DIR, 'medications.json')
const POS_FILE = path.join(DATA_DIR, 'posologies.json')
const NO_POS_FILE = path.join(DATA_DIR, '.no-pos-meds.json')
const REPORT_FILE = path.join(DATA_DIR, 'refetch-pos-report.json')

const CONCURRENCY = Number(process.env.SCRAPER_CONCURRENCY || 4)
const DELAY_MS = Number(process.env.SCRAPER_DELAY_MS || 180)

const ARG_ALL = process.argv.includes('--all')
const ARG_DRY = process.argv.includes('--dry')

// categorias que NORMALMENTE não têm posologia clínica
const EXCLUDE_CATEGORIES = new Set([
  'Suplemento',
  'Radiofármaco',
  'Produto de Cannabis',
  'Contraste',
  'Contraste Radiológico',
  'Importado',
  'Produto de Terapia Avançada',
])

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
  const meds = await loadJson(MEDS_FILE, [])
  const pos = await loadJson(POS_FILE, [])
  const noPos = await loadJson(NO_POS_FILE, { ids: [] })

  // backup
  await fs.copyFile(POS_FILE, POS_FILE + '.bak3').catch(() => {})
  console.log('💾 Backup pos (.bak3) criado')

  const posByMedId = new Set(pos.map(p => p.medicationId))
  const noPosSet = new Set(noPos.ids)
  const initialPosCount = pos.length

  // ---------- filtragem ----------
  const candidates = meds.filter(m => {
    // já tem posologia? pula
    if (posByMedId.has(m.id)) return false
    // já tentamos e veio vazio? pula
    if (noPosSet.has(m.id)) return false
    // modo --all: tenta tudo
    if (ARG_ALL) return true
    // filtro padrão: exclui categorias improváveis
    if (EXCLUDE_CATEGORIES.has((m.category || '').trim())) return false
    return true
  })

  console.log(`\n🔄 Refetch de posologias`)
  console.log(`   Meds totais:           ${meds.length.toLocaleString('pt-BR')}`)
  console.log(`   Já com posologia:      ${posByMedId.size.toLocaleString('pt-BR')}`)
  console.log(`   Já marcados sem pos:   ${noPosSet.size.toLocaleString('pt-BR')}`)
  console.log(`   Candidatos a refetch:  ${candidates.length.toLocaleString('pt-BR')}`)
  console.log(`   Modo:                  ${ARG_ALL ? 'TODOS (--all)' : 'conservador (exclui suplementos/radiofarmacos/etc)'}`)

  if (ARG_DRY) {
    console.log(`\n📋 Modo --dry: só listando, não vou puxar.`)
    const byCategory = {}
    for (const c of candidates) {
      const k = c.category || 'sem cat'
      byCategory[k] = (byCategory[k] || 0) + 1
    }
    console.log(`\nDistribuição dos candidatos por categoria:`)
    for (const [k, v] of Object.entries(byCategory).sort((a, b) => b[1] - a[1])) {
      console.log(`   ${k.padEnd(25)} ${v}`)
    }
    return
  }

  if (candidates.length === 0) {
    console.log(`\n✅ Nada pra recuperar. Já tá tudo.`)
    return
  }

  // estimativa
  const estSeconds = (candidates.length * DELAY_MS) / CONCURRENCY / 1000
  console.log(`   Estimativa:            ~${Math.ceil(estSeconds / 60)} minutos\n`)

  let stop = false
  process.on('SIGINT', async () => {
    console.log('\n⏸️  SIGINT — salvando...')
    stop = true
    await Promise.all([
      saveJson(POS_FILE, pos),
      saveJson(NO_POS_FILE, { ids: [...noPosSet] }),
    ])
    process.exit(0)
  })

  async function persist() {
    await Promise.all([
      saveJson(POS_FILE, pos),
      saveJson(NO_POS_FILE, { ids: [...noPosSet] }),
    ])
  }

  // ---------- workers ----------
  const queue = [...candidates]
  let processed = 0
  let filled = 0   // meds que tiveram pelo menos 1 pos adicionada
  let empty = 0    // meds que confirmadamente não têm pos
  let errors = 0
  let totalAdded = 0

  async function worker(id) {
    while (!stop) {
      const med = queue.shift()
      if (med === undefined) return

      const t0 = Date.now()
      try {
        const list = await fetchPosology(med.id)
        processed++

        if (list.length === 0) {
          empty++
          noPosSet.add(med.id)
        } else {
          filled++
          for (const p of list) pos.push({ ...p, medicationId: med.id })
          totalAdded += list.length
        }

        const dt = Date.now() - t0
        const tag = list.length === 0
          ? '— sem pos'
          : `+${list.length} pos`
        if (processed % 25 === 0 || list.length > 2) {
          console.log(
            `  [w${id}] ${String(processed).padStart(5)}/${candidates.length} "${med.title.slice(0, 50).padEnd(50)}" ${tag.padStart(10)} (${dt}ms)`
          )
        }
      } catch (e) {
        errors++
        processed++
        console.warn(`  [w${id}] ❌ ${med.id} (${med.title}): ${e.message}`)
      }

      // salva a cada 100
      if (processed % 100 === 0) {
        await persist()
        console.log(
          `     📊 ${processed}/${candidates.length} | preenchidos=${filled} | vazios=${empty} | total +${totalAdded} pos`
        )
      }

      await sleep(jitter(DELAY_MS))
    }
  }

  const workers = Array.from({ length: CONCURRENCY }, (_, i) => worker(i + 1))
  await Promise.all(workers)
  await persist()

  // ---------- relatório ----------
  const report = {
    generatedAt: new Date().toISOString(),
    summary: {
      candidates: candidates.length,
      processed,
      filledMeds: filled,
      emptyMeds: empty,
      errors,
      posologiesAdded: totalAdded,
      posBefore: initialPosCount,
      posAfter: pos.length,
    },
  }
  await saveJson(REPORT_FILE, report)

  console.log(`\n${'='.repeat(60)}`)
  console.log(`✅ Refetch concluído`)
  console.log('='.repeat(60))
  console.log(`Candidatos processados:    ${processed}/${candidates.length}`)
  console.log(`Meds preenchidos:          ${filled}`)
  console.log(`Confirmados sem posologia: ${empty}`)
  console.log(`Erros:                     ${errors}`)
  console.log(`Posologias adicionadas:    ${totalAdded}`)
  console.log(`Pos total: ${initialPosCount} → ${pos.length} (+${pos.length - initialPosCount})`)
  console.log(`\n📄 Relatório: ${REPORT_FILE}`)
  console.log(`\n🎯 Roda 'npm run inspect-pos' pra ver a nova distribuição.`)
}

main().catch(e => {
  console.error('\n❌ Erro fatal:', e)
  process.exit(1)
})
