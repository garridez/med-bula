<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'
import { useInsurances, type Insurance } from '~/composables/useInsurances'
import { useDoctors } from '~/composables/useAppointments'

definePageMeta({ layout: 'default' })

const auth = useAuthStore()
const insurancesApi = useInsurances()
const { fetchDoctors } = useDoctors()

interface DoctorOption {
  id: number
  fullName: string
}

const insurances = ref<Insurance[]>([])
const doctors = ref<DoctorOption[]>([])
const loading = ref(true)
const error = ref('')

// Modal de criar
const showAddModal = ref(false)
const newInsurance = reactive({
  name: '',
  doctorId: 0,
  price: 0 as number | string,
})
const adding = ref(false)

// Edição inline de preço
const editingPriceId = ref<number | null>(null)
const editingPriceValue = ref<number | string>(0)
const savingPrice = ref(false)

const canManage = computed(() => auth.isClinicAdmin)

interface FlatRow {
  doctorInsuranceId: number
  insurance: Insurance
  doctorId: number
  doctorName: string
  price: number
  isActive: boolean
}

/**
 * Achata insurances → linhas (insurance × doctor). Se um insurance não tem
 * doctor_insurance pra um médico ativo, gera linha vazia "Sem preço definido".
 */
const rows = computed<FlatRow[]>(() => {
  const out: FlatRow[] = []
  for (const ins of insurances.value) {
    if (!ins.isActive) continue
    for (const di of ins.doctorInsurances ?? []) {
      if (!di.isActive) continue
      out.push({
        doctorInsuranceId: di.id,
        insurance: ins,
        doctorId: di.doctorId,
        doctorName: di.doctor?.fullName ?? `Médico #${di.doctorId}`,
        price: Number(di.price),
        isActive: di.isActive,
      })
    }
  }
  return out.sort(
    (a, b) =>
      a.insurance.name.localeCompare(b.insurance.name) ||
      a.doctorName.localeCompare(b.doctorName)
  )
})

async function load() {
  loading.value = true
  error.value = ''
  try {
    const [insRes, docs] = await Promise.all([
      insurancesApi.list(),
      fetchDoctors(),
    ])
    insurances.value = insRes.data
    doctors.value = docs as DoctorOption[]
    // Pré-seleciona médico no modal: se for médico, ele mesmo
    if (auth.user?.role === 'doctor') {
      newInsurance.doctorId = auth.user.id
    } else if (doctors.value.length === 1) {
      newInsurance.doctorId = doctors.value[0].id
    }
  } catch (e: any) {
    error.value = e?.data?.error || 'Erro ao carregar convênios'
  } finally {
    loading.value = false
  }
}
onMounted(load)

function openAddModal() {
  newInsurance.name = ''
  newInsurance.price = 0
  if (auth.user?.role === 'doctor') newInsurance.doctorId = auth.user.id
  showAddModal.value = true
}

async function addInsurance() {
  const name = newInsurance.name.trim()
  const price = Number(newInsurance.price)
  if (!name) {
    error.value = 'Nome do convênio é obrigatório'
    return
  }
  if (!newInsurance.doctorId) {
    error.value = 'Selecione um médico'
    return
  }
  if (!Number.isFinite(price) || price < 0) {
    error.value = 'Preço inválido'
    return
  }
  adding.value = true
  error.value = ''
  try {
    // 1. Cria insurance (ou pega existente, se duplicado é tratado pelo backend)
    let insuranceId: number
    const existing = insurances.value.find(
      (i) => i.name.toLowerCase() === name.toLowerCase() && i.isActive
    )
    if (existing) {
      insuranceId = existing.id
    } else {
      const res = await insurancesApi.create(name)
      insuranceId = res.data.id
    }
    // 2. Cria/atualiza doctor_insurance
    await insurancesApi.upsertDoctorPrice(insuranceId, {
      doctorId: newInsurance.doctorId,
      price,
    })
    showAddModal.value = false
    await load()
  } catch (e: any) {
    error.value = e?.data?.error || 'Erro ao adicionar convênio'
  } finally {
    adding.value = false
  }
}

function startEditPrice(row: FlatRow) {
  editingPriceId.value = row.doctorInsuranceId
  editingPriceValue.value = row.price
}
function cancelEditPrice() {
  editingPriceId.value = null
}
async function saveEditPrice(row: FlatRow) {
  const price = Number(editingPriceValue.value)
  if (!Number.isFinite(price) || price < 0) {
    error.value = 'Preço inválido'
    return
  }
  savingPrice.value = true
  error.value = ''
  try {
    await insurancesApi.updateDoctorPrice(row.doctorInsuranceId, { price })
    editingPriceId.value = null
    await load()
  } catch (e: any) {
    error.value = e?.data?.error || 'Erro ao salvar preço'
  } finally {
    savingPrice.value = false
  }
}

async function removeRow(row: FlatRow) {
  if (
    !confirm(
      `Remover convênio "${row.insurance.name}" para ${row.doctorName}?`
    )
  )
    return
  try {
    await insurancesApi.removeDoctorPrice(row.doctorInsuranceId)
    await load()
  } catch (e: any) {
    error.value = e?.data?.error || 'Erro ao remover'
  }
}

function fmtBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
</script>

<template>
  <div class="p-8">
    <div class="max-w-7xl mx-auto">
      <!-- Header -->
      <div class="flex items-center justify-between mb-6">
        <div>
          <h1 class="text-2xl font-bold text-slate-900">Convênios</h1>
          <p class="text-sm text-slate-500 mt-0.5">
            Cadastre os convênios aceitos e o valor por consulta de cada médico.
          </p>
        </div>
        <button
          v-if="canManage"
          @click="openAddModal"
          class="px-4 py-2 bg-bula-500 hover:bg-bula-600 text-white rounded-lg text-sm font-medium transition-colors"
        >
          + Adicionar convênio
        </button>
      </div>

      <div
        v-if="error"
        class="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm"
      >
        {{ error }}
      </div>

      <!-- Tabela -->
      <div class="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div v-if="loading" class="p-8 text-center text-slate-500 text-sm">
          Carregando…
        </div>
        <div
          v-else-if="rows.length === 0"
          class="p-12 text-center"
        >
          <div class="text-slate-400 text-sm mb-3">
            Nenhum convênio cadastrado ainda.
          </div>
          <button
            v-if="canManage"
            @click="openAddModal"
            class="text-bula-600 hover:text-bula-700 text-sm font-medium"
          >
            Cadastrar o primeiro convênio →
          </button>
        </div>
        <table v-else class="w-full text-sm">
          <thead class="bg-slate-50 border-b border-slate-200">
            <tr class="text-left text-slate-500 text-xs uppercase tracking-wide">
              <th class="px-4 py-3 font-semibold">Convênio</th>
              <th class="px-4 py-3 font-semibold">Médico</th>
              <th class="px-4 py-3 font-semibold w-40">Valor por consulta</th>
              <th v-if="canManage" class="px-4 py-3 font-semibold w-32 text-right">
                Ações
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr
              v-for="row in rows"
              :key="row.doctorInsuranceId"
              class="hover:bg-slate-50"
            >
              <td class="px-4 py-3 font-medium text-slate-900">
                {{ row.insurance.name }}
              </td>
              <td class="px-4 py-3 text-slate-600">{{ row.doctorName }}</td>
              <td class="px-4 py-3">
                <div
                  v-if="editingPriceId === row.doctorInsuranceId"
                  class="flex items-center gap-2"
                >
                  <input
                    v-model.number="editingPriceValue"
                    type="number"
                    step="0.01"
                    min="0"
                    class="w-24 px-2 py-1 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-bula-200"
                  />
                  <button
                    @click="saveEditPrice(row)"
                    :disabled="savingPrice"
                    class="text-xs px-2 py-1 bg-bula-500 hover:bg-bula-600 text-white rounded disabled:opacity-50"
                  >
                    Salvar
                  </button>
                  <button
                    @click="cancelEditPrice"
                    class="text-xs px-2 py-1 text-slate-500 hover:text-slate-700"
                  >
                    Cancelar
                  </button>
                </div>
                <button
                  v-else-if="canManage"
                  @click="startEditPrice(row)"
                  class="text-slate-900 font-medium hover:text-bula-600"
                >
                  {{ fmtBRL(row.price) }}
                </button>
                <span v-else class="text-slate-900 font-medium">
                  {{ fmtBRL(row.price) }}
                </span>
              </td>
              <td v-if="canManage" class="px-4 py-3 text-right">
                <button
                  @click="removeRow(row)"
                  class="text-xs text-red-600 hover:text-red-700"
                >
                  Remover
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <p v-if="!canManage && rows.length > 0" class="mt-3 text-xs text-slate-500">
        Apenas o admin da clínica (ou o médico, em plano consultório) pode editar
        os preços.
      </p>
    </div>

    <!-- Modal: adicionar convênio -->
    <Modal v-if="showAddModal" @close="showAddModal = false">
      <template #title>Adicionar convênio</template>
      <div class="space-y-4">
        <div>
          <label class="block text-xs font-semibold text-slate-700 mb-1.5">
            Nome do convênio
          </label>
          <input
            v-model="newInsurance.name"
            type="text"
            placeholder="Ex: Unimed, Bradesco Saúde"
            class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-bula-200"
          />
          <p class="mt-1 text-[11px] text-slate-500">
            Se o convênio já existe, só adiciona o preço pra esse médico.
          </p>
        </div>

        <div v-if="doctors.length > 1">
          <label class="block text-xs font-semibold text-slate-700 mb-1.5">
            Médico
          </label>
          <select
            v-model.number="newInsurance.doctorId"
            class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-bula-200"
          >
            <option :value="0" disabled>Selecione…</option>
            <option v-for="d in doctors" :key="d.id" :value="d.id">
              {{ d.fullName }}
            </option>
          </select>
        </div>

        <div>
          <label class="block text-xs font-semibold text-slate-700 mb-1.5">
            Valor por consulta (R$)
          </label>
          <input
            v-model.number="newInsurance.price"
            type="number"
            step="0.01"
            min="0"
            placeholder="0,00"
            class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-bula-200"
          />
        </div>

        <div class="flex justify-end gap-2 pt-2">
          <button
            @click="showAddModal = false"
            class="px-4 py-2 text-sm text-slate-600 hover:text-slate-900"
          >
            Cancelar
          </button>
          <button
            @click="addInsurance"
            :disabled="adding"
            class="px-4 py-2 bg-bula-500 hover:bg-bula-600 text-white rounded-lg text-sm font-medium disabled:opacity-50"
          >
            {{ adding ? 'Salvando…' : 'Adicionar' }}
          </button>
        </div>
      </div>
    </Modal>
  </div>
</template>
