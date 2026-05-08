<script setup lang="ts">
import { usePatients, type Patient } from '~/composables/usePatients'
import {
  maskCPF,
  maskPhone,
  ageFromBirthDate,
  formatDateBR,
  formatDateTimeBR,
  initials,
  formatBRL,
} from '~/utils/format'

const route = useRoute()
const patientsApi = usePatients()
const patient = ref<(Patient & { appointments?: any[] }) | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)

async function load() {
  loading.value = true
  error.value = null
  try {
    const res = await patientsApi.get(Number(route.params.id))
    patient.value = res.data
  } catch (e: any) {
    error.value = e?.message || 'Paciente não encontrado'
  } finally {
    loading.value = false
  }
}

onMounted(load)

const otpCode = computed(() => {
  if (!patient.value?.phone) return null
  const d = patient.value.phone.replace(/\D/g, '')
  return d.length >= 4 ? d.slice(-4) : null
})

const statusBadge = (s: string) => {
  switch (s) {
    case 'completed':
      return 'bg-blue-50 text-blue-700 ring-1 ring-blue-200'
    case 'confirmed':
      return 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
    case 'cancelled':
      return 'bg-slate-100 text-slate-500 ring-1 ring-slate-200'
    case 'no_show':
      return 'bg-amber-50 text-amber-700 ring-1 ring-amber-200'
    default:
      return 'bg-slate-100 text-slate-700 ring-1 ring-slate-200'
  }
}
const statusLabel = (s: string) =>
  ({
    scheduled: 'Agendada',
    confirmed: 'Confirmada',
    in_progress: 'Em curso',
    completed: 'Realizada',
    cancelled: 'Cancelada',
    no_show: 'Faltou',
  } as any)[s] || s
</script>

<template>
  <div class="p-6 max-w-5xl mx-auto animate-fade-in">
    <!-- Voltar -->
    <NuxtLink
      to="/pacientes"
      class="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 mb-4"
    >
      <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
      </svg>
      Pacientes
    </NuxtLink>

    <div v-if="loading" class="card p-12 text-center text-slate-500">
      Carregando…
    </div>
    <div v-else-if="error" class="card p-12 text-center text-red-600">
      {{ error }}
    </div>
    <div v-else-if="patient" class="space-y-6">
      <!-- Header card -->
      <div class="card p-6">
        <div class="flex items-start gap-5">
          <div
            class="w-16 h-16 rounded-full bg-bula-500 text-white font-bold
                   flex items-center justify-center text-xl shrink-0"
          >
            {{ initials(patient.fullName) }}
          </div>
          <div class="flex-1 min-w-0">
            <h1 class="text-2xl font-bold text-slate-900">{{ patient.fullName }}</h1>
            <div class="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">
              <span v-if="patient.cpf">CPF {{ maskCPF(patient.cpf) }}</span>
              <span v-if="ageFromBirthDate(patient.birthDate)">
                {{ ageFromBirthDate(patient.birthDate) }} anos
              </span>
              <span v-if="patient.gender">
                {{ patient.gender === 'M' ? 'Masculino' : patient.gender === 'F' ? 'Feminino' : 'Outro' }}
              </span>
              <span v-if="patient.phone">{{ maskPhone(patient.phone) }}</span>
            </div>
            <div
              v-if="otpCode"
              class="mt-2 inline-flex items-center gap-2 px-2.5 py-1 rounded-full
                     bg-bula-50 text-bula-700 text-xs font-medium"
            >
              <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              OTP do paciente: <span class="font-mono">{{ otpCode }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Stats / Dados -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div class="card p-4">
          <div class="text-xs text-slate-500 uppercase tracking-wider">Nascimento</div>
          <div class="text-base font-semibold mt-1">
            {{ formatDateBR(patient.birthDate) || '—' }}
          </div>
        </div>
        <div class="card p-4">
          <div class="text-xs text-slate-500 uppercase tracking-wider">Peso / Altura</div>
          <div class="text-base font-semibold mt-1">
            <span v-if="patient.weightKg">{{ patient.weightKg }} kg</span>
            <span v-if="patient.weightKg && patient.heightCm"> · </span>
            <span v-if="patient.heightCm">{{ patient.heightCm }} cm</span>
            <span v-if="!patient.weightKg && !patient.heightCm">—</span>
          </div>
        </div>
        <div class="card p-4">
          <div class="text-xs text-slate-500 uppercase tracking-wider">E-mail</div>
          <div class="text-sm font-medium mt-1 truncate">
            {{ patient.email || '—' }}
          </div>
        </div>
        <div class="card p-4">
          <div class="text-xs text-slate-500 uppercase tracking-wider">Cidade</div>
          <div class="text-sm font-medium mt-1">
            <span v-if="patient.city">{{ patient.city }}<span v-if="patient.state">/{{ patient.state }}</span></span>
            <span v-else>—</span>
          </div>
        </div>
      </div>

      <!-- Observações -->
      <div v-if="patient.notes" class="card p-5">
        <h2 class="text-sm font-semibold text-slate-900 mb-2">Observações</h2>
        <p class="text-sm text-slate-700 whitespace-pre-wrap">{{ patient.notes }}</p>
      </div>

      <!-- Histórico de consultas -->
      <div class="card overflow-hidden">
        <div class="px-6 py-4 border-b border-slate-100">
          <h2 class="text-base font-semibold text-slate-900">Histórico de consultas</h2>
          <p class="text-xs text-slate-500 mt-0.5">
            Últimas {{ patient.appointments?.length || 0 }} consultas
          </p>
        </div>
        <div v-if="!patient.appointments || patient.appointments.length === 0" class="p-12 text-center text-slate-500">
          <p class="text-sm">Nenhuma consulta registrada ainda.</p>
        </div>
        <div v-else class="divide-y divide-slate-100">
          <div
            v-for="appt in patient.appointments"
            :key="appt.id"
            class="px-6 py-4 hover:bg-slate-50/50 flex items-center gap-4"
          >
            <div class="w-32 shrink-0">
              <div class="text-sm font-semibold text-slate-900">
                {{ formatDateTimeBR(appt.scheduledAt) }}
              </div>
              <div class="text-[11px] text-slate-500 uppercase">
                {{ appt.durationMinutes }} min
              </div>
            </div>
            <div class="flex-1 min-w-0">
              <div class="font-medium text-slate-900 text-sm">
                {{ appt.reason || '(sem motivo)' }}
              </div>
              <div class="text-xs text-slate-500 truncate">
                {{ appt.doctor?.fullName || '—' }}
                <span v-if="appt.price"> · {{ formatBRL(appt.price) }}</span>
              </div>
            </div>
            <span class="badge" :class="statusBadge(appt.status)">
              {{ statusLabel(appt.status) }}
            </span>
          </div>
        </div>
      </div>

      <!-- Drop info -->
      <div
        class="p-4 rounded-xl bg-amber-50 border border-amber-200
               flex items-start gap-3 text-sm text-amber-900"
      >
        <svg class="w-5 h-5 mt-0.5 shrink-0 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div>
          <div class="font-medium mb-0.5">Drop 3 — prontuário e documentos</div>
          <div class="text-amber-800/90">
            No próximo drop entram aqui: prontuário (SOAP), emissão de receita,
            pedido de exame e atestado em PDF.
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
