#!/usr/bin/env node
/**
 * inspect-pos.mjs — diagnóstico de cobertura de posologias.
 *
 * Não faz requisições. Só analisa medications.json + posologies.json
 * e mostra:
 *   1. Distribuição (quantos meds têm 0, 1, 2, 3+ posologias)
 *   2. Gaps por categoria (Genérico, Similar, Suplemento, etc.)
 *   3. Gaps por prescriptionType (Simples, Azul, etc.)
 *   4. Lista exemplos de meds PRESCRITÍVEIS sem posologia (suspeitos)
 *
 * Uso: node --env-file=.env inspect-pos.mjs
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.join(__dirname, 'data')
const MEDS_FILE = path.join(DATA_DIR, 'medications.json')
const POS_FILE = path.join(DATA_DIR, 'posologies.json')

async function loadJson(file) {
  return JSON.parse(await fs.readFile(file, 'utf8'))
}

function pct(part, total) {
  return total === 0 ? '0.0%' : `${((part / total) * 100).toFixed(1)}%`
}

async function main() {
  const meds = await loadJson(MEDS_FILE)
  const pos = await loadJson(POS_FILE)

  console.log(`📊 Diagnóstico de posologias`)
  console.log(`   ${meds.length.toLocaleString('pt-BR')} medicamentos`)
  console.log(`   ${pos.length.toLocaleString('pt-BR')} posologias`)
  console.log(`   Ratio: ${(pos.length / meds.length).toFixed(2)} pos/med`)
  console.log('')

  // monta índice
  const posByMed = new Map()
  for (const p of pos) {
    if (!p.medicationId) continue
    if (!posByMed.has(p.medicationId)) posByMed.set(p.medicationId, [])
    posByMed.get(p.medicationId).push(p)
  }

  // ---------- 1. Distribuição ----------
  const distribution = {}
  for (const med of meds) {
    const count = (posByMed.get(med.id) || []).length
    distribution[count] = (distribution[count] || 0) + 1
  }
  console.log(`📈 Distribuição (posologias por medicamento):`)
  const keys = Object.keys(distribution).map(Number).sort((a, b) => a - b)
  for (const k of keys) {
    const v = distribution[k]
    const bar = '█'.repeat(Math.min(50, Math.round((v / meds.length) * 100)))
    console.log(`   ${String(k).padStart(2)} pos: ${String(v).padStart(6)} (${pct(v, meds.length).padStart(5)})  ${bar}`)
  }
  console.log('')

  // ---------- 2. Por categoria ----------
  /** category → { total, withPos, withoutPos } */
  const byCategory = {}
  for (const med of meds) {
    const cat = (med.category || 'sem categoria').trim()
    if (!byCategory[cat]) byCategory[cat] = { total: 0, withPos: 0, withoutPos: 0 }
    byCategory[cat].total++
    if (posByMed.has(med.id)) byCategory[cat].withPos++
    else byCategory[cat].withoutPos++
  }
  console.log(`📁 Por categoria:`)
  const sortedCats = Object.entries(byCategory).sort((a, b) => b[1].total - a[1].total)
  console.log(`   ${'categoria'.padEnd(20)} ${'total'.padStart(6)} ${'com pos'.padStart(8)} ${'sem pos'.padStart(8)} ${'cobertura'.padStart(10)}`)
  console.log(`   ${'-'.repeat(60)}`)
  for (const [cat, d] of sortedCats) {
    console.log(
      `   ${cat.padEnd(20)} ${String(d.total).padStart(6)} ${String(d.withPos).padStart(8)} ${String(d.withoutPos).padStart(8)} ${pct(d.withPos, d.total).padStart(10)}`
    )
  }
  console.log('')

  // ---------- 3. Por prescription type ----------
  /** type → { total, withPos } */
  const byPrescType = {}
  for (const med of meds) {
    const t = (med.prescriptionType ?? '(null/vazio)').trim() || '(vazio)'
    if (!byPrescType[t]) byPrescType[t] = { total: 0, withPos: 0 }
    byPrescType[t].total++
    if (posByMed.has(med.id)) byPrescType[t].withPos++
  }
  console.log(`💊 Por prescriptionType:`)
  const sortedTypes = Object.entries(byPrescType).sort((a, b) => b[1].total - a[1].total)
  for (const [t, d] of sortedTypes) {
    const wp = d.withPos
    const wo = d.total - wp
    console.log(
      `   ${t.padEnd(25)} total=${String(d.total).padStart(5)}  com pos=${String(wp).padStart(5)}  sem=${String(wo).padStart(5)}  cob=${pct(wp, d.total)}`
    )
  }
  console.log('')

  // ---------- 4. SUSPEITOS — prescritíveis sem posologia ----------
  // medicamentos com prescriptionType "Simples", "Azul", "Branca" etc DEVERIAM ter posologia.
  const PRESCRITIVEL = new Set(['Simples', 'Azul', 'Amarela', 'Branca', 'Antibiótico - 2 vias', 'Notificação'])
  const suspects = meds.filter(m => {
    const t = (m.prescriptionType || '').trim()
    return PRESCRITIVEL.has(t) && !posByMed.has(m.id)
  })

  console.log(`🚨 SUSPEITOS — prescritíveis SEM posologia: ${suspects.length}`)
  if (suspects.length > 0) {
    const sample = suspects.slice(0, 25)
    console.log(`   Exemplos (primeiros ${sample.length}):`)
    for (const m of sample) {
      console.log(`     • [${m.prescriptionType.padEnd(20)}] ${m.title} — ${m.laboratoryName || '?'}`)
    }
    if (suspects.length > sample.length) {
      console.log(`     ... (+${suspects.length - sample.length})`)
    }
  }
  console.log('')

  // ---------- 5. Diagnóstico final ----------
  const totalWithPos = meds.filter(m => posByMed.has(m.id)).length
  const totalWithoutPos = meds.length - totalWithPos
  const expectedWithPos = meds.filter(m => {
    const t = (m.prescriptionType || '').trim()
    return PRESCRITIVEL.has(t)
  }).length

  console.log(`📋 Resumo:`)
  console.log(`   Meds COM posologia:       ${totalWithPos.toLocaleString('pt-BR')} (${pct(totalWithPos, meds.length)})`)
  console.log(`   Meds SEM posologia:       ${totalWithoutPos.toLocaleString('pt-BR')} (${pct(totalWithoutPos, meds.length)})`)
  console.log(`   Meds prescritíveis:       ${expectedWithPos.toLocaleString('pt-BR')}`)
  console.log(`   Prescritíveis SEM pos:    ${suspects.length} (deveria ser zero ou próximo!)`)
  console.log('')

  if (suspects.length > 500) {
    console.log('❌ MUITOS suspeitos. Vale rodar um refetch-pos.mjs pra puxar pra esses.')
  } else if (suspects.length > 100) {
    console.log('⚠️  Alguns suspeitos. Considere refetch-pos.mjs (script de recuperação).')
  } else {
    console.log('✅ Cobertura de posologias parece correta.')
  }
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
