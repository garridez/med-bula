<script setup lang="ts">
import { useDocuments, type Document } from '~/composables/useDocuments'
import { useSignature } from '~/composables/useSignature'
import { formatDateTimeBR } from '~/utils/format'

const docsApi = useDocuments()
const sig = useSignature()
const documents = ref<Document[]>([])
const loading = ref(true)
const filterType = ref<string>('all')
const sendingWa = ref<string | null>(null)
const sigModalOpen = ref(false)
const sigDocIds = ref<string[]>([])

async function load() {
  loading.value = true
  try {
    const res = await docsApi.listAll()
    documents.value = res.data
  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
}

onMounted(load)

const filtered = computed(() => {
  if (filterType.value === 'all') return documents.value
  return documents.value.filter((d) => d.type === filterType.value)
})

const typeLabel = (t: string) =>
  ({
    prescription: 'Receita',
    exam_request: 'Pedido de exame',
    medical_certificate: 'Atestado',
  } as any)[t] || t

const typeBadge = (t: string) =>
  ({
    prescription: 'bg-bula-50 text-bula-700 ring-1 ring-bula-200',
    exam_request: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200',
    medical_certificate: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  } as any)[t] || 'bg-slate-100'

const statusLabel = (s: string) =>
  ({
    draft: 'Rascunho',
    awaiting_signature: 'Aguardando assinatura',
    signed: 'Assinado',
    delivered: 'Entregue',
    cancelled: 'Cancelado',
  } as any)[s] || s

const statusBadge = (s: string) =>
  ({
    draft: 'bg-slate-100 text-slate-700',
    awaiting_signature: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
    signed: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
    delivered: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200',
    cancelled: 'bg-slate-50 text-slate-400 line-through',
  } as any)[s] || 'bg-slate-100'

function openSignFor(doc: Document) {
  sigDocIds.value = [doc.id]
  sigModalOpen.value = true
}

function signAllPending() {
  const ids = filtered.value
    .filter((d) => d.status === 'awaiting_signature')
    .map((d) => d.id)
  if (ids.length === 0) return
  sigDocIds.value = ids
  sigModalOpen.value = true
}

async function sendWA(doc: Document) {
  sendingWa.value = doc.id
  try {
    const res = await sig.sendToWhatsApp(doc.id)
    alert(
      `📱 WhatsApp (mock) disparado!\n\nLink:\n${res.data.url}\n\nVeja no terminal do backend pra ver a mensagem.`
    )
  } catch (e: any) {
    alert(e?.data?.error || 'Erro ao enviar')
  } finally {
    sendingWa.value = null
  }
}

const pendingCount = computed(
  () => documents.value.filter((d) => d.status === 'awaiting_signature').length
)
</script>

<template>
  <div class="p-6 max-w-7xl mx-auto animate-fade-in">
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-2xl font-bold text-slate-900 tracking-tight">Documentos</h1>
        <p class="text-sm text-slate-500 mt-0.5">
          Receitas, pedidos de exame e atestados emitidos
        </p>
      </div>
      <button
        v-if="pendingCount > 0"
        @click="signAllPending"
        class="btn-primary"
      >
        Assinar {{ pendingCount }} pendente{{ pendingCount === 1 ? '' : 's' }}
      </button>
    </div>

    <!-- Filtros -->
    <div class="flex gap-2 mb-4">
      <button
        v-for="f in [
          { id: 'all', label: 'Todos' },
          { id: 'prescription', label: 'Receitas' },
          { id: 'exam_request', label: 'Exames' },
          { id: 'medical_certificate', label: 'Atestados' },
        ]"
        :key="f.id"
        @click="filterType = f.id"
        class="px-3 py-1.5 text-sm font-medium rounded-full transition"
        :class="
          filterType === f.id
            ? 'bg-bula-500 text-white'
            : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50'
        "
      >
        {{ f.label }}
      </button>
    </div>

    <div v-if="loading" class="card p-12 text-center text-slate-500">Carregando…</div>
    <div v-else-if="filtered.length === 0" class="card p-12 text-center text-slate-500">
      <p class="font-medium mb-1">Nenhum documento ainda</p>
      <p class="text-sm">Documentos emitidos durante consultas aparecem aqui.</p>
    </div>
    <div v-else class="card overflow-hidden">
      <table class="w-full">
        <thead class="bg-slate-50 text-xs font-medium text-slate-500 uppercase tracking-wider">
          <tr>
            <th class="text-left px-6 py-3">Tipo</th>
            <th class="text-left px-6 py-3">Paciente</th>
            <th class="text-left px-6 py-3">Médico</th>
            <th class="text-left px-6 py-3">Emitido em</th>
            <th class="text-left px-6 py-3">Status</th>
            <th class="text-right px-6 py-3"></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          <tr v-for="doc in filtered" :key="doc.id" class="hover:bg-slate-50/70">
            <td class="px-6 py-3">
              <span class="badge" :class="typeBadge(doc.type)">{{ typeLabel(doc.type) }}</span>
            </td>
            <td class="px-6 py-3 text-sm font-medium text-slate-900">
              {{ doc.patient?.fullName || '—' }}
            </td>
            <td class="px-6 py-3 text-sm text-slate-600">
              {{ doc.doctor?.fullName || '—' }}
            </td>
            <td class="px-6 py-3 text-sm text-slate-600">{{ formatDateTimeBR(doc.createdAt) }}</td>
            <td class="px-6 py-3">
              <span class="badge" :class="statusBadge(doc.status)">{{ statusLabel(doc.status) }}</span>
            </td>
            <td class="px-6 py-3 text-right whitespace-nowrap">
              <div class="inline-flex items-center gap-1">
                <a
                  :href="docsApi.pdfUrl(doc.id)"
                  target="_blank"
                  class="text-xs font-medium text-slate-600 hover:text-slate-900 px-2"
                  title="Abrir PDF"
                >
                  PDF
                </a>
                <button
                  v-if="doc.status === 'awaiting_signature'"
                  @click="openSignFor(doc)"
                  class="text-xs font-semibold text-bula-600 hover:text-bula-700 px-2"
                >
                  Assinar
                </button>
                <button
                  v-if="doc.status === 'signed' || doc.status === 'delivered'"
                  @click="sendWA(doc)"
                  :disabled="sendingWa === doc.id"
                  class="text-xs font-medium text-emerald-700 hover:text-emerald-800 px-2 disabled:opacity-50"
                  title="Enviar via WhatsApp"
                >
                  {{ sendingWa === doc.id ? '…' : 'WhatsApp' }}
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <SignatureModal
      :open="sigModalOpen"
      :document-ids="sigDocIds"
      default-provider="vidaas"
      @close="sigModalOpen = false"
      @signed="
        () => {
          sigModalOpen = false
          load()
        }
      "
    />
  </div>
</template>
