<script setup lang="ts">
import { useApi } from '~/composables/useApi'

type PaymentMethod = 'cash' | 'pix_manual' | 'card_manual' | 'deposit'
type PaymentStatus = 'none' | 'pending' | 'paid' | 'refunded'

const props = defineProps<{
  appointmentId: number
  initialStatus: PaymentStatus
  initialMethod: string | null
  /** Compacto pra usar em cards */
  compact?: boolean
}>()

const emit = defineEmits<{
  changed: [status: PaymentStatus, method: string | null]
}>()

const api = useApi()
const status = ref<PaymentStatus>(props.initialStatus)
const method = ref<string | null>(props.initialMethod)
const loading = ref(false)
const error = ref<string | null>(null)

watch(
  () => [props.initialStatus, props.initialMethod],
  ([s, m]) => {
    status.value = s as PaymentStatus
    method.value = m as string | null
  }
)

const methods: { id: PaymentMethod; label: string; icon: string }[] = [
  {
    id: 'cash',
    label: 'Dinheiro',
    icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  },
  {
    id: 'pix_manual',
    label: 'PIX',
    icon: 'M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z',
  },
  {
    id: 'card_manual',
    label: 'Cartão',
    icon: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z',
  },
  {
    id: 'deposit',
    label: 'Depósito',
    icon: 'M19 14l-7 7m0 0l-7-7m7 7V3',
  },
]

const methodLabel = computed(() => methods.find((m) => m.id === method.value)?.label ?? '')

async function mark(m: PaymentMethod) {
  loading.value = true
  error.value = null
  try {
    const res = await api.post<{ data: any }>(
      `/api/appointments/${props.appointmentId}/payment`,
      { method: m, status: 'paid' }
    )
    status.value = res.data.paymentStatus
    method.value = res.data.paymentMethod
    emit('changed', status.value, method.value)
  } catch (e: any) {
    error.value = e?.data?.error || e?.message || 'Erro ao marcar pagamento'
  } finally {
    loading.value = false
  }
}

async function clear() {
  if (!confirm('Reverter pagamento?')) return
  loading.value = true
  error.value = null
  try {
    const res = await api.delete<{ data: any }>(
      `/api/appointments/${props.appointmentId}/payment`
    )
    status.value = res.data.paymentStatus
    method.value = res.data.paymentMethod
    emit('changed', status.value, method.value)
  } catch (e: any) {
    error.value = e?.message || 'Erro'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div :class="compact ? '' : 'space-y-3'">
    <!-- Estado: pago -->
    <div
      v-if="status === 'paid'"
      class="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200"
    >
      <svg class="w-4 h-4 text-emerald-600 shrink-0" fill="currentColor" viewBox="0 0 20 20">
        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
      </svg>
      <div class="flex-1">
        <span class="text-sm font-medium text-emerald-900">Pago</span>
        <span class="text-xs text-emerald-700 ml-1.5">via {{ methodLabel }}</span>
      </div>
      <button
        @click="clear"
        :disabled="loading"
        class="text-xs font-medium text-emerald-700 hover:text-emerald-900 underline"
      >
        Reverter
      </button>
    </div>

    <!-- Estado: não pago — mostra os 4 botões -->
    <div v-else>
      <div v-if="!compact" class="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">
        Marcar pagamento
      </div>
      <div class="grid grid-cols-2 gap-2">
        <button
          v-for="m in methods"
          :key="m.id"
          @click="mark(m.id)"
          :disabled="loading"
          type="button"
          class="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200
                 bg-white hover:bg-bula-50/50 hover:border-bula-300
                 text-sm font-medium text-slate-700 transition disabled:opacity-50"
        >
          <svg class="w-4 h-4 text-bula-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" :d="m.icon" />
          </svg>
          {{ m.label }}
        </button>
      </div>
    </div>

    <p v-if="error" class="text-xs text-red-600 mt-1">{{ error }}</p>
  </div>
</template>
