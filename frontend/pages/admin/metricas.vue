<script setup lang="ts">
import { useAdmin, type AdminMetrics } from '~/composables/useAdmin'

definePageMeta({ layout: 'default' })

const adminApi = useAdmin()
const metrics = ref<AdminMetrics | null>(null)
const loading = ref(true)
const error = ref('')

async function load() {
  loading.value = true
  error.value = ''
  try {
    metrics.value = await adminApi.metrics()
  } catch (e: any) {
    error.value = e?.data?.error || 'Erro ao carregar métricas'
  } finally {
    loading.value = false
  }
}
onMounted(load)

const fmtBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const newDelta = computed(() => {
  if (!metrics.value) return null
  const cur = metrics.value.newThisMonth
  const prev = metrics.value.newLastMonth
  if (prev === 0) return cur > 0 ? 100 : 0
  return ((cur - prev) / prev) * 100
})
</script>

<template>
  <div class="p-8">
    <div class="max-w-7xl mx-auto">
      <h1 class="text-2xl font-bold text-slate-900 mb-1">Métricas globais</h1>
      <p class="text-sm text-slate-500 mb-6">
        Visão da plataforma — todas as clínicas.
      </p>

      <div
        v-if="error"
        class="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm"
      >
        {{ error }}
      </div>

      <div v-if="loading" class="py-20 text-center text-slate-500 text-sm">
        Carregando…
      </div>

      <template v-else-if="metrics">
        <!-- KPIs principais -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div class="bg-white rounded-xl border border-slate-200 p-5">
            <div class="text-xs uppercase tracking-wide text-slate-500 font-semibold">
              Clínicas ativas
            </div>
            <div class="mt-2 text-2xl font-bold text-slate-900">
              {{ metrics.totalClinics }}
            </div>
            <div class="mt-1 text-xs text-slate-500">
              {{ metrics.byPlan.consultorio }} consultório ·
              {{ metrics.byPlan.clinica }} clínica
            </div>
          </div>

          <div class="bg-white rounded-xl border border-slate-200 p-5">
            <div class="text-xs uppercase tracking-wide text-slate-500 font-semibold">
              MRR (mensalidades)
            </div>
            <div class="mt-2 text-2xl font-bold text-slate-900">
              {{ fmtBRL(metrics.mrr) }}
            </div>
            <div class="mt-1 text-xs text-slate-500">
              Soma das mensalidades ativas
            </div>
          </div>

          <div class="bg-white rounded-xl border border-slate-200 p-5">
            <div class="text-xs uppercase tracking-wide text-slate-500 font-semibold">
              Novas este mês
            </div>
            <div class="mt-2 text-2xl font-bold text-slate-900">
              {{ metrics.newThisMonth }}
            </div>
            <div
              v-if="newDelta !== null"
              class="mt-1 text-xs flex items-center gap-1"
              :class="newDelta >= 0 ? 'text-emerald-600' : 'text-red-600'"
            >
              <span v-if="newDelta >= 0">▲</span>
              <span v-else>▼</span>
              {{ Math.abs(newDelta).toFixed(0) }}% vs mês passado
            </div>
          </div>

          <div class="bg-white rounded-xl border border-slate-200 p-5">
            <div class="text-xs uppercase tracking-wide text-slate-500 font-semibold">
              Cancelaram este mês
            </div>
            <div class="mt-2 text-2xl font-bold text-slate-900">
              {{ metrics.churnThisMonth }}
            </div>
            <div class="mt-1 text-xs text-slate-500">Churn bruto</div>
          </div>
        </div>

        <!-- Por status -->
        <div class="bg-white rounded-xl border border-slate-200 p-5">
          <h2 class="text-sm font-semibold text-slate-900 mb-4">
            Distribuição por status
          </h2>
          <div class="space-y-3">
            <div
              v-for="(label, key, idx) in {
                active: 'Ativas',
                trial: 'Em trial',
                past_due: 'Atrasadas',
                cancelled: 'Canceladas',
              }"
              :key="key"
            >
              <div class="flex justify-between text-xs mb-1">
                <span class="font-medium text-slate-700">{{ label }}</span>
                <span class="text-slate-500">
                  {{ metrics.byStatus[key as any] ?? 0 }}
                </span>
              </div>
              <div class="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  class="h-full rounded-full transition-all"
                  :class="
                    key === 'active'
                      ? 'bg-emerald-500'
                      : key === 'trial'
                      ? 'bg-cyan-500'
                      : key === 'past_due'
                      ? 'bg-amber-500'
                      : 'bg-red-500'
                  "
                  :style="{
                    width:
                      metrics.totalClinics > 0
                        ? `${
                            ((metrics.byStatus[key as any] ?? 0) /
                              metrics.totalClinics) *
                            100
                          }%`
                        : '0%',
                  }"
                />
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>
