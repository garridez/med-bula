<script setup lang="ts">
import {
  usePatientHistory,
  type HistoryAppointment,
} from '~/composables/usePatientHistory'
import { useDocuments } from '~/composables/useDocuments'

const props = defineProps<{
  patientId: number
  excludeAppointmentId?: number
  limit?: number
}>()

const historyApi = usePatientHistory()
const docsApi = useDocuments()

const items = ref<HistoryAppointment[]>([])
const loading = ref(true)
const error = ref('')
const expandedId = ref<number | null>(null)

async function load() {
  loading.value = true
  error.value = ''
  try {
    const res = await historyApi.fetch(props.patientId, {
      limit: props.limit ?? 10,
      excludeAppointmentId: props.excludeAppointmentId,
    })
    items.value = res.data
  } catch (e: any) {
    error.value = e?.data?.error || 'Erro ao carregar histórico'
  } finally {
    loading.value = false
  }
}

watch(
  () => [props.patientId, props.excludeAppointmentId],
  () => load(),
  { immediate: true }
)

defineExpose({ reload: load })

function toggle(id: number) {
  expandedId.value = expandedId.value === id ? null : id
}

function fmtDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  })
}
function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

const docTypeLabels: Record<string, string> = {
  prescription: 'Receita',
  exam_request: 'Pedido de exame',
  medical_certificate: 'Atestado',
}
const docStatusLabels: Record<string, string> = {
  draft: 'Rascunho',
  awaiting_signature: 'Pendente assinatura',
  signed: 'Assinado',
  failed: 'Falhou',
}
const docStatusClasses: Record<string, string> = {
  signed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  awaiting_signature: 'bg-amber-50 text-amber-700 border-amber-200',
  draft: 'bg-slate-100 text-slate-600 border-slate-200',
  failed: 'bg-red-50 text-red-700 border-red-200',
}

const apptStatusLabels: Record<string, string> = {
  scheduled: 'Agendada',
  confirmed: 'Confirmada',
  in_progress: 'Em andamento',
  completed: 'Realizada',
  no_show: 'Faltou',
}

async function openDoc(doc: { id: string }) {
  try {
    await docsApi.openPdf(doc.id)
  } catch (e: any) {
    error.value = e?.message || 'Erro ao abrir PDF'
  }
}

const hasRecord = (rec: HistoryAppointment['record']) =>
  !!(
    rec &&
    (rec.subjective || rec.objective || rec.assessment || rec.plan)
  )
</script>

<template>
  <div>
    <div v-if="loading" class="text-xs text-slate-400 italic">Carregando…</div>
    <div v-else-if="error" class="text-xs text-red-600">{{ error }}</div>
    <div v-else-if="items.length === 0" class="text-xs text-slate-400 italic">
      Sem consultas anteriores.
    </div>
    <ul v-else class="space-y-1.5">
      <li
        v-for="a in items"
        :key="a.id"
        class="rounded-lg border border-slate-200 bg-white overflow-hidden"
      >
        <button
          @click="toggle(a.id)"
          class="w-full px-3 py-2 flex items-start gap-2 text-left hover:bg-slate-50 transition"
        >
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <span class="text-xs font-semibold text-slate-900">
                {{ fmtDate(a.scheduledAt) }}
              </span>
              <span class="text-[10px] text-slate-400">
                {{ fmtTime(a.scheduledAt) }}
              </span>
              <span
                class="ml-auto text-[10px] px-1.5 py-0.5 rounded-full border bg-slate-50 text-slate-600 border-slate-200"
              >
                {{ apptStatusLabels[a.status] ?? a.status }}
              </span>
            </div>
            <div class="text-[11px] text-slate-500 mt-0.5 truncate">
              {{ a.doctor?.fullName ?? '—' }}
              <span v-if="a.insurance" class="text-slate-400">
                · {{ a.insurance.name }}
              </span>
              <span v-else-if="a.reason" class="text-slate-400">
                · {{ a.reason }}
              </span>
            </div>
            <div
              v-if="a.documents.length > 0 && expandedId !== a.id"
              class="flex gap-1 mt-1 flex-wrap"
            >
              <span
                v-for="d in a.documents.slice(0, 3)"
                :key="d.id"
                class="text-[10px] text-slate-500"
              >
                {{ docTypeLabels[d.type] }}
              </span>
              <span
                v-if="a.documents.length > 3"
                class="text-[10px] text-slate-400"
              >
                +{{ a.documents.length - 3 }}
              </span>
            </div>
          </div>
          <svg
            class="w-3.5 h-3.5 mt-0.5 text-slate-400 transition-transform"
            :class="{ 'rotate-180': expandedId === a.id }"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>

        <Transition name="expand">
          <div
            v-if="expandedId === a.id"
            class="px-3 py-2 border-t border-slate-100 bg-slate-50 text-xs space-y-2"
          >
            <div v-if="hasRecord(a.record)">
              <div v-if="a.record?.subjective" class="mb-1.5">
                <div class="text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-0.5">
                  S — Subjetivo
                </div>
                <p class="text-slate-700 whitespace-pre-wrap">
                  {{ a.record.subjective }}
                </p>
              </div>
              <div v-if="a.record?.objective" class="mb-1.5">
                <div class="text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-0.5">
                  O — Objetivo
                </div>
                <p class="text-slate-700 whitespace-pre-wrap">
                  {{ a.record.objective }}
                </p>
              </div>
              <div v-if="a.record?.assessment" class="mb-1.5">
                <div class="text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-0.5">
                  A — Avaliação
                </div>
                <p class="text-slate-700 whitespace-pre-wrap">
                  {{ a.record.assessment }}
                </p>
              </div>
              <div v-if="a.record?.plan">
                <div class="text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-0.5">
                  P — Plano
                </div>
                <p class="text-slate-700 whitespace-pre-wrap">{{ a.record.plan }}</p>
              </div>
            </div>
            <p v-else class="text-slate-400 italic text-[11px]">
              Sem prontuário registrado.
            </p>

            <div v-if="a.documents.length > 0" class="pt-2 border-t border-slate-200">
              <div class="text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
                Documentos
              </div>
              <ul class="space-y-1">
                <li
                  v-for="d in a.documents"
                  :key="d.id"
                  class="flex items-center justify-between"
                >
                  <button
                    @click="openDoc(d)"
                    class="text-bula-600 hover:text-bula-700 hover:underline text-xs"
                  >
                    {{ docTypeLabels[d.type] ?? d.type }}
                  </button>
                  <span
                    class="text-[10px] px-1.5 py-0.5 rounded-full border"
                    :class="docStatusClasses[d.status] ?? docStatusClasses.draft"
                  >
                    {{ docStatusLabels[d.status] ?? d.status }}
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </Transition>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.expand-enter-active,
.expand-leave-active {
  transition: opacity 150ms ease;
}
.expand-enter-from,
.expand-leave-to {
  opacity: 0;
}
</style>
