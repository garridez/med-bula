<script setup lang="ts">
import { usePatients, type Patient, type PatientDiagnosis } from '~/composables/usePatients'
import { useAppointments } from '~/composables/useAppointments'
import { useDocuments } from '~/composables/useDocuments'
import { useAuthStore } from '~/stores/auth'

definePageMeta({ layout: 'default' })

const route = useRoute()
const auth = useAuthStore()
const patientsApi = usePatients()
const apptsApi = useAppointments()
const docsApi = useDocuments()

interface AppointmentLite {
  id: number
  scheduledAt: string
  status: string
  doctorId: number
}
interface DocLite {
  id: string
  type: string
  status: string
  appointmentId: number | null
  createdAt: string
}

const patient = ref<Patient | null>(null)
const appointments = ref<AppointmentLite[]>([])
const allDocs = ref<DocLite[]>([])
const loading = ref(true)
const error = ref('')

const activeTab = ref<'resumo' | 'timeline' | 'documentos' | 'emitir'>('resumo')

const canSeeClinical = computed(
  () => auth.isDoctor || auth.isAdmin || auth.isSuperAdmin
)
const canEditClinical = computed(
  () => auth.isDoctor || auth.isAdmin || auth.isSuperAdmin
)
const canIssueDoc = computed(() => auth.isDoctor)

const patientId = computed(() => Number(route.params.id))

async function load() {
  loading.value = true
  error.value = ''
  try {
    const pRes = await patientsApi.get(patientId.value)
    patient.value = pRes.data
    // Carregamentos opcionais (não bloqueiam render se falhar)
    try {
      const aRes: any = await apptsApi.list({ patientId: patientId.value })
      appointments.value = aRes.data ?? []
    } catch (e) {
      console.warn('Falha ao carregar consultas:', e)
    }
    try {
      const dRes: any = await docsApi.listByPatient(patientId.value)
      allDocs.value = dRes.data ?? []
    } catch (e) {
      console.warn('Falha ao carregar documentos:', e)
    }
  } catch (e: any) {
    error.value = e?.data?.error || e?.message || 'Erro ao carregar paciente'
    console.error('Erro Patient360:', e)
  } finally {
    loading.value = false
  }
}

onMounted(load)

// KPIs
const totalAppointments = computed(() => appointments.value.length)

const nextAppointment = computed(() => {
  const now = Date.now()
  return appointments.value
    .filter((a) => new Date(a.scheduledAt).getTime() > now && a.status !== 'cancelled')
    .sort(
      (a, b) =>
        new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
    )[0]
})

const lastAppointment = computed(() => {
  const now = Date.now()
  return appointments.value
    .filter(
      (a) => new Date(a.scheduledAt).getTime() <= now && a.status === 'completed'
    )
    .sort(
      (a, b) =>
        new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime()
    )[0]
})

function daysFromNow(iso: string): number {
  return Math.round((new Date(iso).getTime() - Date.now()) / 86400000)
}

const docCounts = computed(() => {
  const c = { prescription: 0, exam_request: 0, medical_certificate: 0 }
  for (const d of allDocs.value) {
    if (d.type in c) (c as any)[d.type]++
  }
  return c
})

const totalDocs = computed(
  () =>
    docCounts.value.prescription +
    docCounts.value.exam_request +
    docCounts.value.medical_certificate
)

// Save callbacks (one per field — fixa ref pra evitar gambis no template)
async function saveClinicalHistory(v: string | null) {
  return savePatientField('clinicalHistory' as any, v)
}
async function saveSurgicalHistory(v: string | null) {
  return savePatientField('surgicalHistory' as any, v)
}
async function saveFamilyHistory(v: string | null) {
  return savePatientField('familyHistory' as any, v)
}
async function saveHabits(v: string | null) {
  return savePatientField('habits' as any, v)
}
async function saveAllergies(v: string | null) {
  return savePatientField('allergies' as any, v)
}
async function saveMedicationsInUse(v: string | null) {
  return savePatientField('medicationsInUse' as any, v)
}
async function savePatientField(field: string, value: any) {
  if (!patient.value) return
  await patientsApi.update(patient.value.id, { [field]: value } as any)
  ;(patient.value as any)[field] = value
}

async function saveDiagnoses(next: PatientDiagnosis[]) {
  await savePatientField('diagnoses', next)
}

function onDocCreated(doc: any) {
  allDocs.value.unshift(doc)
}

// ---------- Iniciar / Marcar consulta ----------
const showApptModal = ref(false)
const starting = ref(false)

const canBookAppointment = computed(
  () => auth.isDoctor || auth.isSecretary || auth.isAdmin
)
const canStartConsultation = computed(() => auth.isDoctor)

async function iniciarConsulta() {
  if (!patient.value || !auth.user) return
  starting.value = true
  error.value = ''
  try {
    const res = await apptsApi.create({
      doctorId: auth.user.id, // é o médico logado
      patientId: patient.value.id,
      insuranceId: null,
      scheduledAt: new Date().toISOString(),
      durationMinutes: 30,
      status: 'in_progress',
      reason: 'Atendimento iniciado direto do paciente',
    })
    await navigateTo(`/consulta/${res.data.id}`)
  } catch (e: any) {
    error.value =
      e?.data?.error ||
      e?.data?.errors?.[0]?.message ||
      'Erro ao iniciar consulta'
  } finally {
    starting.value = false
  }
}

function marcarConsulta() {
  showApptModal.value = true
}

function onAppointmentSaved(newAppt: any) {
  appointments.value.unshift(newAppt)
  showApptModal.value = false
}

// Filtros documentos
const docTypeFilter = ref('all')
const docContextFilter = ref('all')
const filteredDocs = computed(() => {
  return allDocs.value.filter((d) => {
    if (docTypeFilter.value !== 'all' && d.type !== docTypeFilter.value)
      return false
    if (docContextFilter.value === 'appointment' && !d.appointmentId)
      return false
    if (docContextFilter.value === 'standalone' && d.appointmentId)
      return false
    return true
  })
})

const docTypeLabels: Record<string, string> = {
  prescription: 'Receita',
  exam_request: 'Pedido de exame',
  medical_certificate: 'Atestado',
}
const docStatusLabels: Record<string, string> = {
  draft: 'Rascunho',
  awaiting_signature: 'Aguardando assinatura',
  signed: 'Assinado',
  delivered: 'Entregue',
  cancelled: 'Cancelado',
  failed: 'Falhou',
}
const docStatusClasses: Record<string, string> = {
  signed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  delivered: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  awaiting_signature: 'bg-amber-50 text-amber-700 border-amber-200',
  draft: 'bg-slate-100 text-slate-600 border-slate-200',
  cancelled: 'bg-slate-100 text-slate-500 border-slate-200',
  failed: 'bg-red-50 text-red-700 border-red-200',
}

async function openDoc(doc: DocLite) {
  try {
    await docsApi.openPdf(doc.id)
  } catch (e: any) {
    error.value = e?.message || 'Erro ao abrir PDF'
  }
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  })
}

function ageOf(iso: string | null): number | null {
  if (!iso) return null
  const d = new Date(iso)
  if (isNaN(d.getTime())) return null
  const diff = Date.now() - d.getTime()
  return Math.floor(diff / (365.25 * 86400000))
}

function initialsOf(name: string | null | undefined): string {
  if (!name) return '??'
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '??'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

// Lista das tabs (computed pra deixar reativa ao role)
const tabs = computed(() => {
  const base = [
    { key: 'resumo' as const, label: 'Resumo' },
    { key: 'timeline' as const, label: 'Timeline' },
    { key: 'documentos' as const, label: 'Documentos' },
  ]
  if (canIssueDoc.value) {
    base.push({ key: 'emitir' as const, label: 'Emitir documento' })
  }
  return base
})
</script>

<template>
  <div class="p-8">
    <div class="max-w-7xl mx-auto">
      <NuxtLink to="/pacientes" class="text-xs text-slate-500 hover:text-slate-700">
        ← Pacientes
      </NuxtLink>

      <div v-if="loading" class="py-20 text-center text-slate-500">
        Carregando paciente…
      </div>
      <div
        v-else-if="error"
        class="mt-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm"
      >
        {{ error }}
      </div>

      <template v-else-if="patient">
        <!-- Header -->
        <div
          class="mt-3 bg-white rounded-xl border border-slate-200 p-6 flex items-start gap-5"
        >
          <div
            class="w-16 h-16 rounded-full bg-bula-50 text-bula-700 flex items-center justify-center text-xl font-bold flex-shrink-0"
          >
            {{ initialsOf(patient.fullName) }}
          </div>
          <div class="flex-1 min-w-0">
            <h1 class="text-2xl font-bold text-slate-900">
              {{ patient.fullName }}
            </h1>
            <div
              class="mt-1 text-sm text-slate-500 flex flex-wrap items-center gap-x-3 gap-y-1"
            >
              <span v-if="patient.birthDate">
                {{ ageOf(patient.birthDate) }} anos
              </span>
              <span v-if="patient.gender">· {{ patient.gender }}</span>
              <span v-if="patient.cpf">· CPF {{ patient.cpf }}</span>
            </div>
            <div
              class="mt-2 text-xs text-slate-500 flex flex-wrap items-center gap-x-3 gap-y-1"
            >
              <span v-if="patient.phone">📞 {{ patient.phone }}</span>
              <span v-if="patient.email">✉ {{ patient.email }}</span>
              <span v-if="patient.address || patient.city">
                📍
                {{
                  [patient.address, patient.city, patient.state]
                    .filter(Boolean)
                    .join(' - ')
                }}
              </span>
            </div>
          </div>

          <!-- Ações: iniciar / marcar consulta -->
          <div class="flex flex-col gap-2 flex-shrink-0">
            <button
              v-if="canStartConsultation"
              type="button"
              @click="iniciarConsulta"
              :disabled="starting"
              class="px-4 py-2 bg-bula-500 hover:bg-bula-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50 flex items-center gap-2"
            >
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M14 5l7 7m0 0l-7 7m7-7H3"
                />
              </svg>
              {{ starting ? 'Iniciando…' : 'Iniciar consulta agora' }}
            </button>
            <button
              v-if="canBookAppointment"
              type="button"
              @click="marcarConsulta"
              class="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-sm font-medium flex items-center gap-2"
            >
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              Marcar consulta
            </button>
          </div>
        </div>

        <!-- KPIs -->
        <div class="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div class="bg-white rounded-xl border border-slate-200 p-4">
            <div
              class="text-[10px] uppercase tracking-wide text-slate-500 font-semibold"
            >
              Consultas
            </div>
            <div class="mt-1 text-2xl font-bold text-slate-900">
              {{ totalAppointments }}
            </div>
            <div class="mt-0.5 text-[11px] text-slate-500">
              Total no histórico
            </div>
          </div>

          <div class="bg-white rounded-xl border border-slate-200 p-4">
            <div
              class="text-[10px] uppercase tracking-wide text-slate-500 font-semibold"
            >
              Próxima consulta
            </div>
            <div
              v-if="nextAppointment"
              class="mt-1 text-base font-semibold text-slate-900"
            >
              em {{ daysFromNow(nextAppointment.scheduledAt) }} dia(s)
            </div>
            <div v-else class="mt-1 text-base font-semibold text-slate-400">
              —
            </div>
            <div
              v-if="nextAppointment"
              class="mt-0.5 text-[11px] text-slate-500"
            >
              {{ fmtDate(nextAppointment.scheduledAt) }}
            </div>
          </div>

          <div class="bg-white rounded-xl border border-slate-200 p-4">
            <div
              class="text-[10px] uppercase tracking-wide text-slate-500 font-semibold"
            >
              Última consulta
            </div>
            <div
              v-if="lastAppointment"
              class="mt-1 text-base font-semibold text-slate-900"
            >
              há {{ Math.abs(daysFromNow(lastAppointment.scheduledAt)) }} dia(s)
            </div>
            <div v-else class="mt-1 text-base font-semibold text-slate-400">
              —
            </div>
            <div
              v-if="lastAppointment"
              class="mt-0.5 text-[11px] text-slate-500"
            >
              {{ fmtDate(lastAppointment.scheduledAt) }}
            </div>
          </div>

          <div class="bg-white rounded-xl border border-slate-200 p-4">
            <div
              class="text-[10px] uppercase tracking-wide text-slate-500 font-semibold"
            >
              Documentos
            </div>
            <div class="mt-1 text-2xl font-bold text-slate-900">
              {{ totalDocs }}
            </div>
            <div class="mt-0.5 text-[11px] text-slate-500">
              {{ docCounts.prescription }} rec ·
              {{ docCounts.exam_request }} ex ·
              {{ docCounts.medical_certificate }} at
            </div>
          </div>
        </div>

        <!-- Tabs -->
        <div class="mt-6 flex gap-1 border-b border-slate-200">
          <button
            v-for="t in tabs"
            :key="t.key"
            type="button"
            @click="activeTab = t.key"
            class="px-3 py-2 text-sm transition border-b-2 -mb-px"
            :class="
              activeTab === t.key
                ? 'border-bula-500 text-bula-700 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            "
          >
            {{ t.label }}
          </button>
        </div>

        <!-- Resumo -->
        <div v-if="activeTab === 'resumo'" class="mt-5 space-y-4">
          <template v-if="canSeeClinical">
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              <PatientEditableNote
                label="Antec. clínicos"
                :model-value="patient.clinicalHistory"
                :can-edit="canEditClinical"
                :on-save="saveClinicalHistory"
              />
              <PatientEditableNote
                label="Antec. cirúrgicos"
                :model-value="patient.surgicalHistory"
                :can-edit="canEditClinical"
                :on-save="saveSurgicalHistory"
              />
              <PatientEditableNote
                label="Antec. familiares"
                :model-value="patient.familyHistory"
                :can-edit="canEditClinical"
                :on-save="saveFamilyHistory"
              />
              <PatientEditableNote
                label="Hábitos"
                :model-value="patient.habits"
                :can-edit="canEditClinical"
                :on-save="saveHabits"
              />
              <PatientEditableNote
                label="Alergias"
                :model-value="patient.allergies"
                :can-edit="canEditClinical"
                :on-save="saveAllergies"
              />
              <PatientEditableNote
                label="Medicamentos em uso"
                :model-value="patient.medicationsInUse"
                :can-edit="canEditClinical"
                :on-save="saveMedicationsInUse"
              />
            </div>

            <PatientDiagnosesCard
              :model-value="patient.diagnoses"
              :can-edit="canEditClinical"
              :on-save="saveDiagnoses"
            />
          </template>
          <p v-else class="text-sm text-slate-400 italic">
            Você não tem permissão pra ver os dados clínicos.
          </p>
        </div>

        <!-- Timeline -->
        <div v-else-if="activeTab === 'timeline'" class="mt-5">
          <PatientHistoryList
            v-if="canSeeClinical"
            :patient-id="patient.id"
            :limit="50"
          />
          <p v-else class="text-sm text-slate-400 italic">
            Histórico clínico restrito ao médico.
          </p>
        </div>

        <!-- Documentos -->
        <div v-else-if="activeTab === 'documentos'" class="mt-5 space-y-4">
          <div class="flex flex-wrap items-center gap-3">
            <select
              v-model="docTypeFilter"
              class="px-3 py-1.5 border border-slate-200 bg-white rounded-md text-xs"
            >
              <option value="all">Todos os tipos</option>
              <option value="prescription">Receita</option>
              <option value="exam_request">Pedido de exame</option>
              <option value="medical_certificate">Atestado</option>
            </select>
            <select
              v-model="docContextFilter"
              class="px-3 py-1.5 border border-slate-200 bg-white rounded-md text-xs"
            >
              <option value="all">Consultas + avulsos</option>
              <option value="appointment">Só de consultas</option>
              <option value="standalone">Só avulsos</option>
            </select>
          </div>

          <div
            v-if="filteredDocs.length === 0"
            class="bg-white border border-slate-200 rounded-xl p-12 text-center text-sm text-slate-400 italic"
          >
            Nenhum documento.
          </div>
          <div
            v-else
            class="bg-white rounded-xl border border-slate-200 overflow-hidden"
          >
            <table class="w-full text-sm">
              <thead class="bg-slate-50 border-b border-slate-200">
                <tr
                  class="text-left text-slate-500 text-[11px] uppercase tracking-wide"
                >
                  <th class="px-4 py-2.5 font-semibold">Data</th>
                  <th class="px-4 py-2.5 font-semibold">Tipo</th>
                  <th class="px-4 py-2.5 font-semibold">Origem</th>
                  <th class="px-4 py-2.5 font-semibold">Status</th>
                  <th class="px-4 py-2.5 font-semibold w-20"></th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                <tr
                  v-for="d in filteredDocs"
                  :key="d.id"
                  class="hover:bg-slate-50 cursor-pointer"
                  @click="openDoc(d)"
                >
                  <td class="px-4 py-3 text-slate-600 whitespace-nowrap">
                    {{ fmtDateTime(d.createdAt) }}
                  </td>
                  <td class="px-4 py-3 font-medium text-slate-900">
                    {{ docTypeLabels[d.type] ?? d.type }}
                  </td>
                  <td class="px-4 py-3 text-slate-500 text-xs">
                    {{
                      d.appointmentId
                        ? `Consulta #${d.appointmentId}`
                        : 'Avulso'
                    }}
                  </td>
                  <td class="px-4 py-3">
                    <span
                      class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border"
                      :class="
                        docStatusClasses[d.status] ?? docStatusClasses.draft
                      "
                    >
                      {{ docStatusLabels[d.status] ?? d.status }}
                    </span>
                  </td>
                  <td class="px-4 py-3 text-right">
                    <button
                      @click.stop="openDoc(d)"
                      class="text-xs text-bula-600 hover:text-bula-700 font-medium"
                    >
                      PDF
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Emitir documento avulso -->
        <div
          v-else-if="activeTab === 'emitir' && canIssueDoc"
          class="mt-5"
        >
          <PatientStandaloneDocEmitter
            :patient="patient"
            @created="onDocCreated"
          />
        </div>
      </template>
    </div>

    <!-- Modal de agendamento (Marcar consulta) -->
    <AppointmentModal
      v-if="patient"
      :open="showApptModal"
      :initial-patient="{ id: patient.id, fullName: patient.fullName }"
      @close="showApptModal = false"
      @saved="onAppointmentSaved"
    />
  </div>
</template>
