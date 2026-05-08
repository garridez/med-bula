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
const status = ref<
  'idle' | 'pending' | 'authenticated' | 'signing' | 'signed' | 'failed' | 'expired'
>('idle')
const error = ref<string | null>(null)
const loading = ref(false)
let pollInterval: any = null
let popupRef: Window | null = null

watch(
  () => props.open,
  async (open) => {
    if (open) {
      await loadProviders()
      reset()
    } else {
      stopPolling()
      closePopup()
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
        : providers.value[0]?.id ?? ''
  } catch (e: any) {
    error.value = e?.message || 'Erro ao listar provedores'
  }
}

function reset() {
  session.value = null
  status.value = 'idle'
  error.value = null
}

function closePopup() {
  if (popupRef && !popupRef.closed) {
    try {
      popupRef.close()
    } catch {
      /* ignore */
    }
  }
  popupRef = null
}

async function startSession() {
  if (!selectedProvider.value) return
  loading.value = true
  error.value = null
  try {
    const res = await sig.createSession({
      provider: selectedProvider.value,
      documentIds: props.documentIds,
    })
    session.value = res.data
    status.value = 'pending'

    // Abre a página de autenticação do Vidaas em um popup. O Vidaas mostra
    // o próprio QR pra o médico escanear com o app dele. O redirect cai
    // no /api/signature/callback do nosso backend.
    openVidaasPopup(res.data.authorizeUrl)
    startPolling()
  } catch (e: any) {
    error.value = e?.data?.error || e?.message || 'Erro ao iniciar sessão'
  } finally {
    loading.value = false
  }
}

function openVidaasPopup(url: string) {
  if (!import.meta.client) return
  const w = 600
  const h = 720
  const left = Math.max(0, (window.screen.width - w) / 2)
  const top = Math.max(0, (window.screen.height - h) / 2)
  popupRef = window.open(
    url,
    'vidaas-auth',
    `width=${w},height=${h},left=${left},top=${top},toolbar=0,menubar=0,status=0,location=1`
  )

  // Popup bloqueado pelo navegador
  if (!popupRef || popupRef.closed) {
    error.value =
      'Pop-up bloqueado pelo navegador. Permita pop-ups deste site e tente de novo.'
    status.value = 'failed'
    stopPolling()
  }
}

function reopenPopup() {
  if (session.value) openVidaasPopup(session.value.authorizeUrl)
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
        closePopup()
        emit('signed', props.documentIds)
      } else if (s === 'failed' || s === 'expired') {
        stopPolling()
        closePopup()
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

onBeforeUnmount(() => {
  stopPolling()
  closePopup()
})

const statusLabel = computed(() => {
  switch (status.value) {
    case 'idle':
      return ''
    case 'pending':
      return 'Aguardando autenticação no Vidaas…'
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
const inProgress = computed(() =>
  ['pending', 'authenticated', 'signing'].includes(status.value)
)
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
            <option v-for="p in providers" :key="p.id" :value="p.id">
              {{ p.name }}
            </option>
          </select>
          <p class="text-xs text-slate-500 mt-1.5">
            Use seu certificado pessoal cadastrado no provedor escolhido.
          </p>
        </div>

        <div
          v-if="error"
          class="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700"
        >
          {{ error }}
        </div>
      </div>

      <!-- Estado: aguardando popup do Vidaas -->
      <div v-else-if="inProgress" class="space-y-5 text-center py-4">
        <div class="relative w-16 h-16 mx-auto">
          <div class="absolute inset-0 rounded-full border-4 border-slate-100"></div>
          <div
            class="absolute inset-0 rounded-full border-4 border-bula-500 border-t-transparent animate-spin"
          ></div>
        </div>

        <div>
          <h3 class="font-semibold text-slate-900 text-base">{{ statusLabel }}</h3>
          <p v-if="status === 'pending'" class="text-sm text-slate-600 mt-2 px-4">
            Uma janela do <strong>{{ session.provider.name }}</strong> foi aberta.
            Autentique e aprove a assinatura no seu celular pelo app Vidaas.
          </p>
          <p v-else-if="status === 'authenticated'" class="text-sm text-slate-600 mt-2">
            O médico autenticou. Enviando documentos pra assinatura…
          </p>
          <p v-else-if="status === 'signing'" class="text-sm text-slate-600 mt-2">
            Aplicando assinatura ICP-Brasil PAdES_AD_RT.
          </p>
        </div>

        <button
          v-if="status === 'pending'"
          type="button"
          @click="reopenPopup"
          class="text-xs text-slate-500 hover:text-slate-900 underline"
        >
          Não abriu? Clique pra reabrir a janela
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
        <p v-if="error" class="text-sm text-red-600 px-4">{{ error }}</p>
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

      <button v-else-if="inProgress" type="button" @click="emit('close')" class="btn-secondary">
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
      <button v-else type="button" @click="reset" class="btn-primary">
        Tentar de novo
      </button>
    </template>
  </Modal>
</template>
