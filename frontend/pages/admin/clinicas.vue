<script setup lang="ts">
import { useAdmin, type AdminClinic } from '~/composables/useAdmin'

definePageMeta({ layout: 'default' })

const adminApi = useAdmin()
const clinics = ref<AdminClinic[]>([])
const loading = ref(true)
const error = ref('')

const q = ref('')
const status = ref('')
const plan = ref('')

const showCreateModal = ref(false)
const createForm = reactive({
  clinic: {
    name: '',
    cnpj: '',
    phone: '',
    address: '',
    plan: 'consultorio' as 'consultorio' | 'clinica',
    monthlyFee: '' as number | string,
    subscriptionStatus: 'active' as 'active' | 'trial',
  },
  initialUser: {
    fullName: '',
    email: '',
    password: '',
    phone: '',
    cpf: '',
    crm: '',
    crmUf: 'MG',
    specialty: '',
    consultationPrice: '' as number | string,
  },
})
const creating = ref(false)
const createError = ref('')

async function load() {
  loading.value = true
  error.value = ''
  try {
    const res = await adminApi.listClinics({
      q: q.value || undefined,
      status: status.value || undefined,
      plan: plan.value || undefined,
    })
    clinics.value = res.data
  } catch (e: any) {
    error.value = e?.data?.error || 'Erro ao carregar clínicas'
  } finally {
    loading.value = false
  }
}
onMounted(load)
let searchTimer: any = null
watch(q, () => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(load, 250)
})
watch([status, plan], () => load())

function resetCreateForm() {
  createForm.clinic = {
    name: '',
    cnpj: '',
    phone: '',
    address: '',
    plan: 'consultorio',
    monthlyFee: '',
    subscriptionStatus: 'active',
  }
  createForm.initialUser = {
    fullName: '',
    email: '',
    password: '',
    phone: '',
    cpf: '',
    crm: '',
    crmUf: 'MG',
    specialty: '',
    consultationPrice: '',
  }
  createError.value = ''
}

function openCreate() {
  resetCreateForm()
  showCreateModal.value = true
}

async function submitCreate() {
  createError.value = ''
  const c = createForm.clinic
  const u = createForm.initialUser

  if (!c.name.trim()) {
    createError.value = 'Nome da clínica é obrigatório'
    return
  }
  if (!u.fullName.trim() || !u.email.trim() || u.password.length < 6) {
    createError.value = 'Nome, email e senha do gestor são obrigatórios (senha 6+)'
    return
  }

  creating.value = true
  try {
    await adminApi.createClinic({
      clinic: {
        name: c.name.trim(),
        cnpj: c.cnpj || null,
        phone: c.phone || null,
        address: c.address || null,
        plan: c.plan,
        monthlyFee: c.monthlyFee !== '' ? Number(c.monthlyFee) : null,
        subscriptionStatus: c.subscriptionStatus,
      },
      initialUser: {
        fullName: u.fullName.trim(),
        email: u.email.trim(),
        password: u.password,
        phone: u.phone || null,
        cpf: u.cpf || null,
        crm: c.plan === 'consultorio' ? u.crm || null : null,
        crmUf: c.plan === 'consultorio' ? u.crmUf || null : null,
        specialty: c.plan === 'consultorio' ? u.specialty || null : null,
        consultationPrice:
          c.plan === 'consultorio' && u.consultationPrice !== ''
            ? Number(u.consultationPrice)
            : null,
      },
    })
    showCreateModal.value = false
    await load()
  } catch (e: any) {
    createError.value =
      e?.data?.error || e?.data?.errors?.[0]?.message || 'Erro ao criar'
  } finally {
    creating.value = false
  }
}

const fmtBRL = (v: number | null) =>
  v == null ? '—' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtDate = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
      })
    : '—'

const statusLabels: Record<string, string> = {
  active: 'Ativa',
  trial: 'Trial',
  past_due: 'Atrasada',
  cancelled: 'Cancelada',
}
const statusClasses: Record<string, string> = {
  active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  trial: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  past_due: 'bg-amber-50 text-amber-700 border-amber-200',
  cancelled: 'bg-red-50 text-red-700 border-red-200',
}
const planLabels: Record<string, string> = {
  consultorio: 'Consultório',
  clinica: 'Clínica',
}

function navTo(id: number) {
  navigateTo(`/admin/clinicas/${id}`)
}
</script>

<template>
  <div class="p-8">
    <div class="max-w-7xl mx-auto">
      <div class="flex items-center justify-between mb-6">
        <div>
          <h1 class="text-2xl font-bold text-slate-900">Clínicas</h1>
          <p class="text-sm text-slate-500 mt-0.5">
            Gestão de assinantes da plataforma.
          </p>
        </div>
        <button
          @click="openCreate"
          class="px-4 py-2 bg-bula-500 hover:bg-bula-600 text-white rounded-lg text-sm font-medium"
        >
          + Nova clínica
        </button>
      </div>

      <!-- Filtros -->
      <div class="flex flex-wrap gap-3 mb-4">
        <input
          v-model="q"
          type="search"
          placeholder="Buscar por nome ou CNPJ…"
          class="flex-1 min-w-[200px] px-3 py-2 border border-slate-200 bg-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-bula-200"
        />
        <select
          v-model="status"
          class="px-3 py-2 border border-slate-200 bg-white rounded-lg text-sm"
        >
          <option value="">Todos os status</option>
          <option value="active">Ativas</option>
          <option value="trial">Trial</option>
          <option value="past_due">Atrasadas</option>
          <option value="cancelled">Canceladas</option>
        </select>
        <select
          v-model="plan"
          class="px-3 py-2 border border-slate-200 bg-white rounded-lg text-sm"
        >
          <option value="">Todos os planos</option>
          <option value="consultorio">Consultório</option>
          <option value="clinica">Clínica</option>
        </select>
      </div>

      <div
        v-if="error"
        class="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm"
      >
        {{ error }}
      </div>

      <div class="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div v-if="loading" class="p-8 text-center text-slate-500 text-sm">
          Carregando…
        </div>
        <div
          v-else-if="clinics.length === 0"
          class="p-12 text-center text-sm text-slate-400 italic"
        >
          Nenhuma clínica.
        </div>
        <table v-else class="w-full text-sm">
          <thead class="bg-slate-50 border-b border-slate-200">
            <tr class="text-left text-slate-500 text-[11px] uppercase tracking-wide">
              <th class="px-4 py-2.5 font-semibold">Clínica</th>
              <th class="px-4 py-2.5 font-semibold">Plano</th>
              <th class="px-4 py-2.5 font-semibold">Usuários</th>
              <th class="px-4 py-2.5 font-semibold">Mensalidade</th>
              <th class="px-4 py-2.5 font-semibold">Próx. cobrança</th>
              <th class="px-4 py-2.5 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr
              v-for="c in clinics"
              :key="c.id"
              class="hover:bg-slate-50 cursor-pointer"
              :class="{ 'opacity-60': !c.isActive }"
              @click="navTo(c.id)"
            >
              <td class="px-4 py-3 font-medium text-slate-900">
                {{ c.name }}
                <div class="text-xs font-normal text-slate-500">
                  {{ c.cnpj || 'sem CNPJ' }}
                </div>
              </td>
              <td class="px-4 py-3 text-slate-600">{{ planLabels[c.plan] }}</td>
              <td class="px-4 py-3 text-slate-600">
                <span v-if="c.counts?.doctor">{{ c.counts.doctor }} médico(s)</span>
                <span v-if="c.counts?.secretary" class="text-slate-400 ml-2">
                  · {{ c.counts.secretary }} sec.
                </span>
                <span v-if="c.counts?.admin" class="text-slate-400 ml-2">
                  · {{ c.counts.admin }} admin
                </span>
              </td>
              <td class="px-4 py-3 text-slate-900 whitespace-nowrap">
                {{ fmtBRL(c.monthlyFee) }}
              </td>
              <td class="px-4 py-3 text-slate-600 whitespace-nowrap">
                {{ fmtDate(c.nextBillingAt) }}
              </td>
              <td class="px-4 py-3">
                <span
                  class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border"
                  :class="statusClasses[c.subscriptionStatus]"
                >
                  {{ statusLabels[c.subscriptionStatus] }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Create modal -->
    <Modal
      :open="showCreateModal"
      title="Nova clínica + gestor inicial"
      size="lg"
      @close="showCreateModal = false"
    >
      <form @submit.prevent="submitCreate" class="p-6 space-y-5">
        <!-- Clinic info -->
        <div>
          <h3 class="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">
            Dados da clínica
          </h3>
          <div class="space-y-3">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="label">Nome *</label>
                <input v-model="createForm.clinic.name" type="text" class="input" />
              </div>
              <div>
                <label class="label">CNPJ</label>
                <input v-model="createForm.clinic.cnpj" type="text" class="input" />
              </div>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="label">Telefone</label>
                <input v-model="createForm.clinic.phone" type="text" class="input" />
              </div>
              <div>
                <label class="label">Plano *</label>
                <select v-model="createForm.clinic.plan" class="input">
                  <option value="consultorio">Consultório (1 médico)</option>
                  <option value="clinica">Clínica (admin + N médicos)</option>
                </select>
              </div>
            </div>
            <div>
              <label class="label">Endereço</label>
              <input v-model="createForm.clinic.address" type="text" class="input" />
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="label">Mensalidade SaaS (R$)</label>
                <input
                  v-model="createForm.clinic.monthlyFee"
                  type="number"
                  step="0.01"
                  min="0"
                  class="input"
                />
              </div>
              <div>
                <label class="label">Status inicial</label>
                <select
                  v-model="createForm.clinic.subscriptionStatus"
                  class="input"
                >
                  <option value="active">Ativa</option>
                  <option value="trial">Trial</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <!-- Initial user -->
        <div class="border-t border-slate-100 pt-4">
          <h3 class="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
            Gestor inicial
          </h3>
          <p class="text-[11px] text-slate-500 mb-3">
            {{
              createForm.clinic.plan === 'consultorio'
                ? 'Será criado como MÉDICO (gestor + clínico).'
                : 'Será criado como ADMIN (gestor profissional, não atende).'
            }}
          </p>
          <div class="space-y-3">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="label">Nome completo *</label>
                <input
                  v-model="createForm.initialUser.fullName"
                  type="text"
                  class="input"
                />
              </div>
              <div>
                <label class="label">Email *</label>
                <input
                  v-model="createForm.initialUser.email"
                  type="email"
                  class="input"
                />
              </div>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="label">Senha inicial *</label>
                <input
                  v-model="createForm.initialUser.password"
                  type="text"
                  class="input"
                  placeholder="Min 6 chars"
                />
              </div>
              <div>
                <label class="label">Telefone</label>
                <input
                  v-model="createForm.initialUser.phone"
                  type="text"
                  class="input"
                />
              </div>
            </div>
            <template v-if="createForm.clinic.plan === 'consultorio'">
              <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label class="label">CRM</label>
                  <input
                    v-model="createForm.initialUser.crm"
                    type="text"
                    class="input"
                  />
                </div>
                <div>
                  <label class="label">UF</label>
                  <input
                    v-model="createForm.initialUser.crmUf"
                    type="text"
                    maxlength="2"
                    class="input uppercase"
                  />
                </div>
                <div>
                  <label class="label">Preço consulta (R$)</label>
                  <input
                    v-model="createForm.initialUser.consultationPrice"
                    type="number"
                    step="0.01"
                    min="0"
                    class="input"
                  />
                </div>
              </div>
              <div>
                <label class="label">Especialidade</label>
                <input
                  v-model="createForm.initialUser.specialty"
                  type="text"
                  class="input"
                />
              </div>
            </template>
          </div>
        </div>

        <div
          v-if="createError"
          class="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700"
        >
          {{ createError }}
        </div>
      </form>

      <template #footer>
        <button
          type="button"
          @click="showCreateModal = false"
          :disabled="creating"
          class="btn-secondary"
        >
          Cancelar
        </button>
        <button
          type="button"
          @click="submitCreate"
          :disabled="creating"
          class="btn-primary"
        >
          {{ creating ? 'Criando…' : 'Criar clínica + gestor' }}
        </button>
      </template>
    </Modal>
  </div>
</template>
