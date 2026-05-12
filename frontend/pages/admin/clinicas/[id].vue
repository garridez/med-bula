<script setup lang="ts">
import { useAdmin, type AdminClinicWithUsers } from '~/composables/useAdmin'
import { useAuthStore } from '~/stores/auth'

definePageMeta({ layout: 'default' })

const route = useRoute()
const adminApi = useAdmin()
const auth = useAuthStore()

const clinic = ref<AdminClinicWithUsers | null>(null)
const loading = ref(true)
const error = ref('')
const saving = ref(false)

const editForm = reactive({
  name: '',
  cnpj: '',
  phone: '',
  address: '',
  plan: 'consultorio' as 'consultorio' | 'clinica',
  monthlyFee: '' as string | number,
  subscriptionStatus: 'active' as 'active' | 'past_due' | 'cancelled' | 'trial',
  isActive: true,
})

async function load() {
  loading.value = true
  error.value = ''
  try {
    const res = await adminApi.showClinic(Number(route.params.id))
    clinic.value = res.data
    editForm.name = res.data.name
    editForm.cnpj = res.data.cnpj ?? ''
    editForm.phone = res.data.phone ?? ''
    editForm.address = res.data.address ?? ''
    editForm.plan = res.data.plan
    editForm.monthlyFee = res.data.monthlyFee ?? ''
    editForm.subscriptionStatus = res.data.subscriptionStatus
    editForm.isActive = res.data.isActive
  } catch (e: any) {
    error.value = e?.data?.error || 'Erro ao carregar'
  } finally {
    loading.value = false
  }
}
onMounted(load)

async function save() {
  if (!clinic.value) return
  saving.value = true
  error.value = ''
  try {
    await adminApi.updateClinic(clinic.value.id, {
      name: editForm.name,
      cnpj: editForm.cnpj || null,
      phone: editForm.phone || null,
      address: editForm.address || null,
      plan: editForm.plan,
      monthlyFee: editForm.monthlyFee !== '' ? Number(editForm.monthlyFee) : null,
      subscriptionStatus: editForm.subscriptionStatus,
      isActive: editForm.isActive,
    })
    await load()
  } catch (e: any) {
    error.value = e?.data?.error || 'Erro ao salvar'
  } finally {
    saving.value = false
  }
}

async function destroy() {
  if (!clinic.value) return
  if (
    !confirm(
      `Cancelar a clínica "${clinic.value.name}"? Vai desativar a clínica e todos os usuários. Os dados ficam no banco.`
    )
  )
    return
  saving.value = true
  try {
    await adminApi.destroyClinic(clinic.value.id)
    await navigateTo('/admin/clinicas')
  } catch (e: any) {
    error.value = e?.data?.error || 'Erro ao cancelar'
  } finally {
    saving.value = false
  }
}

async function impersonate(userId: number, userName: string) {
  if (
    !confirm(
      `Entrar como ${userName}? Sua sessão atual será substituída. Pra voltar à conta de super_admin, faça logout e login.`
    )
  )
    return
  try {
    const res = await adminApi.impersonate(userId)
    // Substitui token+user no store
    auth.token = res.token
    auth.user = {
      ...res.user,
      clinic: res.user.clinic ?? null,
    }
    // Persiste manualmente (store.persist é private — fazemos manual)
    localStorage.setItem(
      'mb_auth',
      JSON.stringify({ token: res.token, user: auth.user })
    )
    // Redireciona pra home do user personificado
    await navigateTo(auth.homeRoute, { replace: true })
    // Force reload pra garantir reactivity correta
    window.location.reload()
  } catch (e: any) {
    error.value = e?.data?.error || 'Erro ao personificar'
  }
}

const roleLabels: Record<string, string> = {
  admin: 'Admin',
  doctor: 'Médico',
  secretary: 'Secretária',
}
const fmtDate = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
      })
    : '—'
</script>

<template>
  <div class="p-8">
    <div class="max-w-5xl mx-auto">
      <div class="mb-4">
        <NuxtLink
          to="/admin/clinicas"
          class="text-xs text-slate-500 hover:text-slate-700"
        >
          ← Voltar pra lista
        </NuxtLink>
      </div>

      <div v-if="loading" class="py-20 text-center text-slate-500 text-sm">
        Carregando…
      </div>
      <div
        v-else-if="error"
        class="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm"
      >
        {{ error }}
      </div>
      <template v-else-if="clinic">
        <h1 class="text-2xl font-bold text-slate-900 mb-1">{{ clinic.name }}</h1>
        <p class="text-sm text-slate-500 mb-6">
          {{ clinic.cnpj || 'sem CNPJ' }} ·
          {{ clinic.plan === 'consultorio' ? 'Consultório' : 'Clínica' }}
        </p>

        <!-- Edit form -->
        <div class="bg-white rounded-xl border border-slate-200 p-6 mb-6">
          <h2 class="text-sm font-semibold text-slate-900 mb-4">Dados</h2>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="label">Nome</label>
              <input v-model="editForm.name" type="text" class="input" />
            </div>
            <div>
              <label class="label">CNPJ</label>
              <input v-model="editForm.cnpj" type="text" class="input" />
            </div>
            <div>
              <label class="label">Telefone</label>
              <input v-model="editForm.phone" type="text" class="input" />
            </div>
            <div>
              <label class="label">Plano</label>
              <select v-model="editForm.plan" class="input">
                <option value="consultorio">Consultório</option>
                <option value="clinica">Clínica</option>
              </select>
            </div>
            <div class="sm:col-span-2">
              <label class="label">Endereço</label>
              <input v-model="editForm.address" type="text" class="input" />
            </div>
            <div>
              <label class="label">Mensalidade (R$)</label>
              <input
                v-model="editForm.monthlyFee"
                type="number"
                step="0.01"
                class="input"
              />
            </div>
            <div>
              <label class="label">Status</label>
              <select v-model="editForm.subscriptionStatus" class="input">
                <option value="active">Ativa</option>
                <option value="trial">Trial</option>
                <option value="past_due">Atrasada</option>
                <option value="cancelled">Cancelada</option>
              </select>
            </div>
          </div>
          <div class="mt-4 flex gap-2">
            <button
              @click="save"
              :disabled="saving"
              class="px-4 py-2 bg-bula-500 hover:bg-bula-600 text-white rounded-lg text-sm font-medium"
            >
              {{ saving ? 'Salvando…' : 'Salvar alterações' }}
            </button>
            <button
              @click="destroy"
              :disabled="saving"
              class="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg text-sm font-medium"
            >
              Cancelar clínica
            </button>
          </div>
        </div>

        <!-- Users -->
        <div class="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div class="px-5 py-3 border-b border-slate-100">
            <h2 class="text-sm font-semibold text-slate-900">
              Usuários ({{ clinic.users.length }})
            </h2>
            <p class="text-[11px] text-slate-500 mt-0.5">
              Click em "Personificar" pra entrar como esse usuário.
            </p>
          </div>
          <table class="w-full text-sm">
            <thead class="bg-slate-50 border-b border-slate-200">
              <tr class="text-left text-slate-500 text-[11px] uppercase tracking-wide">
                <th class="px-4 py-2.5 font-semibold">Nome</th>
                <th class="px-4 py-2.5 font-semibold">Email</th>
                <th class="px-4 py-2.5 font-semibold">Papel</th>
                <th class="px-4 py-2.5 font-semibold">Último login</th>
                <th class="px-4 py-2.5 font-semibold">Status</th>
                <th class="px-4 py-2.5 font-semibold w-32 text-right"></th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr
                v-for="u in clinic.users"
                :key="u.id"
                :class="{ 'opacity-60': !u.isActive }"
              >
                <td class="px-4 py-3 font-medium text-slate-900">{{ u.fullName }}</td>
                <td class="px-4 py-3 text-slate-600">{{ u.email }}</td>
                <td class="px-4 py-3 text-slate-600">
                  {{ roleLabels[u.role] ?? u.role }}
                </td>
                <td class="px-4 py-3 text-slate-600 whitespace-nowrap">
                  {{ fmtDate(u.lastLoginAt) }}
                </td>
                <td class="px-4 py-3">
                  <span
                    class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border"
                    :class="
                      u.isActive
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-slate-100 text-slate-500 border-slate-200'
                    "
                  >
                    {{ u.isActive ? 'Ativo' : 'Inativo' }}
                  </span>
                </td>
                <td class="px-4 py-3 text-right">
                  <button
                    v-if="u.isActive"
                    @click="impersonate(u.id, u.fullName)"
                    class="text-xs text-bula-600 hover:text-bula-700 font-medium"
                  >
                    Personificar →
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
    </div>
  </div>
</template>
