#!/usr/bin/env node
/**
 * audit-brands.mjs — auditoria LOCAL de marcas comerciais brasileiras.
 *
 * Lista ~500 marcas conhecidas BR. Pra cada uma, busca em medications.json
 * (substring case-insensitive, sem acento) e reporta:
 *   ✓ presente (N produtos, % com posologia, dosagens encontradas)
 *   ✗ ausente
 *
 * NÃO chama a API. É puramente local. Roda em segundos.
 *
 * Uso:
 *   npm run audit-brands                # roda auditoria, mostra resumo
 *   npm run audit-brands -- --detail    # mostra cada marca com produtos
 *   npm run audit-brands -- --export    # exporta missing-brands.json pra usar
 *                                         depois com validate.mjs
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const MEDS_FILE = path.join(__dirname, 'data', 'medications.json')
const POS_FILE = path.join(__dirname, 'data', 'posologies.json')
const MISSING_FILE = path.join(__dirname, 'missing-brands.json')

const ARG_DETAIL = process.argv.includes('--detail')
const ARG_EXPORT = process.argv.includes('--export')

// ---------- Lista de marcas top BR ----------
const BRANDS = [
  // Analgésicos / antitérmicos / AINEs
  'Tylenol', 'Dorflex', 'Buscopan', 'Buscoduo', 'Buscofem',
  'Neosaldina', 'Migraliv', 'Maxalt', 'Naramig', 'Sumax', 'Zomig',
  'Cataflam', 'Voltaren', 'Voltaren Emulgel', 'Voltaren Sachê',
  'Advil', 'Aspirina', 'AAS Protect', 'Doril', 'Naldecon',
  'Novalgina', 'Magnopirol', 'Anador', 'Lisador', 'Atroveran',
  'Resfenol', 'Engov', 'Cibalena', 'Tylex', 'Codex',
  'Toragesic', 'Profenid', 'Bi-Profenid', 'Ponstan', 'Mefenamil',
  'Calminex', 'Diclofenacol', 'Maxsuporten', 'Nimedex',
  'Algi-tanderil', 'Vick', 'Sonridor', 'Vimovo', 'Bextra',
  'Celebra', 'Arcoxia', 'Mobic', 'Mexilon', 'Movatec',

  // Antibióticos / Antifúngicos / Antivirais
  'Amoxil', 'Velamox', 'Clavulin', 'Trifamox', 'Cefacliman',
  'Bactrim', 'Zitromax', 'Zimax', 'Clarix', 'Azimax',
  'Cipro', 'Cinaplus', 'Floxin', 'Quinoflox', 'Tavanic', 'Levaquin',
  'Rocefin', 'Ceftin', 'Keflex', 'Ceflen', 'Ceclor',
  'Flagyl', 'Annita', 'Anita', 'Sulfatrim', 'Septra',
  'Macrodantina', 'Stamicin', 'Monuril',
  'Zovirax', 'Acivirex', 'Herpesil', 'Tamiflu',
  'Zoltec', 'Sporanox', 'Nizoral', 'Daktarin', 'Mycostatin', 'Lamisil',

  // Cardio
  'Selozok', 'Concor', 'Atensina', 'Atensina LP', 'Adalat',
  'Norvasc', 'Lopressor', 'Cordarone', 'Tenoretic',
  'Capoten', 'Renitec', 'Vasopril', 'Vasopril Plus', 'Vivacor',
  'Aradois', 'Cozaar', 'Hyzaar', 'Diovan', 'Co-Diovan',
  'Aprovel', 'Co-Aprovel', 'Micardis', 'Bensartana',
  'Olmetec', 'Benicar', 'Benicar HCT', 'Olmesar', 'Olpress',
  'Atenol', 'Atenoblok', 'Cardilol', 'Cardimax',
  'Crestor', 'Vytorin', 'Zetia', 'Zocor', 'Lipitor', 'Citalor',
  'Atorlip', 'Lipless', 'Pravacol', 'Lopid',
  'Lasix', 'Higroton', 'Aldactone', 'Diurix',
  'Cardura', 'Carduran', 'Minipress', 'Hytrin',
  'Cardizem', 'Tilazem', 'Procoralan',

  // Diabetes
  'Glifage', 'Glucophage', 'Glucovance', 'Glucanin', 'Glucol',
  'Galvus', 'Janumet', 'Trayenta', 'Onglyza',
  'Forxiga', 'Jardiance', 'Trijardy', 'Kombiglyze XR',
  'Saxenda', 'Victoza', 'Ozempic', 'Trulicity', 'Mounjaro', 'Wegovy',
  'Lantus', 'Toujeo', 'Levemir', 'Tresiba', 'Humalog',
  'NovoRapid', 'Apidra', 'Soliqua', 'Xultophy',
  'Daonil', 'Diamicron', 'Diamicron MR', 'Amaryl', 'Solosa',
  'Glucobay', 'Actos',

  // Gastro
  'Losec', 'Pantozol', 'Nexium', 'Prazol', 'Pariet', 'Tecta',
  'Esomeprazol', 'Refluxar', 'Omeprazol',
  'Motilium', 'Plasil', 'Vonau', 'Bromopride',
  'Mylanta', 'Mylanta Plus', 'Pepsamar', 'Estomalcin',
  'Gaviscon', 'Antak', 'Tagamet',
  'Sonrisal', 'Sal de Andrews', 'Eno', 'Estomazil',
  'Eparema', 'Hepatilon', 'Lactopurga', 'Naturetti', 'Tamarine',
  'Imosec', 'Hidrasec', 'Tiorfan', 'Diasec',

  // Psiquiátricos / Neurológicos
  'Cipralex', 'Lexapro', 'Reconter', 'Esitca',
  'Daforin', 'Prozac', 'Fluoxetin', 'Verotina',
  'Zoloft', 'Pondera', 'Sertralin', 'Tolrest',
  'Aropax', 'Paxil', 'Pondera',
  'Cymbalta', 'Dualid', 'Velija',
  'Efexor', 'Pristiq', 'Venlift',
  'Wellbutrin', 'Zyban', 'Bup',
  'Remeron', 'Mirtaron', 'Menelat',
  'Pamelor', 'Tryptanol', 'Anafranil', 'Tofranil',
  'Frontal', 'Lexotan', 'Lorax', 'Valium',
  'Rivotril', 'Clonotril', 'Clopam',
  'Stilnox', 'Lioram', 'Donaren', 'Trittico',
  'Olcadil', 'Halc',
  'Seroquel', 'Quetros', 'Quetapin',
  'Risperdal', 'Risperdon',
  'Zyprexa', 'Olanzapin',
  'Abilify', 'Aripiprazol',
  'Geodon', 'Latuda', 'Clopixol',
  'Haldol',
  'Ritalina', 'Concerta', 'Venvanse', 'Strattera',
  'Tegretol', 'Trileptal', 'Trileptal CR',
  'Depakote', 'Depakene', 'Lamictal',
  'Topamax', 'Topamax Sprinkle',
  'Lyrica', 'Lyrica CR', 'Neurontin',
  'Keppra', 'Sabril', 'Gardenal',
  'Carbolitium', 'Litium',
  'Ebix', 'Eranz', 'Exelon', 'Donepezil',
  'Sifrol', 'Mirapex', 'Requip', 'Prolopa', 'Sinemet', 'Stalevo',
  'Azilect', 'Akineton', 'Akathin',

  // ORL / Respiratório / Antialérgicos
  'Otrivina', 'Sorine', 'Sinex', 'Naridrin', 'Decongest',
  'Rinosoro', 'Maresis',
  'Mucosolvan', 'Fluimucil', 'Bisolvon', 'Bromhexina', 'Acebrofeno',
  'Apracur', 'Vibrocil', 'Coristina D', 'Allegra D', 'Loratamed D',
  'Nasonex', 'Avamys', 'Veramyst', 'Rhinocort', 'Nasacort',
  'Allegra', 'Cetinax', 'Zyrtec', 'Claritin', 'Loratamed',
  'Polaramine', 'Histamin', 'Telfast', 'Reactin',
  'Aerolin', 'Berotec', 'Berodual', 'Bricanyl',
  'Foradil', 'Onbrize',
  'Symbicort', 'Seretide', 'Vannair', 'Trelegy', 'Anoro', 'Seebri',
  'Pulmicort', 'Clenil', 'Flixotide',
  'Atrovent', 'Spiriva',
  'Singulair', 'Montelair', 'Accolate', 'Daxas',

  // Dermato / Tópicos
  'Bepantol', 'Bepantol Baby', 'Bepantol Derma',
  'Hipoglós', 'Hipoglós Cremoso',
  'Cicaplast', 'Cicaplast Baume', 'Cicalfate', 'Cicatricure',
  'Caladryl', 'Caladerm', 'Calmosine',
  'Trofodermin', 'Contractubex', 'Kelo-Cote', 'Bio-Oil', 'Mederma',
  'Effaclar', 'Toleriane', 'Anthelios', 'Capital Soleil', 'Photoderm',
  'Mineral 89', 'Liftactiv',
  'Skinceuticals', 'La Roche-Posay', 'Vichy', 'Avene', 'Bioderma',
  'Eucerin', 'Cetaphil', 'Neutrogena', 'Nivea', 'Sallve',
  'Granado', 'Phebo',
  'Pielus', 'Caspar', 'Pirisept', 'Selsun', 'Nizoral Shampoo',
  'Dermovate', 'Diprosone', 'Diprosalic', 'Cutaderm',
  'Triderm', 'Dermazine', 'Sulfadiazina',

  // Vitaminas / Suplementos
  'Centrum', 'Pharmaton', 'Berocca', 'Supradyn',
  'Caltrate', 'Calcitran', 'Bonecal', 'Cálcio D3',
  'Ferronyl', 'Combiron', 'Noripurum', 'Sulfato Ferroso',
  'Addera D3', 'DePura', 'Vita D', 'Vidacaps',
  'Cebion', 'Cebrocan', 'Vitamina C', 'Redoxon',
  'Vitergan', 'Aderogil', 'Active D',
  'Magnesil', 'Magmax', 'Dimag', 'Centrum Mulher', 'Centrum Homem',
  'Vit', 'Apevitin', 'Vitafer', 'Iberogast',

  // Urologia / Sexologia
  'Viagra', 'Cialis', 'Levitra', 'Spedra',
  'Proscar', 'Avodart', 'Finalop', 'Secotex',
  'Mictonorm', 'Vesicare',

  // Anticoagulantes / Antiagregantes
  'Marevan', 'Xarelto', 'Pradaxa', 'Eliquis',
  'Plavix', 'Brilinta', 'Clexane', 'Liquemine',

  // Outros
  'Tramal', 'Tramadon', 'Codein', 'Dimorf', 'MST',
  'Zyloric', 'Uloric', 'Colchis', 'Allopurinol',
  'Sandostatin', 'Xolair', 'Latisse',
  'Maleato', 'Targifor', 'Targifor C', 'Energil C',
  'Cardioxane', 'Sutent', 'Cyramza', 'Stivarga',
  'Sustanon', 'Durateston', 'Deposteron', 'Androgel', 'Testovirin',
  'Premarin', 'Climen', 'Cyclacur', 'Estradot', 'Estreva',
  'Yasmin', 'Yaz', 'Yasminelle', 'Iumi', 'Stezza',
  'Allurene', 'Tâmisa', 'Selene', 'Diane', 'Diane 35',
  'Cerazette', 'Belara', 'Mirena', 'Microvlar', 'Trinordiol',
  'Reuquinol', 'Plaquinol', 'Quensyl',
  'Puran T4', 'Synthroid', 'Levoid', 'Euthyrox', 'Tapazol',
  'Decadron', 'Celestone', 'Meticorten', 'Predsim', 'Diprospan',
  'Triancil', 'Diprogenta', 'Diprosalic',
  'Glivec', 'Tasigna', 'Sprycel', 'Tarceva', 'Iressa', 'Tagrisso',
  'Verzenios', 'Ibrance', 'Talzenna',
  'Otezla', 'Stelara', 'Skyrizi', 'Tremfya', 'Cosentyx', 'Taltz',
  'Humira', 'Enbrel', 'Remicade', 'Mabthera', 'Rituxan', 'Actemra',
  'Imbruvica', 'Zydelig', 'Olysio', 'Sovaldi', 'Harvoni', 'Mavyret',

  // Marcas regionais e populares
  'Dorzol', 'Diprospan Hypak', 'Algi-Reumatril',
  'Termogen', 'Hypermag', 'Magnesil B6',
  'Maraviroque', 'Indinavir', 'Combivir', 'Truvada',
  'Lactacyd', 'Plenitude', 'Always',
  'Maxlitan', 'Gardenal Sódico', 'Sabril',
  'Tylenol Bebê', 'Tylenol Sinus', 'Tylenol DC',
  'Dorflex Max', 'Dorflex Uno',
  'Buscopan Composto', 'Buscopan Plus',
]

function normalize(s) {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

async function main() {
  const meds = JSON.parse(await fs.readFile(MEDS_FILE, 'utf8'))
  const pos = JSON.parse(await fs.readFile(POS_FILE, 'utf8'))
  const posByMed = new Set(pos.map(p => p.medicationId))

  // dedupe
  const brands = [...new Set(BRANDS.map(b => b.trim()))].sort()

  console.log(`🏷️  Auditoria de marcas BR (local, sem API)`)
  console.log(`   Marcas a verificar: ${brands.length}`)
  console.log(`   Meds no JSON:       ${meds.length}`)
  console.log('')

  const results = []
  for (const brand of brands) {
    const term = normalize(brand)
    const matches = meds.filter(m =>
      normalize(m.title).includes(term)
    )
    const withPos = matches.filter(m => posByMed.has(m.id)).length

    // Pega as dosagens distintas observadas (heurística: extrai padrão "N un" do título)
    const doses = new Set()
    for (const m of matches) {
      const found = (m.title || '').match(/\d+(?:[,.]\d+)?\s*(?:mg|mcg|g|ml|ui|%)(?:\/\w+)?/gi) || []
      for (const f of found) doses.add(f.toLowerCase())
    }

    results.push({
      brand,
      count: matches.length,
      withPos,
      doses: [...doses],
    })
  }

  const present = results.filter(r => r.count > 0)
  const missing = results.filter(r => r.count === 0)

  // ---------- resumo ----------
  console.log(`═══════════════════════════════════════════════════════════`)
  console.log(`📊 Resumo`)
  console.log(`═══════════════════════════════════════════════════════════`)
  console.log(`Presentes:    ${present.length}/${brands.length} (${((present.length / brands.length) * 100).toFixed(1)}%)`)
  console.log(`Ausentes:     ${missing.length}/${brands.length} (${((missing.length / brands.length) * 100).toFixed(1)}%)`)

  // Top 10 mais com produtos
  const topPresent = [...present].sort((a, b) => b.count - a.count).slice(0, 10)
  console.log(`\nTop 10 marcas com MAIS produtos:`)
  for (const r of topPresent) {
    console.log(`  ${String(r.count).padStart(3)} produtos | ${r.brand}`)
  }

  // ---------- detail ----------
  if (ARG_DETAIL) {
    console.log(`\n═══════════════════════════════════════════════════════════`)
    console.log(`📋 Detalhamento (presentes)`)
    console.log(`═══════════════════════════════════════════════════════════`)
    for (const r of present) {
      const dosesStr = r.doses.length > 0
        ? r.doses.slice(0, 8).join(', ')
        : '(sem dose no título)'
      console.log(
        `  ✓ ${r.brand.padEnd(25)} ${String(r.count).padStart(3)} produtos, pos ${r.withPos}/${r.count}` +
        `\n      doses: ${dosesStr}${r.doses.length > 8 ? '...' : ''}`
      )
    }
  }

  // ---------- ausentes ----------
  console.log(`\n═══════════════════════════════════════════════════════════`)
  console.log(`❌ Marcas AUSENTES (${missing.length})`)
  console.log(`═══════════════════════════════════════════════════════════`)
  const missingNames = missing.map(r => r.brand)
  // print em colunas
  const cols = 3
  const colWidth = 25
  for (let i = 0; i < missingNames.length; i += cols) {
    const row = missingNames.slice(i, i + cols).map(n => n.padEnd(colWidth)).join('')
    console.log(`  ${row}`)
  }

  // ---------- export ----------
  if (ARG_EXPORT) {
    const exportData = {
      description: 'Marcas ausentes na auditoria local. Use com validate.mjs --list pra forçar busca via API.',
      _generated_at: new Date().toISOString(),
      _origin: 'audit-brands.mjs --export',
      names: missingNames,
    }
    await fs.writeFile(MISSING_FILE, JSON.stringify(exportData, null, 2))
    console.log(`\n💾 Exportado pra ${MISSING_FILE}`)
    console.log(`   Pra puxar essas via API:`)
    console.log(`   node --env-file=.env validate.mjs --list=missing-brands.json`)
  }

  console.log(`\n✅ Auditoria concluída`)
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
