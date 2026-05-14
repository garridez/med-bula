<script setup lang="ts">
import {
  useMedications,
  type MedicationSearchResult,
  type MedicationPosology,
} from '~/composables/useMedications'

export interface PrescriptionItem {
  medicationId?: string | null
  medicationTitle?: string | null
  activeIngredient?: string | null
  laboratoryName?: string | null
  category?: string | null
  unit?: string | null
  freeText?: string | null
  posology?: string | null
  prescriptionType?:
    | 'simples'
    | 'duas_vias'
    | 'controle_especial'
    | 'controle_antimicrobiano'
  usageType?:
    | 'nao_informada'
    | 'uso_continuo'
    | 'comprimidos'
    | 'embalagens'
    | 'unidades'
  usageQuantity?: number | null
}

const props = defineProps<{
  modelValue: PrescriptionItem
  index: number
}>()

const emit = defineEmits<{
  'update:modelValue': [item: PrescriptionItem]
  remove: []
}>()

const medsApi = useMedications()

// Estado local
const mode = ref<'medication' | 'freetext'>(
  props.modelValue.medicationId
    ? 'medication'
    : props.modelValue.freeText
    ? 'freetext'
    : 'medication'
)
const searchTerm = ref(props.modelValue.medicationTitle ?? '')
const searchResults = ref<MedicationSearchResult[]>([])
const showResults = ref(false)
const searching = ref(false)
const searchError = ref('')

const posologySuggestions = ref<MedicationPosology[]>([])
const posologySource = ref<'direct' | 'fallback' | null>(null)
const posologySourceName = ref<string | null>(null)
const loadingPosologies = ref(false)
const showPosologyDropdown = ref(false)

const freeTextValue = ref(props.modelValue.freeText ?? '')
const posologyFocused = ref(false)

// Form local — espelho do modelValue, emite up on every change
const local = reactive<PrescriptionItem>({ ...props.modelValue })
local.prescriptionType ??= 'simples'
local.usageType ??= 'nao_informada'

function emitUpdate() {
  emit('update:modelValue', { ...local })
}

// ---- Busca de medicamento (debounced) ----
let searchTimer: any = null
function onSearchInput() {
  clearTimeout(searchTimer)
  searchError.value = ''
  if (searchTerm.value.trim().length < 2) {
    searchResults.value = []
    showResults.value = false
    return
  }
  searchTimer = setTimeout(doSearch, 200)
}

async function doSearch() {
  searching.value = true
  try {
    const res = await medsApi.search(searchTerm.value.trim(), 10)
    searchResults.value = res.data
    showResults.value = true
  } catch (e: any) {
    searchError.value = e?.data?.error || 'Erro na busca'
  } finally {
    searching.value = false
  }
}

async function selectMedication(med: MedicationSearchResult) {
  local.medicationId = med.id
  local.medicationTitle = med.title ?? ''
  local.activeIngredient = med.activeIngredient
  local.laboratoryName = med.laboratoryName
  local.category = med.category
  local.unit = med.unitSingular ?? null
  local.freeText = null
  // Pré-seleciona prescriptionType conforme catálogo
  local.prescriptionType = mapCliquerxToType(med.prescriptionType)
  searchTerm.value = med.title ?? ''
  showResults.value = false
  emitUpdate()
  await loadPosologies(med.id)
}

function mapCliquerxToType(t: string | null): PrescriptionItem['prescriptionType'] {
  if (!t) return 'simples'
  const lower = t.toLowerCase()
  if (lower.includes('controle')) return 'controle_especial'
  if (lower.includes('antibiótico') || lower.includes('antibiotico'))
    return 'controle_antimicrobiano'
  if (lower.includes('2 vias') || lower.includes('duas vias'))
    return 'duas_vias'
  return 'simples'
}

async function loadPosologies(medId: string) {
  loadingPosologies.value = true
  try {
    const res = await medsApi.posologies(medId)
    posologySuggestions.value = res.data
    posologySource.value = res.source
    posologySourceName.value = res.sourceMedicationTitle ?? null
    // Auto-preenche posologia se houver exatamente 1 sugestão e o campo tá vazio
    if (res.data.length === 1 && !local.posology) {
      local.posology = res.data[0].content
      if (res.data[0].usageQuantity != null) {
        local.usageQuantity = res.data[0].usageQuantity
      }
      emitUpdate()
    }
  } catch {
    posologySuggestions.value = []
  } finally {
    loadingPosologies.value = false
  }
}

function pickPosology(p: MedicationPosology) {
  local.posology = p.content
  if (p.usageQuantity != null) local.usageQuantity = p.usageQuantity
  showPosologyDropdown.value = false
  emitUpdate()
}

function clearMedication() {
  local.medicationId = null
  local.medicationTitle = null
  local.activeIngredient = null
  local.laboratoryName = null
  local.category = null
  local.unit = null
  local.posology = null
  local.usageQuantity = null
  searchTerm.value = ''
  posologySuggestions.value = []
  posologySource.value = null
  emitUpdate()
}

function switchToFreeText() {
  mode.value = 'freetext'
  clearMedication()
  local.freeText = freeTextValue.value
  emitUpdate()
}

function switchToMedication() {
  mode.value = 'medication'
  local.freeText = null
  emitUpdate()
}

function onFreeTextInput() {
  local.freeText = freeTextValue.value
  emitUpdate()
}

function onPosologyInput(e: Event) {
  local.posology = (e.target as HTMLTextAreaElement).value
  emitUpdate()
}

function onTypeChange() {
  emitUpdate()
}

const prescriptionTypeLabels = {
  simples: 'Receituário simples',
  duas_vias: 'Receita em duas vias',
  controle_especial: 'Controle especial',
  controle_antimicrobiano: 'Controle antimicrobiano',
} as const

const usageTypeLabels = {
  nao_informada: 'Não Informada',
  uso_continuo: 'uso contínuo',
  comprimidos: 'comprimidos',
  embalagens: 'embalagens',
  unidades: 'unidades',
} as const

const categoryColors: Record<string, string> = {
  Genérico: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Similar: 'bg-amber-50 text-amber-700 border-amber-200',
  Referência: 'bg-blue-50 text-blue-700 border-blue-200',
}
</script>

<template>
  <div class="bg-white border border-slate-200 rounded-lg">
    <div class="p-3">
      <div class="flex items-start gap-3">
        <!-- Numbering -->
        <div
          class="flex-shrink-0 w-6 h-6 rounded-full bg-bula-50 text-bula-700 text-xs font-bold flex items-center justify-center mt-1"
        >
          {{ index + 1 }}
        </div>

        <!-- Main content -->
        <div class="flex-1 min-w-0">
          <!-- Mode tabs -->
          <div class="flex items-center gap-1 mb-2 text-[11px]">
            <button
              @click="switchToMedication"
              class="px-2 py-0.5 rounded-md transition"
              :class="
                mode === 'medication'
                  ? 'bg-bula-50 text-bula-700 font-medium'
                  : 'text-slate-500 hover:text-slate-700'
              "
            >
              Catálogo
            </button>
            <span class="text-slate-300">·</span>
            <button
              @click="switchToFreeText"
              class="px-2 py-0.5 rounded-md transition"
              :class="
                mode === 'freetext'
                  ? 'bg-bula-50 text-bula-700 font-medium'
                  : 'text-slate-500 hover:text-slate-700'
              "
            >
              Texto livre
            </button>
          </div>

          <!-- Mode: medicação do catálogo -->
          <template v-if="mode === 'medication'">
            <!-- Med picker / display -->
            <div v-if="!local.medicationId" class="relative">
              <div class="relative">
                <svg
                  class="absolute left-2.5 top-2.5 w-4 h-4 text-slate-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z"
                  />
                </svg>
                <input
                  v-model="searchTerm"
                  @input="onSearchInput"
                  @focus="searchResults.length > 0 && (showResults = true)"
                  type="text"
                  placeholder="Buscar medicamento ou substância…"
                  class="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-bula-200 focus:border-bula-300"
                />
              </div>

              <!-- Search results dropdown -->
              <div
                v-if="showResults && searchResults.length > 0"
                class="absolute z-30 mt-1 w-full max-h-72 overflow-y-auto bg-white border border-slate-200 rounded-md shadow-xl"
              >
                <button
                  v-for="med in searchResults"
                  :key="med.id"
                  type="button"
                  @click="selectMedication(med)"
                  class="w-full px-3 py-2 text-left hover:bg-slate-50 border-b border-slate-100 last:border-0"
                >
                  <div class="flex items-start justify-between gap-2">
                    <div class="flex-1 min-w-0">
                      <div class="font-medium text-slate-900 text-sm truncate">
                        {{ med.title }}
                      </div>
                      <div class="text-[11px] text-slate-500 truncate">
                        <template v-if="med.activeIngredient">
                          {{ med.activeIngredient }}
                        </template>
                        <template v-if="med.laboratoryName">
                          · {{ med.laboratoryName }}
                        </template>
                      </div>
                    </div>
                    <div class="flex flex-col items-end gap-1 flex-shrink-0">
                      <span
                        v-if="med.category"
                        class="text-[10px] px-1.5 py-0.5 rounded-full border"
                        :class="
                          categoryColors[med.category] ||
                          'bg-slate-100 text-slate-600 border-slate-200'
                        "
                      >
                        {{ med.category }}
                      </span>
                      <span
                        v-if="med.prescriptionType"
                        class="text-[10px] text-slate-500"
                      >
                        {{ med.prescriptionType }}
                      </span>
                    </div>
                  </div>
                </button>
              </div>
              <p
                v-if="searchTerm.length >= 2 && !searching && searchResults.length === 0 && showResults"
                class="mt-1 text-xs text-slate-400 italic"
              >
                Nenhum resultado.
              </p>
              <p v-if="searchError" class="mt-1 text-xs text-red-600">
                {{ searchError }}
              </p>
            </div>

            <!-- Selected medication -->
            <div v-else>
              <div class="flex items-start gap-2">
                <div class="flex-1 min-w-0">
                  <div class="font-medium text-slate-900 text-sm">
                    {{ local.medicationTitle }}
                  </div>
                  <div class="text-[11px] text-slate-500 mt-0.5">
                    <span v-if="local.activeIngredient">
                      {{ local.activeIngredient }}
                    </span>
                    <span v-if="local.laboratoryName">
                      · {{ local.laboratoryName }}
                    </span>
                    <span v-if="local.category">· {{ local.category }}</span>
                  </div>
                </div>
                <button
                  @click="clearMedication"
                  class="text-xs text-slate-400 hover:text-red-600"
                  title="Trocar medicamento"
                >
                  ✕
                </button>
              </div>

              <!-- Posology -->
              <div class="mt-3 relative">
                <div class="flex items-center justify-between mb-1">
                  <label class="text-[11px] font-medium text-slate-500 uppercase tracking-wide">
                    Posologia
                  </label>
                  <button
                    v-if="posologySuggestions.length > 0"
                    type="button"
                    @click="showPosologyDropdown = !showPosologyDropdown"
                    class="text-[11px] text-bula-600 hover:text-bula-700 font-medium"
                  >
                    {{ posologySuggestions.length }} sugestão{{
                      posologySuggestions.length > 1 ? 'es' : ''
                    }}
                    {{ showPosologyDropdown ? '▲' : '▼' }}
                  </button>
                </div>
                <textarea
                  :value="local.posology ?? ''"
                  @input="onPosologyInput"
                  @focus="posologyFocused = true"
                  @blur="posologyFocused = false"
                  placeholder="Digite a posologia ou escolha uma sugestão…"
                  :rows="posologyFocused || (local.posology && local.posology.length > 50) ? 3 : 1"
                  class="w-full px-3 py-2 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-bula-200 focus:border-bula-300 resize-y transition-all"
                />

                <!-- Posology suggestions dropdown -->
                <div
                  v-if="showPosologyDropdown && posologySuggestions.length > 0"
                  class="absolute z-10 mt-1 w-full max-h-72 overflow-y-auto bg-white border border-slate-200 rounded-md shadow-lg"
                >
                  <p
                    v-if="posologySource === 'fallback' && posologySourceName"
                    class="px-3 py-1.5 text-[10px] bg-amber-50 text-amber-800 border-b border-amber-200"
                  >
                    ℹ Posologia da apresentação de referência ({{
                      posologySourceName
                    }})
                  </p>
                  <button
                    v-for="p in posologySuggestions"
                    :key="p.id"
                    type="button"
                    @click="pickPosology(p)"
                    class="w-full px-3 py-2 text-left hover:bg-slate-50 border-b border-slate-100 last:border-0"
                  >
                    <div
                      v-if="p.population || p.ageRange || p.indication"
                      class="text-[10px] font-semibold text-slate-500 uppercase mb-0.5"
                    >
                      <span v-if="p.population">{{ p.population }}</span>
                      <span v-if="p.ageRange">· {{ p.ageRange }}</span>
                      <span v-if="p.indication">— {{ p.indication }}</span>
                    </div>
                    <p class="text-xs text-slate-700 whitespace-pre-wrap">
                      {{ p.content }}
                    </p>
                  </button>
                </div>

                <p
                  v-if="loadingPosologies"
                  class="mt-1 text-[11px] text-slate-400 italic"
                >
                  Carregando posologias…
                </p>
                <p
                  v-else-if="
                    posologySuggestions.length === 0 && local.medicationId
                  "
                  class="mt-1 text-[11px] text-slate-400 italic"
                >
                  Sem sugestões de posologia — digite manualmente.
                </p>
              </div>
            </div>
          </template>

          <!-- Mode: texto livre -->
          <template v-else>
            <textarea
              v-model="freeTextValue"
              @input="onFreeTextInput"
              placeholder="Texto livre da prescrição…"
              rows="3"
              class="w-full px-3 py-2 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-bula-200 focus:border-bula-300 resize-y"
            />
          </template>

          <!-- Type + usage row -->
          <div class="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label class="text-[10px] font-medium text-slate-500 uppercase tracking-wide">
                Tipo de receita
              </label>
              <select
                v-model="local.prescriptionType"
                @change="onTypeChange"
                class="mt-0.5 w-full px-2.5 py-1.5 border border-slate-200 rounded-md text-xs"
              >
                <option v-for="(label, key) in prescriptionTypeLabels" :key="key" :value="key">
                  {{ label }}
                </option>
              </select>
            </div>
            <div>
              <label class="text-[10px] font-medium text-slate-500 uppercase tracking-wide">
                Tipo de uso
              </label>
              <select
                v-model="local.usageType"
                @change="onTypeChange"
                class="mt-0.5 w-full px-2.5 py-1.5 border border-slate-200 rounded-md text-xs"
              >
                <option v-for="(label, key) in usageTypeLabels" :key="key" :value="key">
                  {{ label }}
                </option>
              </select>
            </div>
          </div>
        </div>

        <!-- Remove button -->
        <button
          @click="emit('remove')"
          class="flex-shrink-0 text-slate-400 hover:text-red-600 transition mt-1"
          title="Remover item"
        >
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>
