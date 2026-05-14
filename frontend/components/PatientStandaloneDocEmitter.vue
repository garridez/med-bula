<script setup lang="ts">
import { useDocuments, type PrescriptionItem, type ExamItem } from '~/composables/useDocuments'
import type { Patient } from '~/composables/usePatients'

const props = defineProps<{
  patient: Patient
}>()

const emit = defineEmits<{
  created: [doc: any]
}>()

const docsApi = useDocuments()
const activeTab = ref<'prescription' | 'exam' | 'certificate'>('prescription')

// Prescription
const prescriptionItems = ref<PrescriptionItem[]>([emptyPrescriptionItem()])
function emptyPrescriptionItem(): PrescriptionItem {
  return {
    medicationId: null,
    medicationTitle: null,
    activeIngredient: null,
    laboratoryName: null,
    category: null,
    freeText: null,
    posology: null,
    prescriptionType: 'simples',
    usageType: 'nao_informada',
  }
}
function addPrescriptionItem() {
  prescriptionItems.value.push(emptyPrescriptionItem())
}
function removePrescriptionItem(idx: number) {
  prescriptionItems.value.splice(idx, 1)
  if (prescriptionItems.value.length === 0)
    prescriptionItems.value.push(emptyPrescriptionItem())
}

// Exam
const examItems = ref<ExamItem[]>([{ name: '', tuss: null, notes: null }])
function addExamItem() {
  examItems.value.push({ name: '', tuss: null, notes: null })
}
function removeExamItem(idx: number) {
  examItems.value.splice(idx, 1)
  if (examItems.value.length === 0)
    examItems.value.push({ name: '', tuss: null, notes: null })
}

// Certificate
const certificate = reactive({
  reason: '',
  daysOff: 1,
  cid: '',
  notes: '',
})

const saving = ref(false)
const error = ref('')

async function emitPrescription() {
  const valid = prescriptionItems.value.filter((i: any) => {
    if (i.medicationId && i.medicationTitle) return true
    if (i.freeText && i.freeText.trim()) return true
    return false
  })
  if (valid.length === 0) {
    error.value = 'Adicione pelo menos um item à receita'
    return
  }
  saving.value = true
  error.value = ''
  try {
    const res = await docsApi.create({
      type: 'prescription',
      patientId: props.patient.id,
      appointmentId: null,
      medicalRecordId: null,
      payload: { items: valid },
    })
    emit('created', res.data)
    prescriptionItems.value = [emptyPrescriptionItem()]
  } catch (e: any) {
    error.value = e?.data?.errors?.[0]?.message || e?.message || 'Erro ao emitir receita'
  } finally {
    saving.value = false
  }
}

async function emitExam() {
  const valid = examItems.value.filter((i) => i.name.trim())
  if (valid.length === 0) {
    error.value = 'Adicione pelo menos um exame'
    return
  }
  saving.value = true
  error.value = ''
  try {
    const res = await docsApi.create({
      type: 'exam_request',
      patientId: props.patient.id,
      appointmentId: null,
      medicalRecordId: null,
      payload: { items: valid },
    })
    emit('created', res.data)
    examItems.value = [{ name: '', tuss: null, notes: null }]
  } catch (e: any) {
    error.value = e?.data?.errors?.[0]?.message || e?.message || 'Erro ao emitir pedido'
  } finally {
    saving.value = false
  }
}

async function emitCertificate() {
  if (!certificate.reason.trim()) {
    error.value = 'Motivo é obrigatório'
    return
  }
  if (!certificate.daysOff || certificate.daysOff < 1) {
    error.value = 'Dias de afastamento deve ser ≥ 1'
    return
  }
  saving.value = true
  error.value = ''
  try {
    const res = await docsApi.create({
      type: 'medical_certificate',
      patientId: props.patient.id,
      appointmentId: null,
      medicalRecordId: null,
      payload: {
        reason: certificate.reason.trim(),
        daysOff: certificate.daysOff,
        cid: certificate.cid.trim() || null,
        notes: certificate.notes.trim() || null,
      },
    })
    emit('created', res.data)
    certificate.reason = ''
    certificate.daysOff = 1
    certificate.cid = ''
    certificate.notes = ''
  } catch (e: any) {
    error.value = e?.data?.errors?.[0]?.message || e?.message || 'Erro ao emitir atestado'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="space-y-4">
    <!-- Tabs -->
    <div class="flex gap-1 border-b border-slate-200">
      <button
        v-for="t in [
          { key: 'prescription', label: 'Receita' },
          { key: 'exam', label: 'Pedido de exame' },
          { key: 'certificate', label: 'Atestado' },
        ]"
        :key="t.key"
        type="button"
        @click="activeTab = t.key as any"
        class="px-3 py-1.5 text-sm transition border-b-2 -mb-px"
        :class="
          activeTab === t.key
            ? 'border-bula-500 text-bula-700 font-medium'
            : 'border-transparent text-slate-500 hover:text-slate-700'
        "
      >
        {{ t.label }}
      </button>
    </div>

    <p class="text-xs text-slate-500">
      Documento avulso — não vinculado a uma consulta específica. O paciente
      poderá baixar via WhatsApp/QR como qualquer outro.
    </p>

    <!-- Receita -->
    <div v-if="activeTab === 'prescription'" class="space-y-3">
      <PrescriptionItemEditor
        v-for="(item, idx) in prescriptionItems"
        :key="idx"
        v-model="prescriptionItems[idx]"
        :index="idx"
        @remove="removePrescriptionItem(idx)"
      />
      <div class="flex gap-2">
        <button @click="addPrescriptionItem" type="button" class="btn-secondary">
          + Adicionar item
        </button>
        <button
          @click="emitPrescription"
          type="button"
          class="btn-primary"
          :disabled="saving"
        >
          {{ saving ? 'Emitindo…' : 'Emitir receita' }}
        </button>
      </div>
    </div>

    <!-- Exames -->
    <div v-else-if="activeTab === 'exam'" class="space-y-3">
      <div
        v-for="(item, idx) in examItems"
        :key="idx"
        class="card p-3 space-y-2"
      >
        <div class="flex items-start gap-2">
          <span class="text-[10px] font-semibold text-slate-500 mt-1.5">#{{ idx + 1 }}</span>
          <input
            v-model="item.name"
            type="text"
            placeholder="Nome do exame"
            class="input flex-1"
          />
          <button
            v-if="examItems.length > 1"
            @click="removeExamItem(idx)"
            class="text-slate-400 hover:text-red-600 mt-1.5"
          >
            ✕
          </button>
        </div>
        <div class="grid grid-cols-2 gap-2">
          <input
            v-model="item.tuss"
            type="text"
            placeholder="TUSS (opcional)"
            class="input text-xs"
          />
          <input
            v-model="item.notes"
            type="text"
            placeholder="Observações"
            class="input text-xs"
          />
        </div>
      </div>
      <div class="flex gap-2">
        <button @click="addExamItem" type="button" class="btn-secondary">
          + Adicionar exame
        </button>
        <button
          @click="emitExam"
          type="button"
          class="btn-primary"
          :disabled="saving"
        >
          {{ saving ? 'Emitindo…' : 'Emitir pedido' }}
        </button>
      </div>
    </div>

    <!-- Atestado -->
    <div v-else-if="activeTab === 'certificate'" class="space-y-3 max-w-2xl">
      <div>
        <label class="label">Motivo *</label>
        <textarea
          v-model="certificate.reason"
          rows="2"
          placeholder="Ex: tratamento clínico"
          class="input resize-none"
        />
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="label">Dias de afastamento *</label>
          <input
            v-model.number="certificate.daysOff"
            type="number"
            min="1"
            class="input"
          />
        </div>
        <div>
          <label class="label">CID (opcional)</label>
          <input
            v-model="certificate.cid"
            type="text"
            placeholder="J11.1"
            class="input"
          />
        </div>
      </div>
      <div>
        <label class="label">Observações (opcional)</label>
        <textarea
          v-model="certificate.notes"
          rows="2"
          class="input resize-none"
        />
      </div>
      <button
        @click="emitCertificate"
        type="button"
        class="btn-primary"
        :disabled="saving"
      >
        {{ saving ? 'Emitindo…' : 'Emitir atestado' }}
      </button>
    </div>

    <p v-if="error" class="text-sm text-red-600">{{ error }}</p>
  </div>
</template>
