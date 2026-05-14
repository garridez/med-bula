#!/usr/bin/env node
/**
 * gen-full-list.mjs — gera uma lista MASSIVA de queries pra abrangência total.
 *
 * Camadas:
 *   A) Dose pura × unidade × (com/sem espaço)
 *      Ex: "500 mg", "500mg", "1 g", "1g"
 *   B) DCB + dígito (substring pega múltiplas doses)
 *      Ex: "paracetamol 1" pega 1, 10, 100, 1000, 1.5g, 12mg
 *   C) DCB + dose + unidade (com espaço correto, sintaxe da API)
 *      Ex: "paracetamol 750 mg", "metformina 1 g"
 *
 * Customize as constantes abaixo se quiser MENOS ou MAIS queries.
 *
 * Uso: node gen-full-list.mjs
 * Saída: validation-list-v5-full.json
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT_FILE = path.join(__dirname, 'validation-list-v5-full.json')

// ---------- DCBs (top 130 prescritíveis BR) ----------
const DCBs = [
  // analgésicos / AINEs
  'paracetamol', 'dipirona', 'ibuprofeno', 'nimesulida', 'ácido acetilsalicílico',
  'diclofenaco', 'cetoprofeno', 'naproxeno', 'meloxicam', 'celecoxibe',
  'etoricoxibe', 'piroxicam', 'aceclofenaco', 'indometacina', 'tenoxicam',
  // cardio
  'losartana', 'valsartana', 'olmesartana', 'telmisartana', 'candesartana',
  'irbesartana', 'enalapril', 'captopril', 'lisinopril', 'ramipril', 'perindopril',
  'anlodipino', 'nifedipino', 'felodipino', 'verapamil', 'diltiazem',
  'atenolol', 'propranolol', 'metoprolol', 'carvedilol', 'bisoprolol', 'nebivolol',
  'hidroclorotiazida', 'furosemida', 'espironolactona', 'clortalidona', 'indapamida',
  'sinvastatina', 'atorvastatina', 'rosuvastatina', 'pravastatina', 'ezetimiba',
  'fenofibrato', 'ciprofibrato', 'amiodarona', 'digoxina',
  // diabetes
  'metformina', 'glibenclamida', 'gliclazida', 'glimepirida',
  'sitagliptina', 'vildagliptina', 'linagliptina', 'saxagliptina',
  'empagliflozina', 'dapagliflozina', 'canagliflozina', 'pioglitazona',
  // gastro
  'omeprazol', 'pantoprazol', 'esomeprazol', 'lansoprazol', 'rabeprazol',
  'domperidona', 'bromoprida', 'metoclopramida', 'ondansetrona',
  'simeticona', 'dimeticona', 'sucralfato', 'mesalazina',
  // psiq
  'sertralina', 'fluoxetina', 'paroxetina', 'escitalopram', 'citalopram',
  'venlafaxina', 'duloxetina', 'bupropiona', 'mirtazapina', 'trazodona',
  'vortioxetina', 'desvenlafaxina', 'amitriptilina', 'nortriptilina', 'clomipramina',
  'alprazolam', 'clonazepam', 'diazepam', 'bromazepam', 'lorazepam', 'zolpidem',
  'quetiapina', 'risperidona', 'olanzapina', 'aripiprazol', 'haloperidol',
  // anticonv / neuro
  'pregabalina', 'gabapentina', 'topiramato', 'lamotrigina', 'carbamazepina',
  'oxcarbazepina', 'levetiracetam', 'fenobarbital', 'fenitoína',
  'valproato', 'divalproato',
  'metilfenidato', 'lisdexanfetamina',
  // antibióticos
  'amoxicilina', 'azitromicina', 'claritromicina', 'cefalexina', 'cefadroxila',
  'ciprofloxacino', 'levofloxacino', 'moxifloxacino', 'norfloxacino',
  'sulfametoxazol', 'trimetoprima', 'metronidazol', 'clindamicina',
  'doxiciclina', 'nitrofurantoína', 'fosfomicina',
  // antifúngicos / antivirais
  'fluconazol', 'itraconazol', 'cetoconazol', 'nistatina', 'miconazol',
  'clotrimazol', 'terbinafina',
  'aciclovir', 'valaciclovir',
  // antialérgicos
  'loratadina', 'desloratadina', 'cetirizina', 'levocetirizina',
  'fexofenadina', 'ebastina', 'bilastina', 'dexclorfeniramina', 'hidroxizina',
  // pneumo
  'salbutamol', 'fenoterol', 'formoterol', 'salmeterol', 'budesonida',
  'beclometasona', 'fluticasona', 'mometasona', 'ipratrópio', 'tiotrópio',
  'montelucaste',
  // endócrino
  'levotiroxina',
  'prednisona', 'prednisolona', 'dexametasona', 'betametasona', 'hidrocortisona',
  'tamoxifeno', 'letrozol', 'anastrozol',
  // anticonc
  'drospirenona', 'levonorgestrel', 'desogestrel', 'gestodeno',
  'etinilestradiol', 'estradiol', 'dienogeste',
  // urologia
  'sildenafila', 'tadalafila', 'finasterida', 'dutasterida', 'tansulosina',
  // hema / coagulação
  'varfarina', 'rivaroxabana', 'dabigatrana', 'apixabana', 'clopidogrel',
  'enoxaparina',
  // outros
  'tramadol', 'codeína', 'alopurinol', 'colchicina',
  'donepezila', 'rivastigmina', 'memantina',
  'hidroxicloroquina', 'metotrexato', 'leflunomida',
]

// ---------- Doses ----------
// Decimais comuns (em mg)
const DOSES_DECIMAL = [
  '0,1', '0,125', '0,2', '0,25', '0,3', '0,4', '0,5', '0,6', '0,75', '0,8',
  '1,25', '1,5', '1,75',
  '2,5', '3,125', '3,5', '4,5', '6,25', '7,5',
  '12,5', '17,5', '22,5', '37,5',
]

const DOSES_INT = [
  '1', '2', '3', '4', '5', '6', '7', '8', '9', '10',
  '12', '15', '18', '20', '25', '30', '35', '40', '45',
  '50', '60', '70', '75', '80', '90',
  '100', '120', '125', '150', '160', '180',
  '200', '225', '240', '250', '300', '320', '350',
  '400', '450', '500', '600', '650', '700',
  '750', '800', '850', '875', '900', '960',
  '1000', '1200', '1500', '2000', '3000',
]

// Doses comuns em mg
const DOSES_MG_ALL = [...DOSES_DECIMAL, ...DOSES_INT]

// Em mcg
const DOSES_MCG = ['12', '25', '37', '50', '75', '88', '100', '112', '125', '137', '150', '175', '200', '250', '500']

// Em g
const DOSES_G = ['0,5', '1', '1,5', '2', '3', '4', '5']

// Em mg/ml
const DOSES_MG_ML = ['0,5', '1', '2', '5', '10', '20', '25', '40', '50', '100', '200', '250', '500']

// Em UI
const DOSES_UI = ['100', '250', '500', '1000', '2000', '5000', '10000', '50000', '100000']

// Em %
const DOSES_PCT = ['0,5', '1', '2', '3', '5', '10', '20']

// Dígitos pra Camada B (DCB + número simples)
const DIGITS_FOR_DCB = [
  '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
  '10', '20', '30', '40', '50', '60', '70', '80', '90',
  '100', '200', '250', '300', '400', '500', '600', '750', '800', '1000',
  '0,25', '0,5', '0,75', '1,25', '1,5', '2,5', '7,5', '12,5', '37,5',
]

// ---------- Gerador ----------

function generate() {
  const names = new Set()

  // ----- Camada A: Doses puras × unidades × (com/sem espaço) -----
  function addDose(num, unit) {
    names.add(`${num} ${unit}`)        // com espaço
    names.add(`${num}${unit}`)         // sem espaço
  }
  for (const n of DOSES_MG_ALL) addDose(n, 'mg')
  for (const n of DOSES_MCG) addDose(n, 'mcg')
  for (const n of DOSES_G) addDose(n, 'g')
  for (const n of DOSES_MG_ML) {
    addDose(n, 'mg/ml')
    addDose(n, 'mg/mL')
  }
  for (const n of DOSES_UI) {
    addDose(n, 'UI')
    addDose(n, 'ui')
  }
  for (const n of DOSES_PCT) addDose(n, '%')

  const tierA = names.size
  console.log(`Camada A (doses puras):     ${tierA} queries`)

  // ----- Camada B: DCB + dígito (substring pega múltiplas doses) -----
  for (const dcb of DCBs) {
    for (const d of DIGITS_FOR_DCB) {
      names.add(`${dcb} ${d}`)
    }
  }
  const tierB = names.size - tierA
  console.log(`Camada B (DCB + dígito):    ${tierB} queries`)

  // ----- Camada C: DCB + dose + unidade (com espaço correto) -----
  // Limitamos a doses MAIS comuns por unidade, senão explode
  const COMMON_MG = ['1', '2', '2,5', '5', '7,5', '10', '12,5', '15', '20', '25',
    '30', '50', '75', '100', '125', '150', '200', '250', '300', '400',
    '500', '600', '750', '800', '875', '1000']
  const COMMON_G = ['0,5', '1', '1,5', '2', '3']
  const COMMON_MCG = ['25', '50', '75', '100', '125', '150', '200', '500']
  const COMMON_MG_ML = ['1', '2', '5', '10', '20', '50', '100', '200', '500']
  const COMMON_UI = ['100', '500', '1000', '5000', '10000']
  const COMMON_PCT = ['0,5', '1', '2', '5']

  for (const dcb of DCBs) {
    for (const d of COMMON_MG) names.add(`${dcb} ${d} mg`)
    for (const d of COMMON_G) names.add(`${dcb} ${d} g`)
    for (const d of COMMON_MCG) names.add(`${dcb} ${d} mcg`)
    for (const d of COMMON_MG_ML) names.add(`${dcb} ${d} mg/ml`)
    for (const d of COMMON_UI) names.add(`${dcb} ${d} UI`)
    for (const d of COMMON_PCT) names.add(`${dcb} ${d} %`)
  }
  const tierC = names.size - tierA - tierB
  console.log(`Camada C (DCB+dose+unit):   ${tierC} queries`)

  return [...names]
}

async function main() {
  console.log('🔧 Gerando lista FULL...')
  const list = generate()
  console.log(`\n📊 Total: ${list.length.toLocaleString('pt-BR')} queries únicas`)

  const out = {
    description: 'Lista FULL gerada programaticamente. Camadas: doses puras + DCB+dígito + DCB+dose+unidade.',
    _generated_at: new Date().toISOString(),
    _camadas: {
      A: 'Doses puras × unidade × (com/sem espaço)',
      B: 'DCB + dígito (substring pega múltiplas doses)',
      C: 'DCB + dose + unidade (sintaxe correta com espaço)',
    },
    names: list,
  }

  await fs.writeFile(OUT_FILE, JSON.stringify(out, null, 2))
  console.log(`\n✅ Salvo em: ${OUT_FILE}`)
  console.log(`\n   Rodar: npm run validate:v5`)

  // estimativa de tempo
  const concurrency = Number(process.env.SCRAPER_CONCURRENCY || 4)
  const delay = Number(process.env.SCRAPER_DELAY_MS || 180)
  const estimatedSeconds = (list.length * delay) / concurrency / 1000
  const estimatedMin = Math.ceil(estimatedSeconds / 60)
  console.log(`\n⏱️  Estimativa (sem posologias): ~${estimatedMin} min`)
  console.log(`   (Com posologias dos novos: provavelmente 2-3× isso)`)
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
