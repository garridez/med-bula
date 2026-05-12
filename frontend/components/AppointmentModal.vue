<script setup lang="ts">
import {
  useAppointments,
  useDoctors,
  type Appointment,
  type AppointmentStatus,
} from '~/composables/useAppointments'
import { usePatients, type Patient } from '~/composables/usePatients'
import { useInsurances, type InsuranceForDoctor } from '~/composables/useInsurances'
import { useAuthStore } from '~/stores/auth'

const props = defineProps<{
  open: boolean
  appointment?: Appointment | null
  initialSlot?: { date: string; doctorId?: number } | null
}>()

const emit = defineEmits<{
  close: []
  saved: [appointment: Appointment]
  cancelled: [id: number]
}>()

const appointments = useAppointments()
const doctorsApi = useDoctors()
const patientsApi = usePatients()
const insurancesApi = useInsurances()
const auth = useAuthStore()

const isEdit = computed(() => !!props.appointment)
const loading = ref(false)
const error = ref<string | null>(null)
const doctors = ref<{ id: number; fullName: string; consultationPrice?: number | null }[]>([])
const patients = ref<Patient[]>([])
const patientQuery = ref('')
const showPatientDropdown = ref(false)
const insuranceOptions = ref<InsuranceForDoctor[]>([])

const form = reactive({
  doctorId: 0,
  patientId: 0,
  patientName: '',
  /** 0 = Particular; senão = id do convênio */
  insuranceId: 0,
  date: '',
  time: '',
  durationMinutes: 30,
  reason: '',
  notes: '',
  price: '' as string,
  copayAmount: '' as string,
  status: 'scheduled' as AppointmentStatus,
})

const isPaticular = computed(() => form.insuranceId === 0)

// Hydrate
watch(
  () => props.open,
  async (open) => {
    if (!open) return
    error.value = null
    await loadDoctors()

    if (props.appointment) {
      const a = props.appointment
      const dt = new Date(a.scheduledAt)
      form.doctorId = a.doctorId
      form.patientId = a.patientId
      form.patientName = a.patient?.fullName ?? ''
      form.insuranceId = a.insuranceId ?? 0
      form.date = dt.toISOString().slice(0, 10)
      form.time = dt.toTimeString().slice(0, 5)
      form.durationMinutes = a.durationMinutes
      form.reason = a.reason ?? ''
      form.notes = a.notes ?? ''
      form.price = a.price !== null ? String(a.price) : ''
      form.copayAmount = a.copayAmount !== null ? String(a.copayAmount) : ''
      form.status = a.status
    } else {
      form.doctorId = props.initialSlot?.doctorId ?? doctors.value[0]?.id ?? 0
      form.patientId = 0
      form.patientName = ''
      form.insuranceId = 0
      const slot = props.initialSlot?.date
        ? new Date(props.initialSlot.date)
        : new Date()
      form.date = slot.toISOString().slice(0, 10)
      form.time = slot.toTimeString().slice(0, 5)
      form.durationMinutes = 30
      form.reason = ''
      form.notes = ''
      form.price = ''
      form.copayAmount = ''
      form.status = 'scheduled'
    }
    await loadInsurancesForDoctor()
    if (!isEdit.value) autoFillPrice()
  }
)

// Quando troca o médico (não na edição inicial), recarrega convênios e refaz auto-fill
watch(
  () => form.doctorId,
  async (newId, oldId) => {
    if (!props.open) return
    if (oldId === undefined || newId === oldId) return
    await loadInsurancesForDoctor()
    // Se convênio atual não pertence ao novo médico, volta pra particular
    if (form.insuranceId !== 0) {
      const exists = insuranceOptions.value.some(
        (i) => i.insuranceId === form.insuranceId
      )
      if (!exists) form.insuranceId = 0
    }
    autoFillPrice()
  }
)

watch(
  () => form.insuranceId,
  () => {
    if (!props.open) return
    autoFillPrice()
  }
)

async function loadDoctors() {
  try {
    const res = await doctorsApi.list()
    doctors.value = res.data as any
  } catch (e) {
    console.error(e)
  }
}

async function loadInsurancesForDoctor() {
  if (!form.doctorId) {
    insuranceOptions.value = []
    return
  }
  try {
    const res = await insurancesApi.byDoctor(form.doctorId)
    insuranceOptions.value = res.data
  } catch (e) {
    console.error(e)
    insuranceOptions.value = []
  }
}

/**
 * Preenche price+copay automaticamente quando muda médico/convênio.
 * Sempre sobreescreve o que tinha no form, pois é UX esperado: trocar
 * o tipo deve refletir no valor.
 */
function autoFillPrice() {
  if (form.insuranceId === 0) {
    // Particular
    const doc = doctors.value.find((d) => d.id === form.doctorId) as any
    const defaultPrice = doc?.consultationPrice ?? null
    form.price = defaultPrice != null ? String(defaultPrice) : ''
    form.copayAmount = defaultPrice != null ? String(defaultPrice) : ''
  } else {
    const opt = insuranceOptions.value.find((i) => i.insuranceId === form.insuranceId)
    if (opt) {
      form.price = String(opt.price)
      form.copayAmount = '0'
    }
  }
}

let searchTimer: any = null
watch(patientQuery, (q) => {
  showPatientDropdown.value = !!q && q !== form.patientName
  if (!q) {
    patients.value = []
    return
  }
  clearTimeout(searchTimer)
  searchTimer = setTimeout(async () => {
    try {
      const res = await patientsApi.list(q)
      patients.value = res.data
    } catch (e) {
      console.error(e)
    }
  }, 200)
})

function pickPatient(p: Patient) {
  form.patientId = p.id
  form.patientName = p.fullName
  patientQuery.value = p.fullName
  showPatientDropdown.value = false
}

async function submit() {
  error.value = null
  if (!form.patientId) {
    error.value = 'Selecione um paciente'
    return
  }
  if (!form.doctorId) {
    error.value = 'Selecione um médico'
    return
  }
  if (!form.date || !form.time) {
    error.value = 'Informe data e horário'
    return
  }

  const scheduledAt = new Date(`${form.date}T${form.time}:00`).toISOString()
  const payload = {
    doctorId: form.doctorId,
    patientId: form.patientId,
    insuranceId: form.insuranceId === 0 ? null : form.insuranceId,
    scheduledAt,
    durationMinutes: form.durationMinutes,
    reason: form.reason || null,
    notes: form.notes || null,
    price: form.price !== '' ? Number(form.price) : null,
    copayAmount: form.copayAmount !== '' ? Number(form.copayAmount) : null,
    status: form.status,
  }

  loading.value = true
  try {
    let res
    if (isEdit.value && props.appointment) {
      res = await appointments.update(props.appointment.id, payload as any)
    } else {
      res = await appointments.create(payload as any)
    }
    emit('saved', res.data)
  } catch (e: any) {
    error.value =
      e?.data?.errors?.[0]?.message ||
      e?.data?.error ||
      e?.message ||
      'Erro ao salvar consulta'
  } finally {
    loading.value = false
  }
}

async function cancelAppointment() {
  if (!props.appointment) return
  if (!confirm('Cancelar essa consulta?')) return
  loading.value = true
  try {
    await appointments.cancel(props.appointment.id)
    emit('cancelled', props.appointment.id)
  } catch (e: any) {
    error.value = e?.message || 'Erro ao cancelar'
  } finally {
    loading.value = false
  }
}

async function startConsultation() {
  if (!props.appointment) return
  loading.value = true
  try {
    await appointments.update(props.appointment.id, { status: 'in_progress' })
    emit('close')
    await navigateTo(`/consulta/${props.appointment.id}`)
  } catch (e: any) {
    error.value = e?.message || 'Erro ao iniciar consulta'
    loading.value = false
  }
}

function openConsultation() {
  if (!props.appointment) return
  emit('close')
  navigateTo(`/consulta/${props.appointment.id}`)
}

const canStart = computed(() => {
  if (!props.appointment) return false
  if (!auth.canStartConsultation) return false
  return ['scheduled', 'confirmed'].includes(props.appointment.status)
})
const canContinue = computed(() => auth.canStartConsultation)
const isInProgress = computed(() => props.appointment?.status === 'in_progress')

const statusOptions: { value: AppointmentStatus; label: string }[] = [
  { value: 'scheduled', label: 'Agendada' },
  { value: 'confirmed', label: 'Confirmada' },
  { value: 'in_progress', label: 'Em andamento' },
  { value: 'completed', label: 'Realizada' },
  { value: 'no_show', label: 'Faltou' },
]
</script>

<template>
  <Modal
    :open="open"
    :title="isEdit ? 'Editar consulta' : 'Nova consulta'"
    size="lg"
    @close="emit('close')"
  >
    <form @submit.prevent="submit" class="p-6 space-y-5">
      <!-- Paciente -->
      <div class="relative">
        <label class="label">Paciente *</label>
        <input
          v-model="patientQuery"
          type="text"
          placeholder="Digite o nome ou CPF…"
          class="input"
          :disabled="loading || isEdit"
          @focus="showPatientDropdown = !!patientQuery"
        />
        <div
          v-if="showPatientDropdown && patients.length > 0"
          class="absolute z-10 mt-1 w-full bg-white border border-slate-200
                 rounded-lg shadow-soft-lg max-h-56 overflow-auto"
        >
          <button
            v-for="p in patients"
            :key="p.id"
            type="button"
            @click="pickPatient(p)"
            class="w-full text-left px-4 py-2.5 hover:bg-bula-50/50
                   border-b border-slate-50 last:border-0"
          >
            <div class="font-medium text-slate-900 text-sm">{{ p.fullName }}</div>
            <div class="text-xs text-slate-500">
              {{ p.cpf || 'sem CPF' }} · {{ p.phone || 'sem tel' }}
            </div>
          </button>
        </div>
        <p
          v-if="form.patientId"
          class="mt-1 text-xs text-emerald-700 flex items-center gap-1"
        >
          <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
            <path
              fill-rule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clip-rule="evenodd"
            />
          </svg>
          {{ form.patientName }} selecionado
        </p>
      </div>

      <!-- Médico -->
      <div>
        <label class="label">Médico *</label>
        <select v-model.number="form.doctorId" class="input" :disabled="loading">
          <option :value="0">—</option>
          <option v-for="d in doctors" :key="d.id" :value="d.id">
            {{ d.fullName }}
          </option>
        </select>
      </div>

      <!-- Data, hora, duração -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label class="label">Data *</label>
          <input v-model="form.date" type="date" class="input" :disabled="loading" />
        </div>
        <div>
          <label class="label">Horário *</label>
          <input v-model="form.time" type="time" class="input" :disabled="loading" />
        </div>
        <div>
          <label class="label">Duração</label>
          <select
            v-model.number="form.durationMinutes"
            class="input"
            :disabled="loading"
          >
            <option :value="15">15 min</option>
            <option :value="30">30 min</option>
            <option :value="45">45 min</option>
            <option :value="60">60 min</option>
            <option :value="90">90 min</option>
          </select>
        </div>
      </div>

      <!-- Tipo + Valor + Copay -->
      <div class="grid grid-cols-1 sm:grid-cols-12 gap-4">
        <div class="sm:col-span-6">
          <label class="label">Tipo de atendimento *</label>
          <select
            v-model.number="form.insuranceId"
            class="input"
            :disabled="loading"
          >
            <option :value="0">Particular</option>
            <option
              v-for="opt in insuranceOptions"
              :key="opt.insuranceId"
              :value="opt.insuranceId"
            >
              {{ opt.insuranceName }}
            </option>
          </select>
          <p
            v-if="!isPaticular && insuranceOptions.length === 0"
            class="mt-1 text-[11px] text-amber-700"
          >
            O médico ainda não tem convênios cadastrados.
          </p>
        </div>
        <div class="sm:col-span-3">
          <label class="label">Valor (R$)</label>
          <input
            v-model="form.price"
            type="number"
            step="0.01"
            min="0"
            placeholder="0,00"
            class="input"
            :disabled="loading"
          />
        </div>
        <div class="sm:col-span-3">
          <label class="label">
            {{ isPaticular ? 'Paciente paga' : 'Suplemento $' }}
          </label>
          <input
            v-model="form.copayAmount"
            type="number"
            step="0.01"
            min="0"
            placeholder="0,00"
            class="input"
            :disabled="loading"
          />
          <p v-if="!isPaticular" class="mt-1 text-[11px] text-slate-500">
            Valor que o paciente paga em mãos além do convênio.
          </p>
        </div>
      </div>

      <!-- Motivo -->
      <div>
        <label class="label">Motivo</label>
        <input
          v-model="form.reason"
          type="text"
          placeholder="Consulta de rotina, retorno…"
          class="input"
          :disabled="loading"
        />
      </div>

      <!-- Status (edição) -->
      <div v-if="isEdit">
        <label class="label">Status</label>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="s in statusOptions"
            :key="s.value"
            type="button"
            @click="form.status = s.value"
            class="px-3 py-1.5 text-xs font-medium rounded-full transition"
            :class="
              form.status === s.value
                ? 'bg-bula-500 text-white shadow-sm'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            "
          >
            {{ s.label }}
          </button>
        </div>
      </div>

      <!-- Pagamento manual (edição) -->
      <div v-if="isEdit && appointment">
        <PaymentButtons
          :appointment-id="appointment.id"
          :initial-status="appointment.paymentStatus"
          :initial-method="appointment.paymentMethod"
        />
      </div>

      <!-- Notas -->
      <div>
        <label class="label">Observações</label>
        <textarea
          v-model="form.notes"
          rows="2"
          placeholder="Anotações sobre essa consulta"
          class="input resize-none"
          :disabled="loading"
        />
      </div>

      <Transition name="fade">
        <div
          v-if="error"
          class="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700"
        >
          {{ error }}
        </div>
      </Transition>
    </form>

    <template #footer>
      <button
        v-if="isEdit"
        type="button"
        @click="cancelAppointment"
        class="btn-ghost text-red-600 hover:bg-red-50 hover:text-red-700"
        :disabled="loading"
      >
        Cancelar consulta
      </button>
      <div class="flex-1" />
      <button
        type="button"
        @click="emit('close')"
        class="btn-secondary"
        :disabled="loading"
      >
        Fechar
      </button>
      <button
        v-if="isEdit && isInProgress && canContinue"
        type="button"
        @click="openConsultation"
        class="btn-primary"
        :disabled="loading"
      >
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M9 5l7 7-7 7" />
        </svg>
        Continuar consulta
      </button>
      <button
        v-else-if="isEdit && canStart"
        type="button"
        @click="startConsultation"
        class="btn-primary"
        :disabled="loading"
      >
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        Iniciar consulta
      </button>
      <button
        type="button"
        @click="submit"
        class="btn-secondary"
        :class="{ 'btn-primary': !isEdit }"
        :disabled="loading"
      >
        {{ loading ? 'Salvando…' : isEdit ? 'Salvar alterações' : 'Agendar' }}
      </button>
    </template>
  </Modal>
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
