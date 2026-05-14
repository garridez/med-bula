#!/usr/bin/env node
/**
 * validate.mjs — valida cobertura do scrape e preenche lacunas.
 *
 * Pra cada nome da validation-list.json:
 *   1. Faz q=nome no Cliquerx
 *   2. Pra cada ID retornado:
 *      - Se já está no medications.json → ✓ coberto
 *      - Se não está → 🆕 lacuna; busca posologia e adiciona
 *   3. Salva tudo de volta no medications.json / posologies.json
 *   4. Gera validation-report.json com métricas detalhadas
 *
 * Resultado: você fica sabendo a % de cobertura E os faltantes são
 * preenchidos automaticamente.
 *
 * Uso: node --env-file=.env validate.mjs
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { fetchProducts, fetchPosology } from './lib-api.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.join(__dirname, 'data')

// Aceita --list=nome.json pra rodar com outras listas (v1, v2, etc).
// Default: validation-list.json
const listArg = process.argv.find(a => a.startsWith('--list='))
const LIST_NAME = listArg ? listArg.replace('--list=', '') : 'validation-list.json'
const LIST_FILE = path.join(__dirname, LIST_NAME)
// Nome do report inclui o sufixo da lista pra não sobrescrever
const REPORT_SUFFIX = LIST_NAME.replace(/^validation-list-?/, '').replace(/\.json$/, '') || 'v1'

const MEDS_FILE = path.join(DATA_DIR, 'medications.json')
const POS_FILE = path.join(DATA_DIR, 'posologies.json')
const REPORT_FILE = path.join(DATA_DIR, `validation-report-${REPORT_SUFFIX}.json`)

const CONCURRENCY = Number(process.env.SCRAPER_CONCURRENCY || 4)
const DELAY_MS = Number(process.env.SCRAPER_DELAY_MS || 180)
const FETCH_POSOLOGIES =
  String(process.env.SCRAPER_FETCH_POSOLOGIES ?? 'true') === 'true'

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
  const tmp = file + '.tmp'
  await fs.writeFile(tmp, JSON.stringify(data, null, 2))
  await fs.rename(tmp, file)
}

// ---------- main ----------

async function main() {
  // carrega tudo
  const listFile = await loadJson(LIST_FILE, null)
  if (!listFile?.names?.length) {
    console.error('❌ validation-list.json vazio ou ausente.')
    process.exit(1)
  }
  const names = listFile.names

  const meds = await loadJson(MEDS_FILE, [])
  const pos = await loadJson(POS_FILE, [])

  if (meds.length === 0) {
    console.error('❌ medications.json vazio. Roda o scrape.mjs primeiro.')
    process.exit(1)
  }

  // backup antes de qualquer coisa
  await fs.copyFile(MEDS_FILE, MEDS_FILE + '.bak').catch(() => {})
  await fs.copyFile(POS_FILE, POS_FILE + '.bak').catch(() => {})
  console.log('💾 Backup criado (.bak)')

  const knownIds = new Set(meds.map(m => m.id))
  const posByMedId = new Set(pos.map(p => p.medicationId))
  const initialMedCount = meds.length

  console.log(`🔍 Validação de cobertura`)
  console.log(`   Lista:                ${LIST_NAME} (${names.length} nomes)`)
  console.log(`   Já no medications:    ${initialMedCount}`)
  console.log(`   Concorrência:         ${CONCURRENCY}`)
  console.log('')

  // estatísticas por query
  /**
   * results[name] = {
   *   returned: int     -- quantos a API retornou pra esse nome
   *   alreadyHad: int   -- desses, quantos já tínhamos
   *   filled: int       -- desses, quantos eram novos e foram adicionados
   * }
   */
  const results = {}

  // fila simples
  const queue = [...names]
  let processed = 0
  let totalReturned = 0
  let totalAlreadyHad = 0
  let totalFilled = 0
  let totalEmpty = 0

  // proteção contra Ctrl+C
  let stop = false
  process.on('SIGINT', async () => {
    console.log('\n⏸️  SIGINT — salvando o que tem e saindo...')
    stop = true
    await persistAll()
    process.exit(0)
  })

  async function persistAll() {
    await Promise.all([
      saveJson(MEDS_FILE, meds),
      saveJson(POS_FILE, pos),
    ])
  }

  async function worker(id) {
    while (!stop) {
      const name = queue.shift()
      if (name === undefined) return

      const t0 = Date.now()
      let items
      try {
        items = await fetchProducts(name)
      } catch (e) {
        console.warn(`  ❌ [w${id}] "${name}": ${e.message}`)
        results[name] = { error: e.message }
        processed++
        continue
      }

      const newOnes = items.filter(it => !knownIds.has(it.id))
      const alreadyHad = items.length - newOnes.length

      // adiciona os novos
      for (const item of newOnes) {
        knownIds.add(item.id)
        meds.push(item)
      }

      // busca posologias dos novos
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

      results[name] = {
        returned: items.length,
        alreadyHad,
        filled: newOnes.length,
        posOk,
      }
      totalReturned += items.length
      totalAlreadyHad += alreadyHad
      totalFilled += newOnes.length
      if (items.length === 0) totalEmpty++

      const dt = Date.now() - t0
      processed++

      // log adaptativo
      const tag = items.length === 0
        ? '⚠️ vazio'
        : newOnes.length === 0
        ? '✓ tudo coberto'
        : `🆕 +${newOnes.length} novos`
      console.log(
        `  [w${id}] ${String(processed).padStart(3)}/${names.length} "${name}" → ${items.length} ret, ${tag} (${dt}ms)`
      )

      // salva incremental a cada 20
      if (processed % 20 === 0) {
        await persistAll()
        const pct = ((totalAlreadyHad / Math.max(1, totalReturned)) * 100).toFixed(1)
        console.log(`     📊 ${processed}/${names.length} | cobertura preliminar: ${pct}% | preenchidos: ${totalFilled}`)
      }

      await sleep(jitter(DELAY_MS))
    }
  }

  const workers = Array.from({ length: CONCURRENCY }, (_, i) => worker(i + 1))
  await Promise.all(workers)

  await persistAll()

  // ---------- relatório ----------
  const coverage = totalReturned === 0
    ? 0
    : (totalAlreadyHad / totalReturned) * 100

  const emptyNames = Object.entries(results)
    .filter(([_, r]) => r.returned === 0)
    .map(([n]) => n)

  const gapsByName = Object.entries(results)
    .filter(([_, r]) => r.filled > 0)
    .sort((a, b) => b[1].filled - a[1].filled)

  const errors = Object.entries(results)
    .filter(([_, r]) => r.error)
    .map(([n, r]) => ({ name: n, error: r.error }))

  const report = {
    generatedAt: new Date().toISOString(),
    summary: {
      namesTotal: names.length,
      namesWithResults: names.length - emptyNames.length - errors.length,
      namesEmpty: emptyNames.length,
      namesError: errors.length,
      productsReturnedTotal: totalReturned,
      productsAlreadyHad: totalAlreadyHad,
      productsFilled: totalFilled,
      coveragePercent: Number(coverage.toFixed(2)),
      medsBefore: initialMedCount,
      medsAfter: meds.length,
      medsAdded: meds.length - initialMedCount,
    },
    namesNotFoundInCliquerx: emptyNames,
    errors,
    topGaps: gapsByName.slice(0, 30).map(([name, r]) => ({
      name,
      filled: r.filled,
      returned: r.returned,
    })),
    perName: results,
  }

  await saveJson(REPORT_FILE, report)

  // ---------- print final ----------
  console.log(`\n${'='.repeat(60)}`)
  console.log(`✅ Validação concluída`)
  console.log('='.repeat(60))
  console.log(`Cobertura do BFS:         ${coverage.toFixed(2)}%`)
  console.log(`  ${totalAlreadyHad} de ${totalReturned} produtos já estavam no scrape`)
  console.log('')
  console.log(`Lacunas preenchidas:      ${totalFilled} medicamentos`)
  console.log(`Total no medications.json: ${initialMedCount} → ${meds.length} (+${meds.length - initialMedCount})`)
  console.log('')
  console.log(`Nomes sem resultado no Cliquerx: ${emptyNames.length}`)
  if (emptyNames.length > 0 && emptyNames.length <= 20) {
    console.log(`  ${emptyNames.join(', ')}`)
  } else if (emptyNames.length > 20) {
    console.log(`  ${emptyNames.slice(0, 20).join(', ')}, ... (+${emptyNames.length - 20})`)
  }
  if (errors.length) {
    console.log(`\nErros: ${errors.length}`)
    for (const e of errors.slice(0, 5)) console.log(`  ${e.name}: ${e.error}`)
  }
  console.log('')
  console.log(`📄 Relatório completo em: ${REPORT_FILE}`)

  // veredicto
  console.log('')
  if (coverage >= 95) {
    console.log('🎯 Excelente cobertura (≥95%). Pode importar com confiança.')
  } else if (coverage >= 85) {
    console.log('👍 Boa cobertura (85-95%). Gaps preenchidos. Pode importar.')
  } else {
    console.log('⚠️  Cobertura abaixo de 85%. Vale investigar antes de importar:')
    console.log('   - Talvez a lista de validação esteja desalinhada com o Cliquerx')
    console.log('   - Talvez a API teve rate-limit/timeout em queries importantes')
    console.log('   - Considere rodar de novo após uns minutos')
  }
}

main().catch(e => {
  console.error('\n❌ Erro fatal:', e)
  process.exit(1)
})
