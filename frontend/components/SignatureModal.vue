<script setup lang="ts">
import {
  useSignature,
  type SignatureProviderMeta,
  type CreateSessionResult,
} from '~/composables/useSignature'

const props = defineProps<{
  open: boolean
  documentIds: string[]
  /** Pré-seleciona provider (vem do médico). */
  defaultProvider?: string | null
}>()

const emit = defineEmits<{
  close: []
  signed: [documentIds: string[]]
}>()

const sig = useSignature()

const providers = ref<SignatureProviderMeta[]>([])
const selectedProvider = ref<string>('')
const session = ref<CreateSessionResult | null>(null)
const status = ref<'idle' | 'pending' | 'authenticated' | 'signing' | 'signed' | 'failed' | 'expired'>('idle')
const error = ref<string | null>(null)
const loading = ref(false)
let pollInterval: any = null

watch(
  () => props.open,
  async (open) => {
    if (open) {
      await loadProviders()
      reset()
    } else {
      stopPolling()
    }
  }
)

async function loadProviders() {
  try {
    const res = await sig.providers()
    providers.value = res.data
    selectedProvider.value =
      props.defaultProvider && providers.value.find((p) => p.id === props.defaultProvider)
        ? props.defaultProvider
        : providers.value.find((p) => p.available)?.id ?? providers.value[0]?.id ?? ''
  } catch (e: any) {
    error.value = e?.message || 'Erro ao listar provedores'
  }
}

function reset() {
  session.value = null
  status.value = 'idle'
  error.value = null
}

async function startSession() {
  if (!selectedProvider.value) {
    error.value = 'Escolha um provedor de assinatura'
    return
  }
  loading.value = true
  error.value = null
  try {
    const res = await sig.createSession({
      provider: selectedProvider.value,
      documentIds: props.documentIds,
    })
    session.value = res.data
    status.value = 'pending'
    startPolling()
  } catch (e: any) {
    error.value = e?.data?.error || e?.message || 'Erro ao iniciar sessão'
  } finally {
    loading.value = false
  }
}

function startPolling() {
  stopPolling()
  pollInterval = setInterval(async () => {
    if (!session.value) return
    try {
      const res = await sig.getSession(session.value.sessionId)
      const s = res.data.status
      status.value = s
      if (res.data.error) error.value = res.data.error
      if (s === 'signed') {
        stopPolling()
        emit('signed', props.documentIds)
      } else if (s === 'failed' || s === 'expired') {
        stopPolling()
      }
    } catch (e: any) {
      console.error(e)
    }
  }, 2000)
}

function stopPolling() {
  if (pollInterval) clearInterval(pollInterval)
  pollInterval = null
}

onBeforeUnmount(stopPolling)

const statusLabel = computed(() => {
  switch (status.value) {
    case 'idle':
      return ''
    case 'pending':
      return 'Aguardando autenticação no celular…'
    case 'authenticated':
      return 'Autenticado! Iniciando assinatura…'
    case 'signing':
      return 'Assinando documento(s)…'
    case 'signed':
      return 'Documento(s) assinado(s) com sucesso!'
    case 'failed':
      return 'Falha na assinatura'
    case 'expired':
      return 'Sessão expirada'
  }
})

const isFinished = computed(() => ['signed', 'failed', 'expired'].includes(status.value))

function copyAuthUrl() {
  if (!session.value || !import.meta.client) return
  navigator.clipboard.writeText(session.value.authorizeUrl)
  alert('URL copiada!')
}
</script>

<template>
  <Modal
    :open="open"
    title="Assinar com certificado digital"
    subtitle="ICP-Brasil"
    size="md"
    :close-on-backdrop="!session || isFinished"
    @close="emit('close')"
  >
    <div class="p-6">
      <!-- Estado inicial: escolher provider -->
      <div v-if="!session" class="space-y-4">
        <p class="text-sm text-slate-600">
          Você vai assinar
          <strong>{{ documentIds.length }} documento{{ documentIds.length === 1 ? '' : 's' }}</strong>
          com seu certificado digital.
        </p>

        <div>
          <label class="label">Provedor</label>
          <select
            v-model="selectedProvider"
            class="input"
            :disabled="loading || providers.length === 0"
          >
            <option
              v-for="p in providers"
              :key="p.id"
              :value="p.id"
              :disabled="!p.available"
            >
              {{ p.name }}
              {{ !p.available ? ' (não configurado)' : '' }}
            </option>
          </select>
          <p class="text-xs text-slate-500 mt-1.5">
            Mais provedores (Bird ID, SafeWeb…) podem ser adicionados pelo seu admin.
          </p>
        </div>

        <div
          v-if="error"
          class="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700"
        >
          {{ error }}
        </div>
      </div>

      <!-- Estado: QR code + polling -->
      <div v-else-if="!isFinished" class="space-y-4 text-center">
        <div class="inline-block p-3 bg-white border-2 border-slate-200 rounded-xl">
          <img :src="session.qrDataUrl" alt="QR code" class="w-56 h-56" />
        </div>
        <div>
          <h3 class="font-semibold text-slate-900 text-base">
            Escaneie com o celular
          </h3>
          <p class="text-sm text-slate-600 mt-1">
            Abra o app <strong>{{ session.provider.name }}</strong> no celular,
            escaneie o QR e autentique. Pode usar a câmera do celular também.
          </p>
        </div>

        <div class="flex items-center justify-center gap-2 text-sm">
          <div
            class="w-2 h-2 rounded-full"
            :class="
              status === 'pending'
                ? 'bg-amber-400 animate-pulse'
                : status === 'authenticated'
                  ? 'bg-blue-400 animate-pulse'
                  : 'bg-bula-500 animate-pulse'
            "
          />
          <span class="text-slate-600">{{ statusLabel }}</span>
        </div>

        <button
          @click="copyAuthUrl"
          type="button"
          class="text-xs text-slate-500 hover:text-slate-900 underline"
        >
          Copiar link em vez do QR
        </button>
      </div>

      <!-- Estado: sucesso/erro -->
      <div v-else class="space-y-4 text-center py-6">
        <div
          v-if="status === 'signed'"
          class="w-16 h-16 mx-auto rounded-full bg-emerald-100 flex items-center justify-center"
        >
          <svg class="w-8 h-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div
          v-else
          class="w-16 h-16 mx-auto rounded-full bg-red-100 flex items-center justify-center"
        >
          <svg class="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <h3 class="text-lg font-semibold text-slate-900">{{ statusLabel }}</h3>
        <p v-if="error" class="text-sm text-red-600">{{ error }}</p>
      </div>
    </div>

    <template #footer>
      <button
        v-if="!session"
        type="button"
        @click="emit('close')"
        class="btn-secondary"
        :disabled="loading"
      >
        Cancelar
      </button>
      <button
        v-if="!session"
        type="button"
        @click="startSession"
        class="btn-primary"
        :disabled="loading || !selectedProvider"
      >
        {{ loading ? 'Iniciando…' : 'Iniciar assinatura' }}
      </button>

      <button
        v-else-if="!isFinished"
        type="button"
        @click="emit('close')"
        class="btn-secondary"
      >
        Cancelar
      </button>

      <button
        v-else-if="status === 'signed'"
        type="button"
        @click="emit('close')"
        class="btn-primary"
      >
        Concluir
      </button>
      <button
        v-else
        type="button"
        @click="reset"
        class="btn-primary"
      >
        Tentar de novo
      </button>
    </template>
  </Modal>
</template>
