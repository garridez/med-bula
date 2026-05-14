<script setup lang="ts">
import type { Appointment, AppointmentStatus } from '~/composables/useAppointments'

const props = defineProps<{
  appointments: Appointment[]
  /** Segunda-feira da semana exibida (00:00) */
  weekStart: Date
  /** Hora inicial do grid (default 7) */
  startHour?: number
  /** Hora final do grid (default 21) */
  endHour?: number
}>()

const emit = defineEmits<{
  /** Clicou num slot vazio — passa data ISO do horário clicado */
  slotClick: [iso: string]
  /** Clicou numa consulta existente */
  appointmentClick: [appointment: Appointment]
}>()

const startHour = computed(() => props.startHour ?? 7)
const endHour = computed(() => props.endHour ?? 21)
const PX_PER_HOUR = 64

const days = computed(() => {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(props.weekStart)
    d.setDate(d.getDate() + i)
    return d
  })
})

const hours = computed(() => {
  const arr: number[] = []
  for (let h = startHour.value; h <= endHour.value; h++) arr.push(h)
  return arr
})

const today = new Date()
function isToday(d: Date) {
  return (
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear()
  )
}

function dayLabel(d: Date) {
  return new Intl.DateTimeFormat('pt-BR', {
    weekday: 'short',
  }).format(d).replace('.', '')
}

function dayNumber(d: Date) {
  return d.getDate()
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getDate() === b.getDate() &&
    a.getMonth() === b.getMonth() &&
    a.getFullYear() === b.getFullYear()
  )
}

interface PositionedAppointment {
  appt: Appointment
  top: number
  height: number
  /** Coluna lateral (0..totalColumns-1) — usado pra dividir overlaps lado-a-lado */
  column: number
  /** Quantas colunas o cluster de sobreposição ocupa */
  totalColumns: number
}

/**
 * Coloca os appointments do dia em "lanes" laterais quando há sobreposição
 * de horário. Algoritmo greedy:
 *   1. Ordena por scheduledAt asc
 *   2. Agrupa em clusters contínuos de sobreposição
 *   3. Dentro do cluster, encaixa cada apt na primeira lane que já terminou
 *      antes do seu início; se nenhuma couber, abre lane nova
 *   4. totalColumns do cluster = número de lanes abertas
 */
function appointmentsForDay(day: Date): PositionedAppointment[] {
  type Item = PositionedAppointment & { start: number; end: number }

  const items: Item[] = props.appointments
    .filter((a) => isSameDay(new Date(a.scheduledAt), day))
    .map((a) => {
      const dt = new Date(a.scheduledAt)
      const minutes =
        (dt.getHours() - startHour.value) * 60 + dt.getMinutes()
      const top = (minutes / 60) * PX_PER_HOUR
      const height = (a.durationMinutes / 60) * PX_PER_HOUR
      const start = dt.getTime()
      const end = start + a.durationMinutes * 60000
      return {
        appt: a,
        top,
        height,
        start,
        end,
        column: 0,
        totalColumns: 1,
      }
    })
    .sort((a, b) => a.start - b.start)

  if (items.length === 0) return []

  let cluster: Item[] = []
  let clusterEnd = -Infinity
  let lanes: number[] = [] // ms do fim de cada lane ativa

  const flushCluster = () => {
    if (cluster.length === 0) return
    const total = lanes.length
    for (const c of cluster) c.totalColumns = total
  }

  for (const item of items) {
    if (item.start >= clusterEnd) {
      flushCluster()
      cluster = []
      lanes = []
      clusterEnd = item.end
    } else {
      clusterEnd = Math.max(clusterEnd, item.end)
    }

    // Encaixa numa lane que já terminou; se nenhuma, abre nova
    let placed = false
    for (let i = 0; i < lanes.length; i++) {
      if (item.start >= lanes[i]) {
        item.column = i
        lanes[i] = item.end
        placed = true
        break
      }
    }
    if (!placed) {
      item.column = lanes.length
      lanes.push(item.end)
    }
    cluster.push(item)
  }
  flushCluster()

  return items.map(({ appt, top, height, column, totalColumns }) => ({
    appt,
    top,
    height,
    column,
    totalColumns,
  }))
}

function statusStyle(s: AppointmentStatus) {
  switch (s) {
    case 'scheduled':
      return 'bg-slate-100 border-l-slate-400 text-slate-800'
    case 'confirmed':
      return 'bg-emerald-50 border-l-emerald-500 text-emerald-900'
    case 'in_progress':
      return 'bg-bula-50 border-l-bula-500 text-bula-900'
    case 'completed':
      return 'bg-blue-50 border-l-blue-500 text-blue-900'
    case 'cancelled':
      return 'bg-slate-50 border-l-slate-300 text-slate-400 line-through'
    case 'no_show':
      return 'bg-amber-50 border-l-amber-500 text-amber-900'
  }
}

function statusLabel(s: AppointmentStatus) {
  return (
    {
      scheduled: 'Agendada',
      confirmed: 'Confirmada',
      in_progress: 'Em curso',
      completed: 'Realizada',
      cancelled: 'Cancelada',
      no_show: 'Faltou',
    } as const
  )[s]
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function onSlotClick(day: Date, hour: number, half: 0 | 30) {
  const d = new Date(day)
  d.setHours(hour, half, 0, 0)
  emit('slotClick', d.toISOString())
}

const totalGridHeight = computed(
  () => (endHour.value - startHour.value + 1) * PX_PER_HOUR
)

// Linha "agora" — só aparece se hoje estiver na semana
const nowLineTop = computed(() => {
  const now = new Date()
  if (now.getHours() < startHour.value || now.getHours() > endHour.value)
    return null
  const minutes = (now.getHours() - startHour.value) * 60 + now.getMinutes()
  return (minutes / 60) * PX_PER_HOUR
})
</script>

<template>
  <div class="card overflow-hidden">
    <!-- Header com dias -->
    <div class="grid grid-cols-[60px_repeat(7,1fr)] border-b border-slate-100">
      <div></div>
      <div
        v-for="d in days"
        :key="d.toISOString()"
        class="px-2 py-3 text-center border-l border-slate-100"
        :class="isToday(d) ? 'bg-bula-50/50' : ''"
      >
        <div
          class="text-[11px] font-semibold uppercase tracking-wider"
          :class="isToday(d) ? 'text-bula-600' : 'text-slate-500'"
        >
          {{ dayLabel(d) }}
        </div>
        <div
          class="text-xl font-semibold mt-0.5"
          :class="isToday(d) ? 'text-bula-700' : 'text-slate-900'"
        >
          {{ dayNumber(d) }}
        </div>
      </div>
    </div>

    <!-- Grid -->
    <div class="grid grid-cols-[60px_repeat(7,1fr)] relative">
      <!-- Coluna de horas -->
      <div class="border-r border-slate-100">
        <div
          v-for="h in hours"
          :key="h"
          class="text-[11px] text-slate-400 font-medium pr-2 text-right"
          :style="{ height: `${PX_PER_HOUR}px` }"
        >
          <span class="-translate-y-2 inline-block">
            {{ String(h).padStart(2, '0') }}:00
          </span>
        </div>
      </div>

      <!-- Colunas dos dias -->
      <div
        v-for="(d, dayIdx) in days"
        :key="d.toISOString()"
        class="relative border-l border-slate-100"
        :class="isToday(d) ? 'bg-bula-50/30' : ''"
        :style="{ height: `${totalGridHeight}px` }"
      >
        <!-- Slots clicáveis (a cada 30min) -->
        <div
          v-for="h in hours"
          :key="`${dayIdx}-${h}`"
          class="absolute inset-x-0 border-b border-slate-100"
          :style="{
            top: `${(h - startHour) * PX_PER_HOUR}px`,
            height: `${PX_PER_HOUR}px`,
          }"
        >
          <button
            type="button"
            class="absolute inset-x-0 top-0 h-1/2 hover:bg-bula-50/60
                   transition-colors cursor-pointer"
            @click="onSlotClick(d, h, 0)"
            :title="`${String(h).padStart(2, '0')}:00`"
          />
          <button
            type="button"
            class="absolute inset-x-0 top-1/2 h-1/2 hover:bg-bula-50/60
                   border-t border-dashed border-slate-100/80 transition-colors cursor-pointer"
            @click="onSlotClick(d, h, 30)"
            :title="`${String(h).padStart(2, '0')}:30`"
          />
        </div>

        <!-- Linha do agora -->
        <div
          v-if="nowLineTop !== null && isToday(d)"
          class="absolute inset-x-0 z-10 pointer-events-none"
          :style="{ top: `${nowLineTop}px` }"
        >
          <div class="relative">
            <div class="absolute -left-1 -top-1 w-2 h-2 rounded-full bg-bula-500"></div>
            <div class="border-t-2 border-bula-500"></div>
          </div>
        </div>

        <!-- Cards das consultas -->
        <button
          v-for="pa in appointmentsForDay(d)"
          :key="pa.appt.id"
          type="button"
          @click="emit('appointmentClick', pa.appt)"
          class="absolute rounded-md text-left px-2 py-1
                 border-l-[3px] hover:shadow-soft transition-all overflow-hidden
                 cursor-pointer z-[5]"
          :class="statusStyle(pa.appt.status)"
          :style="{
            top: `${pa.top}px`,
            height: `${Math.max(pa.height, 28)}px`,
            minHeight: '28px',
            left: `calc(${(pa.column / pa.totalColumns) * 100}% + 2px)`,
            width: `calc(${100 / pa.totalColumns}% - 4px)`,
          }"
        >
          <div class="text-[10px] font-semibold leading-tight">
            {{ formatTime(pa.appt.scheduledAt) }}
          </div>
          <div class="text-xs font-medium truncate leading-tight">
            {{ pa.appt.patient?.fullName || '—' }}
          </div>
          <div
            v-if="pa.height >= 48"
            class="text-[10px] truncate opacity-75 leading-tight mt-0.5"
          >
            {{ pa.appt.reason || statusLabel(pa.appt.status) }}
          </div>
        </button>
      </div>
    </div>
  </div>
</template>
