#!/usr/bin/env node
/**
 * probe.mjs — sondagem da API antes do scrape pra valer.
 *
 * Roda 5 queries diferentes e imprime:
 *   - status, tamanho, count
 *   - headers que podem indicar paginação (x-total-count, link, etc.)
 *   - se tem campo de paginação no body (meta, page, total, etc.)
 *   - amostra do primeiro e último item
 *
 * Manda a saída pro Claude e ele afina o scraper.
 */

import { BASE, HEADERS, fetchProducts, fetchPosology } from './lib-api.mjs'

const probes = [
  { label: 'vazio (sem q)', url: `${BASE}/v1/physician/medications/products` },
  { label: 'q=a (letra comum)', url: `${BASE}/v1/physician/medications/products?q=a` },
  { label: 'q=di', url: `${BASE}/v1/physician/medications/products?q=di` },
  { label: 'q=qzx (improvável)', url: `${BASE}/v1/physician/medications/products?q=qzx` },
  { label: 'q=paracetamol', url: `${BASE}/v1/physician/medications/products?q=paracetamol` },
]

function fmt(n) {
  return Number(n).toLocaleString('pt-BR')
}

async function probe(p) {
  console.log(`\n${'='.repeat(70)}`)
  console.log(`▶  ${p.label}`)
  console.log(`   ${p.url}`)
  console.log('='.repeat(70))

  const t0 = Date.now()
  const res = await fetch(p.url, { headers: HEADERS })
  const dt = Date.now() - t0
  const raw = await res.text()

  console.log(`Status: ${res.status} (${dt}ms)`)
  console.log(`Tamanho: ${fmt(raw.length)} bytes`)

  // Headers que costumam indicar paginação
  const pageHeaders = [
    'x-total-count', 'x-total', 'x-page', 'x-per-page', 'x-page-size',
    'link', 'x-pagination', 'content-range', 'x-ratelimit-remaining',
    'x-ratelimit-limit', 'retry-after',
  ]
  console.log('\nHeaders relevantes:')
  for (const h of pageHeaders) {
    const v = res.headers.get(h)
    if (v) console.log(`  ${h}: ${v}`)
  }

  if (!res.ok) {
    console.log(`\nCorpo do erro:\n${raw.slice(0, 500)}`)
    return
  }

  let body
  try {
    body = JSON.parse(raw)
  } catch {
    console.log(`\nResposta não é JSON. Primeiros 500 chars:\n${raw.slice(0, 500)}`)
    return
  }

  // Mapeia formato
  const keys = Object.keys(body || {})
  console.log(`\nChaves top-level: [${keys.join(', ')}]`)

  const items = Array.isArray(body) ? body : body.data ?? body.items ?? body.results
  if (!Array.isArray(items)) {
    console.log('Não achei array. Body completo (até 800 chars):')
    console.log(JSON.stringify(body).slice(0, 800))
    return
  }

  console.log(`Count: ${items.length} produtos`)

  // Detecta metadados de paginação no body
  const metaKeys = keys.filter(k => k !== 'data' && k !== 'items' && k !== 'results')
  if (metaKeys.length) {
    console.log('\nMetadados (não-data):')
    for (const k of metaKeys) {
      console.log(`  ${k}: ${JSON.stringify(body[k])}`)
    }
  }

  if (items.length > 0) {
    console.log('\nPrimeiro item (campos):')
    const first = items[0]
    console.log(`  ${Object.keys(first).join(', ')}`)
    console.log('\nPrimeiro item (resumo):')
    console.log(`  id:           ${first.id}`)
    console.log(`  title:        ${first.title}`)
    console.log(`  category:     ${first.category}`)
    console.log(`  listType:     ${first.listType}`)
    console.log(`  prescType:    ${first.prescriptionType}`)

    if (items.length > 1) {
      console.log('\nÚltimo item:')
      const last = items[items.length - 1]
      console.log(`  id:    ${last.id}`)
      console.log(`  title: ${last.title}`)
    }
  }

  // Teste de paginação: tenta ?page=2 e ?offset=50 e vê o que muda
  if (items.length >= 40) {
    console.log('\n--- Teste de paginação ---')
    for (const param of ['page=2', 'offset=50', 'skip=50', 'cursor=2']) {
      const sep = p.url.includes('?') ? '&' : '?'
      const url = `${p.url}${sep}${param}`
      const r = await fetch(url, { headers: HEADERS })
      if (!r.ok) {
        console.log(`  ${param} -> HTTP ${r.status}`)
        continue
      }
      const b = await r.json().catch(() => null)
      const it = Array.isArray(b) ? b : b?.data ?? []
      const firstId = it[0]?.id
      const sameFirst = firstId === items[0]?.id
      console.log(`  ${param} -> ${it.length} itens, primeiro=${firstId?.slice(0, 8)} ${sameFirst ? '(IGUAL — sem paginação)' : '(DIFERENTE — paginação funciona!)'}`)
    }
  }

  // Bônus: se achou um id, testa o endpoint de posologia
  if (items.length > 0) {
    const id = items[0].id
    console.log('\n--- Posologia do primeiro medicamento ---')
    try {
      const pos = await fetchPosology(id)
      console.log(`Posologias retornadas: ${pos.length}`)
      if (pos.length) {
        console.log('Primeira posologia (campos):', Object.keys(pos[0]).join(', '))
        console.log('Conteúdo:', JSON.stringify(pos[0], null, 2).slice(0, 600))
      }
    } catch (e) {
      console.log(`Erro: ${e.message}`)
    }
  }
}

async function main() {
  console.log('🔍 Probe da API Cliquerx')
  console.log(`Base: ${BASE}`)
  console.log(`Bearer: ${process.env.CLIQUERX_BEARER?.slice(0, 30)}...`)

  for (const p of probes) {
    try {
      await probe(p)
    } catch (e) {
      console.log(`\n❌ Erro em "${p.label}": ${e.message}`)
    }
    await new Promise(r => setTimeout(r, 300))
  }

  console.log(`\n${'='.repeat(70)}`)
  console.log('✅ Probe terminado. Olha em particular:')
  console.log('   1. Qual o count máximo (provavelmente o limite por query)')
  console.log('   2. Se algum teste de paginação retornou DIFERENTE (= paginação)')
  console.log('   3. Se existe metadado tipo "total", "hasMore", "nextCursor"')
  console.log('   4. Headers de rate limit (x-ratelimit-*)')
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
