<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'
import { useReports, type FinancialReport } from '~/composables/useReports'
import { useDoctors, type Doctor } from '~/composables/useAppointments'

definePageMeta({ layout: 'default' })

const auth = useAuthStore()
const reportsApi = useReports()
const { fetchDoctors } = useDoctors()

const report = ref<FinancialReport | null>(null)
const loading = ref(true)
const error = ref('')
const doctors = ref<Doctor[]>([])

type Preset = 'today' | 'week' | 'month' | 'last_month' | 'custom'
const preset = ref<Preset>('month')
const customFrom = ref('')
const customTo = ref('')
const selectedDoctorId = ref<number | null>(null)

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10)
}

function presetRange(p: Preset): { from: string; to: string } {
  const now = new Date()
  if (p === 'today') {
    const t = isoDate(now)
    return { from: `${t}T00:00:00.000Z`, to: `${t}T23:59:59.999Z` }
  }
  if (p === 'week') {
    const day = now.getDay() // 0 dom .. 6 sab
    const diffToMon = (day + 6) % 7
    const monday = new Date(now)
    monday.setDate(now.getDate() - diffToMon)
    const sunday = new Date(monday)
    sunday.setDate(monday.getDate() + 6)
    return {
      from: `${isoDate(monday)}T00:00:00.000Z`,
      to: `${isoDate(sunday)}T23:59:59.999Z`,
    }
  }
  if (p === 'month') {
    const first = new Date(now.getFullYear(), now.getMonth(), 1)
    const last = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    return {
      from: `${isoDate(first)}T00:00:00.000Z`,
      to: `${isoDate(last)}T23:59:59.999Z`,
    }
  }
  if (p === 'last_month') {
    const first = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const last = new Date(now.getFullYear(), now.getMonth(), 0)
    return {
      from: `${isoDate(first)}T00:00:00.000Z`,
      to: `${isoDate(last)}T23:59:59.999Z`,
    }
  }
  // custom
  return {
    from: customFrom.value
      ? `${customFrom.value}T00:00:00.000Z`
      : `${isoDate(now)}T00:00:00.000Z`,
    to: customTo.value
      ? `${customTo.value}T23:59:59.999Z`
      : `${isoDate(now)}T23:59:59.999Z`,
  }
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const range = presetRange(preset.value)
    const params: any = { from: range.from, to: range.to }
    if (selectedDoctorId.value && auth.isAdmin) {
      params.doctorId = selectedDoctorId.value
    }
    report.value = await reportsApi.financial(params)
  } catch (e: any) {
    error.value = e?.data?.error || 'Erro ao carregar relatório'
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  if (auth.isAdmin) {
    try {
      doctors.value = await fetchDoctors()
    } catch (e) {
      /* ignore */
    }
  }
  await load()
})

watch([preset, selectedDoctorId], () => load())
function applyCustom() {
  preset.value = 'custom'
  load()
}

const fmtBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const deltaPct = computed(() => {
  if (!report.value) return null
  const prev = report.value.previousPeriod.totalRevenue
  const cur = report.value.summary.totalRevenue
  if (prev === 0) return cur > 0 ? 100 : 0
  return ((cur - prev) / prev) * 100
})

const methodLabels: Record<string, string> = {
  cash: 'Dinheiro',
  pix_manual: 'PIX',
  card_manual: 'Cartão',
  deposit: 'Depósito',
  unknown: 'Outro',
}
const methodColors: Record<string, string> = {
  cash: 'bg-emerald-500',
  pix_manual: 'bg-cyan-500',
  card_manual: 'bg-indigo-500',
  deposit: 'bg-amber-500',
  unknown: 'bg-slate-400',
}

const totalByMethodSum = computed(() => {
  if (!report.value) return 0
  return report.value.byMethod.reduce((s, m) => s + m.total, 0)
})

// Eixo X do gráfico de dia: monta lista contínua de dias do range
const dailyBars = computed(() => {
  if (!report.value || report.value.byDay.length === 0) return []
  const map = new Map(report.value.byDay.map((d) => [d.date, d.total]))
  const start = new Date(report.value.range.from)
  const end = new Date(report.value.range.to)
  const bars: { date: string; label: string; total: number }[] = []
  const d = new Date(start)
  while (d <= end && bars.length < 60) {
    const iso = isoDate(d)
    bars.push({
      date: iso,
      label: String(d.getDate()).padStart(2, '0'),
      total: map.get(iso) ?? 0,
    })
    d.setDate(d.getDate() + 1)
  }
  return bars
})

const maxDayTotal = computed(() =>
  dailyBars.value.reduce((m, b) => Math.max(m, b.total), 0)
)

const fmtDate = (iso: string) => {
  const d = new Date(iso)
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  })
}
const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })

const statusBadge = (s: string) => {
  if (s === 'paid')
    return { label: 'Pago', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
  if (s === 'pending')
    return { label: 'Pendente', cls: 'bg-amber-50 text-amber-700 border-amber-200' }
  if (s === 'refunded')
    return { label: 'Estornado', cls: 'bg-red-50 text-red-700 border-red-200' }
  return { label: '—', cls: 'bg-slate-50 text-slate-600 border-slate-200' }
}
</script>

<template>
  <div class="p-8">
    <div class="max-w-7xl mx-auto">
      <!-- Header -->
      <div class="mb-6">
        <h1 class="text-2xl font-bold text-slate-900">Financeiro</h1>
        <p class="text-sm text-slate-500 mt-0.5">
          Visão geral do faturamento e pagamentos.
        </p>
      </div>

      <!-- Filtros -->
      <div class="mb-6 flex flex-wrap items-end gap-3">
        <div class="flex bg-white rounded-lg border border-slate-200 p-1 shadow-sm">
          <button
            v-for="p in [
              { v: 'today' as Preset, l: 'Hoje' },
              { v: 'week' as Preset, l: 'Semana' },
              { v: 'month' as Preset, l: 'Mês atual' },
              { v: 'last_month' as Preset, l: 'Mês passado' },
            ]"
            :key="p.v"
            @click="preset = p.v"
            class="px-3 py-1.5 text-xs font-medium rounded-md transition"
            :class="
              preset === p.v
                ? 'bg-bula-500 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-50'
            "
          >
            {{ p.l }}
          </button>
        </div>

        <div class="flex items-end gap-2 bg-white rounded-lg border border-slate-200 px-2 py-1.5 shadow-sm">
          <div>
            <label class="block text-[10px] uppercase font-semibold text-slate-500 mb-0.5">
              De
            </label>
            <input
              v-model="customFrom"
              type="date"
              class="text-xs border-0 px-1 py-0.5 focus:outline-none focus:ring-0"
            />
          </div>
          <div>
            <label class="block text-[10px] uppercase font-semibold text-slate-500 mb-0.5">
              Até
            </label>
            <input
              v-model="customTo"
              type="date"
              class="text-xs border-0 px-1 py-0.5 focus:outline-none focus:ring-0"
            />
          </div>
          <button
            @click="applyCustom"
            :disabled="!customFrom || !customTo"
            class="px-2 py-1 text-xs font-medium bg-slate-100 hover:bg-slate-200 rounded disabled:opacity-40"
          >
            OK
          </button>
        </div>

        <select
          v-if="auth.isAdmin && doctors.length > 1"
          v-model.number="selectedDoctorId"
          class="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-bula-200"
        >
          <option :value="null">Todos os médicos</option>
          <option v-for="d in doctors" :key="d.id" :value="d.id">
            {{ d.fullName }}
          </option>
        </select>

        <div class="ml-auto text-xs text-slate-500">
          <template v-if="report">
            {{ fmtDate(report.range.from) }} → {{ fmtDate(report.range.to) }}
          </template>
        </div>
      </div>

      <div
        v-if="error"
        class="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm"
      >
        {{ error }}
      </div>

      <!-- Loading -->
      <div v-if="loading" class="py-20 text-center text-slate-500 text-sm">
        Carregando relatório…
      </div>

      <template v-else-if="report">
        <!-- Cards -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div class="bg-white rounded-xl border border-slate-200 p-5">
            <div class="text-xs uppercase tracking-wide text-slate-500 font-semibold">
              Faturamento
            </div>
            <div class="mt-2 text-2xl font-bold text-slate-900">
              {{ fmtBRL(report.summary.totalRevenue) }}
            </div>
            <div
              v-if="deltaPct !== null"
              class="mt-1 text-xs flex items-center gap-1"
              :class="deltaPct >= 0 ? 'text-emerald-600' : 'text-red-600'"
            >
              <span v-if="deltaPct >= 0">▲</span>
              <span v-else>▼</span>
              {{ Math.abs(deltaPct).toFixed(1) }}% vs período anterior
            </div>
          </div>

          <div class="bg-white rounded-xl border border-slate-200 p-5">
            <div class="text-xs uppercase tracking-wide text-slate-500 font-semibold">
              Recebido em mãos
            </div>
            <div class="mt-2 text-2xl font-bold text-slate-900">
              {{ fmtBRL(report.summary.totalCopay) }}
            </div>
            <div class="mt-1 text-xs text-slate-500">
              Soma do suplemento de convênio + particular
            </div>
          </div>

          <div class="bg-white rounded-xl border border-slate-200 p-5">
            <div class="text-xs uppercase tracking-wide text-slate-500 font-semibold">
              Consultas pagas
            </div>
            <div class="mt-2 text-2xl font-bold text-slate-900">
              {{ report.summary.paidCount }}
            </div>
            <div class="mt-1 text-xs text-slate-500">
              {{ report.summary.completedCount }} realizadas no total
            </div>
          </div>

          <div class="bg-white rounded-xl border border-slate-200 p-5">
            <div class="text-xs uppercase tracking-wide text-slate-500 font-semibold">
              Pendentes / Faltas
            </div>
            <div class="mt-2 text-2xl font-bold text-slate-900">
              {{ report.summary.pendingCount + report.summary.noShowCount }}
            </div>
            <div class="mt-1 text-xs text-slate-500">
              {{ report.summary.pendingCount }} pendentes ·
              {{ report.summary.noShowCount }} faltas
            </div>
          </div>
        </div>

        <!-- Gráficos lado a lado -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          <!-- Quebra por método -->
          <div class="bg-white rounded-xl border border-slate-200 p-5">
            <h2 class="text-sm font-semibold text-slate-900 mb-4">
              Recebimento por método
            </h2>
            <div
              v-if="report.byMethod.length === 0"
              class="text-sm text-slate-400 italic py-8 text-center"
            >
              Sem pagamentos no período
            </div>
            <div v-else class="space-y-3">
              <div v-for="m in report.byMethod" :key="m.method">
                <div class="flex items-center justify-between text-xs mb-1">
                  <span class="font-medium text-slate-700">
                    {{ methodLabels[m.method] || m.method }}
                  </span>
                  <span class="text-slate-500">
                    {{ m.count }} × · {{ fmtBRL(m.total) }}
                  </span>
                </div>
                <div class="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    class="h-full rounded-full transition-all"
                    :class="methodColors[m.method] || 'bg-slate-400'"
                    :style="{
                      width:
                        totalByMethodSum > 0
                          ? `${(m.total / totalByMethodSum) * 100}%`
                          : '0%',
                    }"
                  />
                </div>
              </div>
            </div>
          </div>

          <!-- Por dia -->
          <div class="bg-white rounded-xl border border-slate-200 p-5">
            <h2 class="text-sm font-semibold text-slate-900 mb-4">
              Receita por dia
            </h2>
            <div
              v-if="dailyBars.length === 0"
              class="text-sm text-slate-400 italic py-8 text-center"
            >
              Sem dados
            </div>
            <div v-else>
              <div class="h-40 flex items-end gap-0.5 px-1">
                <div
                  v-for="b in dailyBars"
                  :key="b.date"
                  class="flex-1 group relative cursor-default"
                >
                  <div
                    class="w-full rounded-t transition-all"
                    :class="
                      b.total > 0
                        ? 'bg-bula-500 group-hover:bg-bula-600'
                        : 'bg-slate-100'
                    "
                    :style="{
                      height: `${
                        maxDayTotal > 0
                          ? Math.max((b.total / maxDayTotal) * 100, b.total > 0 ? 4 : 1)
                          : 1
                      }%`,
                      minHeight: '2px',
                    }"
                    :title="`${b.date}: ${fmtBRL(b.total)}`"
                  />
                </div>
              </div>
              <div
                v-if="dailyBars.length <= 31"
                class="flex justify-between text-[10px] text-slate-400 mt-2 px-1"
              >
                <span>{{ dailyBars[0]?.label }}</span>
                <span v-if="dailyBars.length > 6">
                  {{ dailyBars[Math.floor(dailyBars.length / 2)]?.label }}
                </span>
                <span>{{ dailyBars[dailyBars.length - 1]?.label }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Tabela de pagamentos -->
        <div class="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div class="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
            <h2 class="text-sm font-semibold text-slate-900">
              Pagamentos do período
            </h2>
            <span class="text-xs text-slate-500">
              {{ report.payments.length }} consulta(s)
            </span>
          </div>
          <div
            v-if="report.payments.length === 0"
            class="p-12 text-center text-sm text-slate-400 italic"
          >
            Nenhuma consulta no período
          </div>
          <div v-else class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead class="bg-slate-50 border-b border-slate-200">
                <tr class="text-left text-slate-500 text-[11px] uppercase tracking-wide">
                  <th class="px-4 py-2.5 font-semibold">Data</th>
                  <th class="px-4 py-2.5 font-semibold">Paciente</th>
                  <th class="px-4 py-2.5 font-semibold">Tipo</th>
                  <th class="px-4 py-2.5 font-semibold">Valor</th>
                  <th class="px-4 py-2.5 font-semibold">Em mãos</th>
                  <th class="px-4 py-2.5 font-semibold">Método</th>
                  <th class="px-4 py-2.5 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                <tr
                  v-for="p in report.payments"
                  :key="p.id"
                  class="hover:bg-slate-50"
                >
                  <td class="px-4 py-2.5 text-slate-700 whitespace-nowrap">
                    {{ fmtDate(p.scheduledAt) }}
                    <span class="text-slate-400">{{ fmtTime(p.scheduledAt) }}</span>
                  </td>
                  <td class="px-4 py-2.5 text-slate-900 font-medium">
                    {{ p.patient?.fullName ?? '—' }}
                  </td>
                  <td class="px-4 py-2.5 text-slate-600">
                    {{ p.insurance?.name ?? 'Particular' }}
                  </td>
                  <td class="px-4 py-2.5 text-slate-900 whitespace-nowrap">
                    {{ p.price != null ? fmtBRL(Number(p.price)) : '—' }}
                  </td>
                  <td class="px-4 py-2.5 text-slate-700 whitespace-nowrap">
                    {{
                      p.copayAmount != null
                        ? fmtBRL(Number(p.copayAmount))
                        : '—'
                    }}
                  </td>
                  <td class="px-4 py-2.5 text-slate-600">
                    {{
                      p.paymentMethod
                        ? methodLabels[p.paymentMethod] ?? p.paymentMethod
                        : '—'
                    }}
                  </td>
                  <td class="px-4 py-2.5">
                    <span
                      class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border"
                      :class="statusBadge(p.paymentStatus).cls"
                    >
                      {{ statusBadge(p.paymentStatus).label }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>
