<script setup lang="ts">
import type { PatientDiagnosis } from '~/composables/usePatients'

const props = defineProps<{
  modelValue: PatientDiagnosis[] | null
  canEdit?: boolean
  onSave: (diagnoses: PatientDiagnosis[]) => Promise<void>
}>()

const emit = defineEmits<{
  'update:modelValue': [v: PatientDiagnosis[]]
}>()

const showAddForm = ref(false)
const newCode = ref('')
const newDescription = ref('')
const saving = ref(false)
const error = ref('')

const list = computed<PatientDiagnosis[]>(() => props.modelValue ?? [])

function fmtDate(iso?: string): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  })
}

async function addDiagnosis() {
  error.value = ''
  if (!newCode.value.trim() || !newDescription.value.trim()) {
    error.value = 'Código e descrição são obrigatórios'
    return
  }
  const next: PatientDiagnosis[] = [
    ...list.value,
    {
      code: newCode.value.trim().toUpperCase(),
      description: newDescription.value.trim(),
      recordedAt: new Date().toISOString(),
    },
  ]
  saving.value = true
  try {
    await props.onSave(next)
    emit('update:modelValue', next)
    newCode.value = ''
    newDescription.value = ''
    showAddForm.value = false
  } catch (e: any) {
    error.value = e?.data?.error || e?.message || 'Erro ao salvar'
  } finally {
    saving.value = false
  }
}

async function removeDiagnosis(idx: number) {
  if (!confirm('Remover esse diagnóstico do paciente?')) return
  const next = list.value.filter((_, i) => i !== idx)
  saving.value = true
  try {
    await props.onSave(next)
    emit('update:modelValue', next)
  } catch (e: any) {
    error.value = e?.data?.error || e?.message || 'Erro ao remover'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="bg-white rounded-lg border border-slate-200 p-4">
    <div class="flex items-center justify-between mb-3">
      <div>
        <h3 class="text-xs font-semibold text-slate-700">
          Últimos diagnósticos
        </h3>
        <p class="text-[10px] text-slate-500">
          CID-10 registrados ao longo do acompanhamento
        </p>
      </div>
      <button
        v-if="canEdit !== false && !showAddForm"
        type="button"
        @click="showAddForm = true"
        class="text-xs text-bula-600 hover:text-bula-700 font-medium"
      >
        + Adicionar
      </button>
    </div>

    <ul v-if="list.length > 0" class="space-y-2 mb-3">
      <li
        v-for="(d, idx) in list"
        :key="`${d.code}-${idx}`"
        class="flex items-start gap-2 p-2 bg-slate-50 rounded text-sm"
      >
        <span
          class="font-mono font-semibold text-bula-700 text-xs px-1.5 py-0.5 bg-bula-50 rounded border border-bula-200 flex-shrink-0"
        >
          {{ d.code }}
        </span>
        <div class="flex-1 min-w-0">
          <p class="text-slate-800 leading-tight">{{ d.description }}</p>
          <p v-if="d.recordedAt" class="text-[10px] text-slate-500 mt-0.5">
            Registrado em {{ fmtDate(d.recordedAt) }}
          </p>
        </div>
        <button
          v-if="canEdit !== false"
          type="button"
          @click="removeDiagnosis(idx)"
          class="text-slate-400 hover:text-red-600 flex-shrink-0"
          title="Remover"
        >
          <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </li>
    </ul>
    <p v-else class="text-sm text-slate-400 italic mb-3">
      Nenhum diagnóstico registrado.
    </p>

    <!-- Add form -->
    <div
      v-if="showAddForm"
      class="border-t border-slate-100 pt-3 space-y-2"
    >
      <div class="grid grid-cols-[100px_1fr] gap-2">
        <input
          v-model="newCode"
          type="text"
          placeholder="CID-10"
          maxlength="10"
          class="px-2 py-1.5 border border-slate-200 rounded text-sm uppercase focus:outline-none focus:ring-2 focus:ring-bula-200"
          @keydown.enter="addDiagnosis"
        />
        <input
          v-model="newDescription"
          type="text"
          placeholder="Descrição (ex: Diabetes tipo 2)"
          class="px-2 py-1.5 border border-slate-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-bula-200"
          @keydown.enter="addDiagnosis"
        />
      </div>
      <div class="flex items-center gap-2 text-xs">
        <button
          type="button"
          @click="addDiagnosis"
          :disabled="saving"
          class="px-3 py-1 bg-bula-500 hover:bg-bula-600 text-white rounded font-medium disabled:opacity-50"
        >
          {{ saving ? 'Salvando…' : 'Adicionar' }}
        </button>
        <button
          type="button"
          @click="showAddForm = false"
          :disabled="saving"
          class="px-3 py-1 text-slate-500 hover:text-slate-700"
        >
          Cancelar
        </button>
      </div>
      <p v-if="error" class="text-xs text-red-600">{{ error }}</p>
    </div>
  </div>
</template>
