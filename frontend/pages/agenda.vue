<script setup lang="ts">
import {
  useAppointments,
  useDoctors,
  type Appointment,
} from '~/composables/useAppointments'

const appointmentsApi = useAppointments()
const doctorsApi = useDoctors()

// Estado
const weekStart = ref(getMondayOfWeek(new Date()))
const appointments = ref<Appointment[]>([])
const doctors = ref<{ id: number; fullName: string }[]>([])
const filterDoctorId = ref<number | undefined>(undefined)
const loading = ref(false)

// Modal
const modalOpen = ref(false)
const editingAppointment = ref<Appointment | null>(null)
const initialSlot = ref<{ date: string; doctorId?: number } | null>(null)

function getMondayOfWeek(d: Date) {
  const date = new Date(d)
  const day = date.getDay() // 0 = sun, 1 = mon
  const diff = date.getDate() - day + (day === 0 ? -6 : 1)
  date.setDate(diff)
  date.setHours(0, 0, 0, 0)
  return date
}

const weekEnd = computed(() => {
  const d = new Date(weekStart.value)
  d.setDate(d.getDate() + 6)
  d.setHours(23, 59, 59, 999)
  return d
})

const weekLabel = computed(() => {
  const start = weekStart.value
  const end = weekEnd.value
  const fmt = (d: Date, opts: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat('pt-BR', opts).format(d)
  if (start.getMonth() === end.getMonth()) {
    return `${fmt(start, { day: '2-digit' })} – ${fmt(end, { day: '2-digit', month: 'long', year: 'numeric' })}`
  }
  return `${fmt(start, { day: '2-digit', month: 'short' })} – ${fmt(end, { day: '2-digit', month: 'short', year: 'numeric' })}`
})

async function load() {
  loading.value = true
  try {
    const res = await appointmentsApi.listInRange(
      weekStart.value.toISOString(),
      weekEnd.value.toISOString(),
      filterDoctorId.value
    )
    appointments.value = res.data
  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
}

async function loadDoctors() {
  try {
    const res = await doctorsApi.list()
    doctors.value = res.data
  } catch (e) {
    console.error(e)
  }
}

function previousWeek() {
  const d = new Date(weekStart.value)
  d.setDate(d.getDate() - 7)
  weekStart.value = d
}
function nextWeek() {
  const d = new Date(weekStart.value)
  d.setDate(d.getDate() + 7)
  weekStart.value = d
}
function goToday() {
  weekStart.value = getMondayOfWeek(new Date())
}

watch([weekStart, filterDoctorId], load, { immediate: false })

onMounted(async () => {
  await loadDoctors()
  await load()
})

function openCreate(slotIso?: string) {
  editingAppointment.value = null
  initialSlot.value = slotIso
    ? { date: slotIso, doctorId: filterDoctorId.value ?? doctors.value[0]?.id }
    : null
  modalOpen.value = true
}

function openEdit(appt: Appointment) {
  editingAppointment.value = appt
  initialSlot.value = null
  modalOpen.value = true
}

function onSaved(appt: Appointment) {
  modalOpen.value = false
  // recarrega lista pra refletir
  load()
}

function onCancelled(_id: number) {
  modalOpen.value = false
  load()
}

const todayCount = computed(() => {
  const today = new Date().toDateString()
  return appointments.value.filter(
    (a) => new Date(a.scheduledAt).toDateString() === today
  ).length
})
</script>

<template>
  <div class="p-6 max-w-[1400px] mx-auto animate-fade-in">
    <!-- Header -->
    <div class="flex flex-wrap items-center justify-between gap-4 mb-5">
      <div>
        <h1 class="text-2xl font-bold text-slate-900 tracking-tight">Agenda</h1>
        <p class="text-sm text-slate-500 mt-0.5 capitalize">
          {{ weekLabel }} · {{ appointments.length }} consultas ·
          {{ todayCount }} hoje
        </p>
      </div>

      <div class="flex items-center gap-2">
        <!-- Filtro de médico (multi-médico) -->
        <select
          v-if="doctors.length > 1"
          v-model.number="filterDoctorId"
          class="input !py-2 !w-auto min-w-[180px]"
        >
          <option :value="undefined">Todos os médicos</option>
          <option v-for="d in doctors" :key="d.id" :value="d.id">
            {{ d.fullName }}
          </option>
        </select>

        <!-- Navegação -->
        <div class="flex items-center bg-white border border-slate-200 rounded-lg">
          <button
            @click="previousWeek"
            class="p-2 hover:bg-slate-50 rounded-l-lg text-slate-600"
            title="Semana anterior"
          >
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
          <button
            @click="goToday"
            class="px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50
                   border-x border-slate-200"
          >
            Hoje
          </button>
          <button
            @click="nextWeek"
            class="p-2 hover:bg-slate-50 rounded-r-lg text-slate-600"
            title="Próxima semana"
          >
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>
        </div>

        <button @click="openCreate()" class="btn-primary">
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2.5"
              d="M12 4v16m8-8H4"
            />
          </svg>
          Nova consulta
        </button>
      </div>
    </div>

    <!-- Loading bar -->
    <div v-if="loading" class="mb-3 h-1 bg-bula-100 rounded overflow-hidden">
      <div class="h-full bg-bula-500 animate-pulse w-1/3" />
    </div>

    <WeekCalendar
      :appointments="appointments"
      :week-start="weekStart"
      @slot-click="openCreate"
      @appointment-click="openEdit"
    />

    <!-- Legenda -->
    <div class="mt-4 flex flex-wrap items-center gap-4 text-xs text-slate-500">
      <span class="flex items-center gap-1.5">
        <span class="w-2.5 h-2.5 rounded-sm bg-slate-300" /> Agendada
      </span>
      <span class="flex items-center gap-1.5">
        <span class="w-2.5 h-2.5 rounded-sm bg-emerald-400" /> Confirmada
      </span>
      <span class="flex items-center gap-1.5">
        <span class="w-2.5 h-2.5 rounded-sm bg-bula-500" /> Em curso
      </span>
      <span class="flex items-center gap-1.5">
        <span class="w-2.5 h-2.5 rounded-sm bg-blue-400" /> Realizada
      </span>
      <span class="flex items-center gap-1.5">
        <span class="w-2.5 h-2.5 rounded-sm bg-amber-400" /> Faltou
      </span>
    </div>

    <AppointmentModal
      :open="modalOpen"
      :appointment="editingAppointment"
      :initial-slot="initialSlot"
      @close="modalOpen = false"
      @saved="onSaved"
      @cancelled="onCancelled"
    />
  </div>
</template>
