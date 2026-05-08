<script setup lang="ts">
const route = useRoute()
const { apiBase } = useRuntimeConfig().public

definePageMeta({ layout: false })

const token = computed(() => route.params.token as string)
/** ?baixa=1 = veio do QR do PDF (farmácia / laboratório / empresa) */
const isBaixa = computed(() => route.query.baixa === '1')

interface DispensingMeta {
  actorType: 'pharmacy' | 'lab' | 'employer'
  actor: string
  cnpjLabel: string
  nameLabel: string
  actionLabel: string
  description: string
}

const meta = ref<{
  type: string
  typeLabel: string
  status: string
  patientName: string
  patientCpf: string | null
  phoneHint: string
  doctorName: string | null
  dispensing: DispensingMeta
  priorDispensings: number
} | null>(null)
const loading = ref(true)
const errorLoad = ref<string | null>(null)

// Fluxo paciente (OTP)
const otp = ref('')
const verifying = ref(false)
const otpError = ref<string | null>(null)

// Fluxo farmácia/lab/empresa (CNPJ)
const cnpj = ref('')
const pharmacyName = ref('')
const dispensing = ref(false)
const cnpjError = ref<string | null>(null)
const dispensedInfo = ref<{ cnpjFormatted: string } | null>(null)

// PDF compartilhado
const pdfPath = ref<string | null>(null)
const verified = ref(false)

async function loadMeta() {
  loading.value = true
  errorLoad.value = null
  try {
    const res = await $fetch<{ data: any }>(`${apiBase}/api/public/r/${token.value}`)
    meta.value = res.data
  } catch (e: any) {
    errorLoad.value =
      e?.data?.error || 'Esse link não está mais disponível ou já foi cancelado.'
  } finally {
    loading.value = false
  }
}

async function onOtpComplete(code: string) {
  if (verifying.value) return
  verifying.value = true
  otpError.value = null
  try {
    const res = await $fetch<{ data: { ok: boolean; pdfUrl: string } }>(
      `${apiBase}/api/public/r/${token.value}/verify`,
      { method: 'POST', body: { otp: code } }
    )
    pdfPath.value = `${apiBase}${res.data.pdfUrl}`
    verified.value = true
  } catch (e: any) {
    otpError.value = e?.data?.error || 'Código incorreto.'
    otp.value = ''
  } finally {
    verifying.value = false
  }
}

async function onDispense() {
  if (dispensing.value) return
  cnpjError.value = null
  if (!cnpj.value || cnpj.value.replace(/\D/g, '').length < 14) {
    cnpjError.value = 'Digite o CNPJ completo (14 dígitos).'
    return
  }
  dispensing.value = true
  try {
    const res = await $fetch<{
      data: { ok: boolean; dispensingId: string; cnpjFormatted: string; pdfUrl: string }
    }>(`${apiBase}/api/public/r/${token.value}/dispense`, {
      method: 'POST',
      body: { cnpj: cnpj.value, name: pharmacyName.value || null },
    })
    pdfPath.value = `${apiBase}${res.data.pdfUrl}`
    dispensedInfo.value = { cnpjFormatted: res.data.cnpjFormatted }
    verified.value = true
  } catch (e: any) {
    cnpjError.value = e?.data?.error || 'Erro ao dar baixa'
  } finally {
    dispensing.value = false
  }
}

function formatCnpjMask(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 14)
  if (d.length <= 2) return d
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
}

function onCnpjInput(e: Event) {
  cnpj.value = formatCnpjMask((e.target as HTMLInputElement).value)
}

function printPdf() {
  if (import.meta.client && pdfPath.value) {
    const w = window.open(pdfPath.value, '_blank')
    if (w) {
      w.addEventListener('load', () => {
        try {
          w.print()
        } catch {
          /* alguns browsers bloqueiam */
        }
      })
    }
  }
}

onMounted(loadMeta)

const titleByType = computed(() => {
  if (!meta.value) return 'Documento médico'
  return (
    {
      prescription: 'Receita médica',
      exam_request: 'Pedido de exame',
      medical_certificate: 'Atestado médico',
    } as any
  )[meta.value.type] ?? 'Documento'
})
</script>

<template>
  <div class="min-h-screen bg-slate-50 flex flex-col">
    <header class="bg-white border-b border-slate-200 px-6 py-4">
      <div class="max-w-3xl mx-auto flex items-center gap-3">
        <div class="w-9 h-9 bg-bula-500 rounded-lg flex items-center justify-center shadow-sm">
          <svg viewBox="0 0 100 100" class="w-6 h-6" fill="white">
            <path
              d="M20 15 L20 85 L55 85 C72 85 80 75 80 60 C80 52 76 46 70 43 C75 40 78 35 78 28 C78 18 70 15 55 15 Z M35 28 L52 28 C58 28 62 31 62 36 C62 41 58 44 52 44 L35 44 Z M35 56 L54 56 C61 56 65 60 65 65 C65 70 61 73 54 73 L35 73 Z"
            />
          </svg>
        </div>
        <div>
          <div class="font-bold text-slate-900">med.bula</div>
          <div class="text-xs text-slate-500">
            {{ isBaixa ? 'Baixa de documento' : 'Documento médico' }}
          </div>
        </div>
      </div>
    </header>

    <main class="flex-1 px-4 py-6 sm:py-12">
      <div class="max-w-md mx-auto">
        <!-- Loading -->
        <div v-if="loading" class="card p-12 text-center text-slate-500">
          Carregando…
        </div>

        <!-- Erro -->
        <div v-else-if="errorLoad" class="card p-8 text-center">
          <div class="w-14 h-14 mx-auto rounded-full bg-red-100 flex items-center justify-center mb-3">
            <svg class="w-7 h-7 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 class="text-base font-semibold text-slate-900 mb-1">Link indisponível</h1>
          <p class="text-sm text-slate-600">{{ errorLoad }}</p>
        </div>

        <!-- Verificado: PDF -->
        <div v-else-if="verified && pdfPath" class="space-y-4">
          <div class="card p-4 flex items-center gap-3">
            <div class="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
              <svg class="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div class="flex-1 min-w-0">
              <div class="font-semibold text-slate-900 text-sm">{{ titleByType }}</div>
              <div class="text-xs text-slate-500 truncate">
                {{
                  dispensedInfo
                    ? `Baixa registrada · ${dispensedInfo.cnpjFormatted}`
                    : `Emitido por ${meta?.doctorName}`
                }}
              </div>
            </div>
          </div>

          <div class="card overflow-hidden">
            <iframe
              :src="pdfPath"
              class="w-full bg-white"
              style="height: 70vh"
              frameborder="0"
            />
          </div>

          <div class="grid grid-cols-2 gap-2">
            <a :href="pdfPath" target="_blank" class="btn-secondary !py-3 justify-center">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Baixar
            </a>
            <button @click="printPdf" type="button" class="btn-primary !py-3">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Imprimir
            </button>
          </div>
        </div>

        <!-- Fluxo FARMÁCIA / LAB / EMPRESA (CNPJ) -->
        <div v-else-if="isBaixa && meta" class="space-y-5">
          <div class="card p-6 sm:p-8">
            <div class="text-center mb-5">
              <div class="w-12 h-12 mx-auto bg-bula-50 rounded-full flex items-center justify-center mb-3">
                <svg class="w-6 h-6 text-bula-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8"
                    d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <h1 class="text-lg font-bold text-slate-900">{{ titleByType }}</h1>
              <p class="text-sm text-slate-600 mt-1.5">
                {{ meta.dispensing.description }}
              </p>
            </div>

            <!-- Aviso se já foi dispensada antes -->
            <div
              v-if="meta.priorDispensings > 0"
              class="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800"
            >
              ⚠️ Esse documento já foi registrado em
              <strong>{{ meta.priorDispensings }}</strong>
              {{ meta.dispensing.actor }}{{ meta.priorDispensings === 1 ? '' : 's' }} anteriormente.
            </div>

            <!-- Resumo do paciente -->
            <div class="mb-5 p-3 rounded-lg bg-slate-50 text-xs space-y-1">
              <div class="flex justify-between">
                <span class="text-slate-500">Paciente</span>
                <span class="font-medium text-slate-900">{{ meta.patientName }}</span>
              </div>
              <div v-if="meta.patientCpf" class="flex justify-between">
                <span class="text-slate-500">CPF</span>
                <span class="font-medium text-slate-900 font-mono">{{ meta.patientCpf }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-slate-500">Médico</span>
                <span class="font-medium text-slate-900">{{ meta.doctorName }}</span>
              </div>
            </div>

            <div class="space-y-3">
              <div>
                <label class="label">{{ meta.dispensing.cnpjLabel }}</label>
                <input
                  type="text"
                  :value="cnpj"
                  @input="onCnpjInput"
                  class="input font-mono"
                  inputmode="numeric"
                  placeholder="00.000.000/0000-00"
                  :disabled="dispensing"
                />
              </div>
              <div>
                <label class="label">{{ meta.dispensing.nameLabel }}</label>
                <input
                  v-model="pharmacyName"
                  type="text"
                  class="input"
                  placeholder="Nome / razão social"
                  :disabled="dispensing"
                />
              </div>
            </div>

            <p v-if="cnpjError" class="text-sm text-red-600 mt-3">{{ cnpjError }}</p>

            <button
              @click="onDispense"
              :disabled="dispensing"
              class="btn-primary w-full mt-5 !py-3 justify-center"
            >
              {{ dispensing ? 'Registrando…' : meta.dispensing.actionLabel + ' e abrir PDF' }}
            </button>
          </div>

          <p class="text-xs text-center text-slate-400 px-4">
            Esse acesso é registrado para fins de auditoria.
          </p>
        </div>

        <!-- Fluxo PACIENTE (OTP) -->
        <div v-else-if="meta" class="space-y-5">
          <div class="card p-6 sm:p-8">
            <div class="text-center mb-6">
              <div class="w-12 h-12 mx-auto bg-bula-50 rounded-full flex items-center justify-center mb-3">
                <svg class="w-6 h-6 text-bula-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8"
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h1 class="text-lg font-bold text-slate-900">{{ titleByType }}</h1>
              <p class="text-sm text-slate-600 mt-1.5">
                Olá, <strong>{{ meta.patientName }}</strong>! Para abrir, digite os
                <strong>4 últimos dígitos</strong> do seu telefone ({{ meta.phoneHint }}).
              </p>
            </div>

            <OtpInput
              v-model="otp"
              :error="!!otpError"
              :disabled="verifying"
              @complete="onOtpComplete"
            />

            <div v-if="verifying" class="text-center text-sm text-slate-500 mt-4">
              Verificando…
            </div>
            <div v-else-if="otpError" class="text-center text-sm text-red-600 mt-4">
              {{ otpError }}
            </div>
          </div>

          <p class="text-xs text-center text-slate-400 px-4">
            Você está acessando um documento médico privado. O acesso é registrado.
          </p>
        </div>
      </div>
    </main>

    <footer class="px-6 py-4 text-center text-xs text-slate-400">
      med.bula.com.br
    </footer>
  </div>
</template>
