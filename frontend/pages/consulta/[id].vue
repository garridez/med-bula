<script setup lang="ts">
import { useApi } from '~/composables/useApi'
import { useSignature } from '~/composables/useSignature'
import {
  useMedicalRecords,
  type MedicalRecord,
  type Vitals,
} from '~/composables/useMedicalRecords'
import {
  useDocuments,
  type Document,
  type PrescriptionItem,
  type ExamItem,
} from '~/composables/useDocuments'
import { useAppointments, type Appointment } from '~/composables/useAppointments'
import {
  formatDateBR,
  formatDateTimeBR,
  ageFromBirthDate,
  initials,
  formatBRL,
} from '~/utils/format'

const route = useRoute()
const api = useApi()
const recordsApi = useMedicalRecords()
const docsApi = useDocuments()
const apptsApi = useAppointments()

const appointmentId = computed(() => Number(route.params.id))

// State
const loading = ref(true)
const saving = ref(false)
const error = ref<string | null>(null)
const appointment = ref<Appointment | null>(null)
const startedAt = ref<Date | null>(null)
const elapsedTime = ref('00:00')

// Prontuário
const record = ref<MedicalRecord | null>(null)
const soap = reactive({
  subjective: '',
  objective: '',
  assessment: '',
  plan: '',
  notes: '',
})
const vitals = reactive<Vitals>({
  bp: '',
  hr: undefined,
  rr: undefined,
  temp: undefined,
  spo2: undefined,
  weight: undefined,
  height: undefined,
})
const recordSaved = ref(false)

// Documentos
const documents = ref<Document[]>([])
const activeTab = ref<'prontuario' | 'prescription' | 'exam_request' | 'medical_certificate'>(
  'prontuario'
)

// Signature modal
const sigModalOpen = ref(false)
const sigDocumentIds = ref<string[]>([])

function openSignature(docIds: string[]) {
  sigDocumentIds.value = docIds
  sigModalOpen.value = true
}

async function onSigned() {
  sigModalOpen.value = false
  // recarrega lista pra refletir status 'signed'
  if (!appointment.value) return
  const docsRes = await docsApi.listByAppointment(appointment.value.id)
  documents.value = docsRes.data
}

const sig = useSignature()
const sendingWa = ref<string | null>(null)

async function openPdf(doc: Document) {
  try {
    await docsApi.openPdf(doc.id)
  } catch (e: any) {
    error.value = e?.message || 'Erro ao abrir PDF'
  }
}

async function sendWhatsApp(doc: Document) {
  sendingWa.value = doc.id
  try {
    const res = await sig.sendToWhatsApp(doc.id)
    alert(
      `📱 WhatsApp (mock) disparado!\n\nLink:\n${res.data.url}\n\nVeja no terminal do backend pra ver o conteúdo da mensagem.`
    )
  } catch (e: any) {
    alert(e?.data?.error || 'Erro ao enviar')
  } finally {
    sendingWa.value = null
  }
}

const docStatusLabel = (s: string) =>
  ({
    draft: 'Rascunho',
    awaiting_signature: 'Aguardando assinatura',
    signed: 'Assinado',
    delivered: 'Entregue',
    cancelled: 'Cancelado',
  } as any)[s] || s

const docStatusColor = (s: string) =>
  ({
    draft: 'bg-slate-100 text-slate-700',
    awaiting_signature: 'bg-amber-50 text-amber-700',
    signed: 'bg-emerald-50 text-emerald-700',
    delivered: 'bg-blue-50 text-blue-700',
    cancelled: 'bg-slate-50 text-slate-400',
  } as any)[s] || 'bg-slate-100'

// ---- Prescription form state ----
const prescriptionItems = ref<PrescriptionItem[]>([emptyPrescriptionItem()])
function emptyPrescriptionItem(): PrescriptionItem {
  return { name: '', dose: '', frequency: '', duration: '', route: 'Oral', notes: '', controlled: false }
}

// ---- Exam form state ----
const examItems = ref<ExamItem[]>([{ name: '', notes: '' }])

// ---- Certificate form state ----
const certificate = reactive({
  reason: '',
  daysOff: 1,
  cid: '',
  notes: '',
})

// --- Load appointment + record + documents ---
async function loadAll() {
  loading.value = true
  error.value = null
  try {
    const apptRes = await api.get<{ data: Appointment }>(
      `/api/appointments/${appointmentId.value}`
    )
    appointment.value = apptRes.data
    startedAt.value = new Date()

    // Existing record (if any)
    const recordsRes = await recordsApi.listByAppointment(appointmentId.value)
    if (recordsRes.data.length > 0) {
      record.value = recordsRes.data[0]
      soap.subjective = record.value.subjective ?? ''
      soap.objective = record.value.objective ?? ''
      soap.assessment = record.value.assessment ?? ''
      soap.plan = record.value.plan ?? ''
      soap.notes = record.value.notes ?? ''
      Object.assign(vitals, record.value.vitals ?? {})
      recordSaved.value = true
    }

    // Existing documents
    const docsRes = await docsApi.listByAppointment(appointmentId.value)
    documents.value = docsRes.data
  } catch (e: any) {
    error.value = e?.message || 'Erro ao carregar consulta'
  } finally {
    loading.value = false
  }
}

onMounted(loadAll)

// Timer
let timerInterval: any = null
onMounted(() => {
  timerInterval = setInterval(() => {
    if (!startedAt.value) return
    const ms = Date.now() - startedAt.value.getTime()
    const min = Math.floor(ms / 60000)
    const sec = Math.floor((ms % 60000) / 1000)
    elapsedTime.value = `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  }, 1000)
})
onBeforeUnmount(() => timerInterval && clearInterval(timerInterval))

// --- Save record ---
async function saveRecord() {
  if (!appointment.value) return
  saving.value = true
  error.value = null
  try {
    const res = await recordsApi.upsert({
      patientId: appointment.value.patientId,
      appointmentId: appointment.value.id,
      subjective: soap.subjective || null,
      objective: soap.objective || null,
      assessment: soap.assessment || null,
      plan: soap.plan || null,
      notes: soap.notes || null,
      vitals: hasAnyVital() ? cleanVitals() : null,
    })
    record.value = res.data
    recordSaved.value = true
    setTimeout(() => (recordSaved.value = true), 100)
  } catch (e: any) {
    error.value = e?.data?.errors?.[0]?.message || e?.message || 'Erro ao salvar prontuário'
  } finally {
    saving.value = false
  }
}

function hasAnyVital() {
  return Object.values(vitals).some((v) => v !== '' && v !== undefined && v !== null)
}
function cleanVitals(): Vitals {
  const c: Vitals = {}
  if (vitals.bp) c.bp = vitals.bp
  if (vitals.hr !== undefined && vitals.hr !== null) c.hr = Number(vitals.hr)
  if (vitals.rr !== undefined && vitals.rr !== null) c.rr = Number(vitals.rr)
  if (vitals.temp !== undefined && vitals.temp !== null) c.temp = Number(vitals.temp)
  if (vitals.spo2 !== undefined && vitals.spo2 !== null) c.spo2 = Number(vitals.spo2)
  if (vitals.weight !== undefined && vitals.weight !== null) c.weight = Number(vitals.weight)
  if (vitals.height !== undefined && vitals.height !== null) c.height = Number(vitals.height)
  return c
}

// --- Auto-save record on field blur (debounced) ---
let saveTimer: any = null
watch([soap, vitals], () => {
  if (loading.value) return
  recordSaved.value = false
  clearTimeout(saveTimer)
  saveTimer = setTimeout(saveRecord, 1500)
}, { deep: true })

// --- Document emission ---
async function emitPrescription() {
  if (!appointment.value) return
  const valid = prescriptionItems.value.filter((i) => i.name.trim())
  if (valid.length === 0) {
    error.value = 'Adicione pelo menos um medicamento'
    return
  }
  saving.value = true
  error.value = null
  try {
    const res = await docsApi.create({
      type: 'prescription',
      patientId: appointment.value.patientId,
      appointmentId: appointment.value.id,
      medicalRecordId: record.value?.id ?? null,
      payload: { items: valid },
    })
    documents.value.unshift(res.data)
    prescriptionItems.value = [emptyPrescriptionItem()]
  } catch (e: any) {
    error.value = e?.data?.errors?.[0]?.message || e?.message || 'Erro ao emitir receita'
  } finally {
    saving.value = false
  }
}

async function emitExam() {
  if (!appointment.value) return
  const valid = examItems.value.filter((i) => i.name.trim())
  if (valid.length === 0) {
    error.value = 'Adicione pelo menos um exame'
    return
  }
  saving.value = true
  error.value = null
  try {
    const res = await docsApi.create({
      type: 'exam_request',
      patientId: appointment.value.patientId,
      appointmentId: appointment.value.id,
      medicalRecordId: record.value?.id ?? null,
      payload: { items: valid },
    })
    documents.value.unshift(res.data)
    examItems.value = [{ name: '', notes: '' }]
  } catch (e: any) {
    error.value = e?.data?.errors?.[0]?.message || e?.message || 'Erro ao emitir pedido de exame'
  } finally {
    saving.value = false
  }
}

async function emitCertificate() {
  if (!appointment.value) return
  if (!certificate.reason.trim()) {
    error.value = 'Informe o motivo do atestado'
    return
  }
  saving.value = true
  error.value = null
  try {
    const res = await docsApi.create({
      type: 'medical_certificate',
      patientId: appointment.value.patientId,
      appointmentId: appointment.value.id,
      medicalRecordId: record.value?.id ?? null,
      payload: {
        reason: certificate.reason,
        daysOff: Number(certificate.daysOff),
        cid: certificate.cid || null,
        notes: certificate.notes || null,
      },
    })
    documents.value.unshift(res.data)
    certificate.reason = ''
    certificate.daysOff = 1
    certificate.cid = ''
    certificate.notes = ''
  } catch (e: any) {
    error.value = e?.data?.errors?.[0]?.message || e?.message || 'Erro ao emitir atestado'
  } finally {
    saving.value = false
  }
}

async function cancelDocument(doc: Document) {
  if (!confirm(`Cancelar esse documento?`)) return
  try {
    await docsApi.cancel(doc.id)
    documents.value = documents.value.filter((d) => d.id !== doc.id)
  } catch (e: any) {
    alert(e?.message || 'Erro ao cancelar')
  }
}

// --- Finish consultation ---
async function finish() {
  if (!appointment.value) return
  if (!recordSaved.value) await saveRecord()
  if (!confirm('Finalizar essa consulta? O status muda pra "Realizada".')) return
  saving.value = true
  try {
    await apptsApi.update(appointment.value.id, { status: 'completed' })
    await navigateTo('/agenda')
  } catch (e: any) {
    error.value = e?.message || 'Erro ao finalizar'
    saving.value = false
  }
}

// --- Helpers de view ---
const docTypeLabel = (t: string) =>
  ({
    prescription: 'Receita',
    exam_request: 'Pedido de exame',
    medical_certificate: 'Atestado',
  } as any)[t] || t

const docTypeIcon = (t: string) => {
  switch (t) {
    case 'prescription':
      return 'M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z'
    case 'exam_request':
      return 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z'
    default:
      return 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4'
  }
}

function addPrescriptionItem() {
  prescriptionItems.value.push(emptyPrescriptionItem())
}
function removePrescriptionItem(idx: number) {
  prescriptionItems.value.splice(idx, 1)
  if (prescriptionItems.value.length === 0) prescriptionItems.value.push(emptyPrescriptionItem())
}
function addExamItem() {
  examItems.value.push({ name: '', notes: '' })
}
function removeExamItem(idx: number) {
  examItems.value.splice(idx, 1)
  if (examItems.value.length === 0) examItems.value.push({ name: '', notes: '' })
}

const tabs = [
  { id: 'prontuario', label: 'Prontuário' },
  { id: 'prescription', label: 'Receita' },
  { id: 'exam_request', label: 'Exame' },
  { id: 'medical_certificate', label: 'Atestado' },
] as const

definePageMeta({ layout: false })
</script>

<template>
  <div v-if="loading" class="p-12 text-center text-slate-500">Carregando consulta…</div>
  <div v-else-if="error || !appointment" class="p-12 text-center">
    <p class="text-red-600 font-medium">{{ error || 'Consulta não encontrada' }}</p>
    <NuxtLink to="/agenda" class="mt-3 inline-block text-bula-600 hover:underline text-sm">
      ← Voltar pra agenda
    </NuxtLink>
  </div>

  <div v-else class="flex flex-col h-screen">
    <!-- Top bar -->
    <header class="bg-white border-b border-slate-200 px-6 py-3 flex items-center gap-4 shrink-0">
      <NuxtLink
        to="/agenda"
        class="p-2 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100"
      >
        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
        </svg>
      </NuxtLink>

      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2">
          <h1 class="text-base font-semibold text-slate-900 truncate">
            Consulta · {{ appointment.patient?.fullName }}
          </h1>
          <span class="badge bg-bula-50 text-bula-700 ring-1 ring-bula-200">
            <span class="w-1.5 h-1.5 rounded-full bg-bula-500 animate-pulse" />
            Em andamento · {{ elapsedTime }}
          </span>
        </div>
        <p class="text-xs text-slate-500">
          {{ formatDateTimeBR(appointment.scheduledAt) }} ·
          {{ appointment.doctor?.fullName }}
          <span v-if="appointment.reason"> · {{ appointment.reason }}</span>
        </p>
      </div>

      <div class="flex items-center gap-2">
        <span
          v-if="recordSaved"
          class="text-xs text-emerald-600 flex items-center gap-1"
        >
          <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
          </svg>
          Salvo
        </span>
        <span v-else-if="saving" class="text-xs text-slate-500">Salvando…</span>
        <button @click="finish" class="btn-primary" :disabled="saving">
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
          </svg>
          Finalizar consulta
        </button>
      </div>
    </header>

    <div class="flex-1 grid grid-cols-[320px_1fr] overflow-hidden">
      <!-- Sidebar: paciente + sinais vitais + histórico -->
      <aside class="bg-white border-r border-slate-200 overflow-y-auto p-5 space-y-5">
        <!-- Paciente -->
        <div>
          <div class="flex items-center gap-3">
            <div
              class="w-12 h-12 rounded-full bg-bula-500 text-white font-bold text-base
                     flex items-center justify-center shrink-0"
            >
              {{ initials(appointment.patient?.fullName) }}
            </div>
            <div class="flex-1 min-w-0">
              <NuxtLink
                :to="`/pacientes/${appointment.patientId}`"
                class="font-semibold text-slate-900 hover:text-bula-600 block truncate"
              >
                {{ appointment.patient?.fullName }}
              </NuxtLink>
              <p class="text-xs text-slate-500">
                <span v-if="ageFromBirthDate(appointment.patient?.birthDate || null)">
                  {{ ageFromBirthDate(appointment.patient?.birthDate || null) }} anos
                </span>
                <span v-if="appointment.patient?.gender">
                  · {{ appointment.patient?.gender === 'M' ? 'M' : appointment.patient?.gender === 'F' ? 'F' : 'O' }}
                </span>
              </p>
            </div>
          </div>
        </div>

        <!-- Sinais vitais -->
        <div>
          <h3 class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
            Sinais vitais
          </h3>
          <div class="space-y-2">
            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="text-[10px] text-slate-500 font-medium uppercase">PA (mmHg)</label>
                <input v-model="vitals.bp" type="text" placeholder="120/80" class="input !py-1.5 !text-xs" />
              </div>
              <div>
                <label class="text-[10px] text-slate-500 font-medium uppercase">FC (bpm)</label>
                <input v-model.number="vitals.hr" type="number" placeholder="72" class="input !py-1.5 !text-xs" />
              </div>
              <div>
                <label class="text-[10px] text-slate-500 font-medium uppercase">FR (irpm)</label>
                <input v-model.number="vitals.rr" type="number" placeholder="16" class="input !py-1.5 !text-xs" />
              </div>
              <div>
                <label class="text-[10px] text-slate-500 font-medium uppercase">Temp (°C)</label>
                <input v-model.number="vitals.temp" type="number" step="0.1" placeholder="36.5" class="input !py-1.5 !text-xs" />
              </div>
              <div>
                <label class="text-[10px] text-slate-500 font-medium uppercase">SpO₂ (%)</label>
                <input v-model.number="vitals.spo2" type="number" placeholder="98" class="input !py-1.5 !text-xs" />
              </div>
              <div>
                <label class="text-[10px] text-slate-500 font-medium uppercase">Peso (kg)</label>
                <input v-model.number="vitals.weight" type="number" step="0.1" placeholder="70" class="input !py-1.5 !text-xs" />
              </div>
            </div>
          </div>
        </div>

        <!-- Documentos emitidos -->
        <div v-if="documents.length">
          <div class="flex items-center justify-between mb-2">
            <h3 class="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Documentos ({{ documents.length }})
            </h3>
            <button
              v-if="documents.some((d) => d.status === 'awaiting_signature')"
              @click="openSignature(documents.filter((d) => d.status === 'awaiting_signature').map((d) => d.id))"
              class="text-[10px] font-semibold text-bula-600 hover:text-bula-700 uppercase"
            >
              Assinar todos
            </button>
          </div>
          <div class="space-y-2">
            <div
              v-for="doc in documents"
              :key="doc.id"
              class="p-2.5 bg-slate-50 rounded-lg border border-slate-100"
            >
              <div class="flex items-center gap-2 mb-1.5">
                <svg class="w-3.5 h-3.5 text-bula-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" :d="docTypeIcon(doc.type)" />
                </svg>
                <span class="flex-1 text-xs font-semibold text-slate-700 truncate">
                  {{ docTypeLabel(doc.type) }}
                </span>
                <span class="badge text-[9px] !px-1.5 !py-0" :class="docStatusColor(doc.status)">
                  {{ docStatusLabel(doc.status) }}
                </span>
              </div>
              <div class="flex items-center gap-1">
                <button
                  @click="openPdf(doc)"
                  type="button"
                  class="flex-1 text-center text-[10px] font-medium text-slate-700
                         bg-white border border-slate-200 rounded px-2 py-1
                         hover:bg-slate-50"
                >
                  PDF
                </button>
                <button
                  v-if="doc.status === 'awaiting_signature'"
                  @click="openSignature([doc.id])"
                  class="flex-1 text-[10px] font-semibold text-white bg-bula-500
                         rounded px-2 py-1 hover:bg-bula-600"
                  :disabled="sendingWa === doc.id"
                >
                  Assinar
                </button>
                <button
                  v-if="doc.status === 'signed' || doc.status === 'delivered'"
                  @click="sendWhatsApp(doc)"
                  :disabled="sendingWa === doc.id"
                  class="flex-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50
                         rounded px-2 py-1 hover:bg-emerald-100 disabled:opacity-50"
                  title="Enviar via WhatsApp"
                >
                  {{ sendingWa === doc.id ? '...' : 'WhatsApp' }}
                </button>
                <button
                  @click="cancelDocument(doc)"
                  class="text-slate-400 hover:text-red-600 px-1"
                  title="Cancelar"
                >
                  <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Histórico (placeholder) -->
        <div>
          <h3 class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
            Últimas consultas
          </h3>
          <p class="text-xs text-slate-400">
            Histórico aparece aqui no Drop 4.
          </p>
        </div>
      </aside>

      <!-- Main content -->
      <main class="overflow-y-auto p-6">
        <!-- Tabs -->
        <div class="flex gap-1 border-b border-slate-200 mb-6">
          <button
            v-for="tab in tabs"
            :key="tab.id"
            @click="activeTab = tab.id"
            class="px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition"
            :class="
              activeTab === tab.id
                ? 'border-bula-500 text-bula-600'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            "
          >
            {{ tab.label }}
          </button>
        </div>

        <Transition name="fade" mode="out-in">
          <div :key="activeTab">
            <!-- Prontuário SOAP -->
            <div v-if="activeTab === 'prontuario'" class="space-y-4 max-w-3xl">
              <div>
                <label class="label">
                  <span class="font-bold text-bula-600">S</span>ubjetivo
                  <span class="text-slate-400 font-normal">— queixas, sintomas relatados</span>
                </label>
                <textarea v-model="soap.subjective" rows="3" class="input resize-none" placeholder="Paciente refere…" />
              </div>
              <div>
                <label class="label">
                  <span class="font-bold text-bula-600">O</span>bjetivo
                  <span class="text-slate-400 font-normal">— exame físico, sinais clínicos</span>
                </label>
                <textarea v-model="soap.objective" rows="3" class="input resize-none" placeholder="Ao exame: bom estado geral, …" />
              </div>
              <div>
                <label class="label">
                  <span class="font-bold text-bula-600">A</span>valiação
                  <span class="text-slate-400 font-normal">— hipótese diagnóstica</span>
                </label>
                <textarea v-model="soap.assessment" rows="2" class="input resize-none" placeholder="Hipótese: …" />
              </div>
              <div>
                <label class="label">
                  <span class="font-bold text-bula-600">P</span>lano
                  <span class="text-slate-400 font-normal">— conduta, tratamento, retorno</span>
                </label>
                <textarea v-model="soap.plan" rows="3" class="input resize-none" placeholder="Solicitar exames, prescrever…" />
              </div>
              <div>
                <label class="label">Observações livres</label>
                <textarea v-model="soap.notes" rows="2" class="input resize-none" placeholder="Notas adicionais" />
              </div>
              <p class="text-xs text-slate-400">
                Salva automaticamente após 1.5s sem digitar.
              </p>
            </div>

            <!-- Receita -->
            <div v-else-if="activeTab === 'prescription'" class="space-y-4 max-w-3xl">
              <p class="text-sm text-slate-600">
                Adicione os medicamentos e clique em <strong>Emitir receita</strong>. Cada
                emissão gera um PDF independente.
              </p>

              <div
                v-for="(item, idx) in prescriptionItems"
                :key="idx"
                class="card p-4 space-y-3"
              >
                <div class="flex items-center justify-between">
                  <span class="text-xs font-semibold text-slate-500 uppercase">
                    Medicamento {{ idx + 1 }}
                  </span>
                  <button
                    v-if="prescriptionItems.length > 1"
                    @click="removePrescriptionItem(idx)"
                    class="text-slate-400 hover:text-red-600"
                  >
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <input v-model="item.name" type="text" placeholder="Nome do medicamento" class="input" />
                <div class="grid grid-cols-2 gap-3">
                  <input v-model="item.dose" type="text" placeholder="Dosagem (500mg, 1g…)" class="input" />
                  <input v-model="item.route" type="text" placeholder="Via (Oral, IV, IM…)" class="input" />
                </div>
                <div class="grid grid-cols-2 gap-3">
                  <input v-model="item.frequency" type="text" placeholder="Posologia (a cada 8h…)" class="input" />
                  <input v-model="item.duration" type="text" placeholder="Duração (5 dias, contínuo…)" class="input" />
                </div>
                <textarea v-model="item.notes" rows="2" placeholder="Observações" class="input resize-none" />
                <label class="flex items-center gap-2 text-sm">
                  <input v-model="item.controlled" type="checkbox" class="rounded text-bula-500" />
                  <span class="text-slate-700">Medicamento controlado</span>
                </label>
              </div>

              <div class="flex gap-2">
                <button @click="addPrescriptionItem" type="button" class="btn-secondary">
                  + Adicionar medicamento
                </button>
                <button @click="emitPrescription" type="button" class="btn-primary" :disabled="saving">
                  {{ saving ? 'Emitindo…' : 'Emitir receita' }}
                </button>
              </div>
            </div>

            <!-- Exame -->
            <div v-else-if="activeTab === 'exam_request'" class="space-y-4 max-w-3xl">
              <p class="text-sm text-slate-600">
                Liste os exames a solicitar e clique em <strong>Emitir pedido</strong>.
              </p>

              <div
                v-for="(item, idx) in examItems"
                :key="idx"
                class="card p-4 space-y-3"
              >
                <div class="flex items-center justify-between">
                  <span class="text-xs font-semibold text-slate-500 uppercase">
                    Exame {{ idx + 1 }}
                  </span>
                  <button
                    v-if="examItems.length > 1"
                    @click="removeExamItem(idx)"
                    class="text-slate-400 hover:text-red-600"
                  >
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <input v-model="item.name" type="text" placeholder="Nome do exame (Hemograma completo, TSH…)" class="input" />
                <textarea v-model="item.notes" rows="2" placeholder="Observações / instruções" class="input resize-none" />
              </div>

              <div class="flex gap-2">
                <button @click="addExamItem" type="button" class="btn-secondary">
                  + Adicionar exame
                </button>
                <button @click="emitExam" type="button" class="btn-primary" :disabled="saving">
                  {{ saving ? 'Emitindo…' : 'Emitir pedido' }}
                </button>
              </div>
            </div>

            <!-- Atestado -->
            <div v-else-if="activeTab === 'medical_certificate'" class="space-y-4 max-w-2xl">
              <p class="text-sm text-slate-600">
                Preencha os dados do atestado e clique em <strong>Emitir atestado</strong>.
              </p>

              <div class="card p-5 space-y-4">
                <div>
                  <label class="label">Motivo *</label>
                  <input v-model="certificate.reason" type="text" placeholder="Ex: tratamento de gripe / acompanhamento médico" class="input" />
                </div>
                <div class="grid grid-cols-2 gap-3">
                  <div>
                    <label class="label">Dias de afastamento *</label>
                    <input v-model.number="certificate.daysOff" type="number" min="0" max="365" class="input" />
                  </div>
                  <div>
                    <label class="label">CID (opcional)</label>
                    <input v-model="certificate.cid" type="text" placeholder="J11" class="input" />
                  </div>
                </div>
                <div>
                  <label class="label">Observações</label>
                  <textarea v-model="certificate.notes" rows="2" placeholder="Notas adicionais" class="input resize-none" />
                </div>
              </div>

              <button @click="emitCertificate" type="button" class="btn-primary" :disabled="saving">
                {{ saving ? 'Emitindo…' : 'Emitir atestado' }}
              </button>
            </div>
          </div>
        </Transition>

        <Transition name="fade">
          <div
            v-if="error"
            class="mt-6 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700"
          >
            {{ error }}
            <button @click="error = null" class="ml-2 underline">fechar</button>
          </div>
        </Transition>
      </main>
    </div>

    <SignatureModal
      :open="sigModalOpen"
      :document-ids="sigDocumentIds"
      :default-provider="appointment?.doctor?.signatureProvider ?? 'vidaas'"
      @close="sigModalOpen = false"
      @signed="onSigned"
    />
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 200ms ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
