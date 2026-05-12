<script setup lang="ts">
import { useUsers, type ManagedUser } from '~/composables/useUsers'

definePageMeta({ layout: 'default' })

const usersApi = useUsers()
const doctors = ref<ManagedUser[]>([])
const loading = ref(true)
const error = ref('')
const showInactive = ref(false)

const showModal = ref(false)
const editing = ref<ManagedUser | null>(null)

async function load() {
  loading.value = true
  error.value = ''
  try {
    const res = await usersApi.list({
      role: 'doctor',
      includeInactive: showInactive.value,
    })
    doctors.value = res.data
  } catch (e: any) {
    error.value = e?.data?.error || 'Erro ao carregar médicos'
  } finally {
    loading.value = false
  }
}
onMounted(load)
watch(showInactive, () => load())

function openCreate() {
  editing.value = null
  showModal.value = true
}
function openEdit(u: ManagedUser) {
  editing.value = u
  showModal.value = true
}

const fmtBRL = (v: number | null) =>
  v == null ? '—' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

function splitLabel(u: ManagedUser): string {
  if (!u.splitType || u.splitValue == null) return '100% médico'
  if (u.splitType === 'percentual') return `${u.splitValue}% clínica`
  return `${fmtBRL(u.splitValue)} clínica`
}
</script>

<template>
  <div class="p-8">
    <div class="max-w-6xl mx-auto">
      <div class="flex items-center justify-between mb-6">
        <div>
          <h1 class="text-2xl font-bold text-slate-900">Médicos</h1>
          <p class="text-sm text-slate-500 mt-0.5">
            Gerencie os médicos da clínica, preços e split de retenção.
          </p>
        </div>
        <div class="flex items-center gap-3">
          <label class="text-xs text-slate-600 flex items-center gap-2 cursor-pointer">
            <input v-model="showInactive" type="checkbox" />
            Mostrar inativos
          </label>
          <button
            @click="openCreate"
            class="px-4 py-2 bg-bula-500 hover:bg-bula-600 text-white rounded-lg text-sm font-medium"
          >
            + Novo médico
          </button>
        </div>
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
          v-else-if="doctors.length === 0"
          class="p-12 text-center text-sm text-slate-400 italic"
        >
          Nenhum médico cadastrado ainda.
        </div>
        <table v-else class="w-full text-sm">
          <thead class="bg-slate-50 border-b border-slate-200">
            <tr class="text-left text-slate-500 text-[11px] uppercase tracking-wide">
              <th class="px-4 py-2.5 font-semibold">Nome</th>
              <th class="px-4 py-2.5 font-semibold">CRM</th>
              <th class="px-4 py-2.5 font-semibold">Especialidade</th>
              <th class="px-4 py-2.5 font-semibold">Particular</th>
              <th class="px-4 py-2.5 font-semibold">Split</th>
              <th class="px-4 py-2.5 font-semibold">Status</th>
              <th class="px-4 py-2.5 font-semibold w-20"></th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr
              v-for="d in doctors"
              :key="d.id"
              class="hover:bg-slate-50 cursor-pointer"
              :class="{ 'opacity-60': !d.isActive }"
              @click="openEdit(d)"
            >
              <td class="px-4 py-3 font-medium text-slate-900">
                {{ d.fullName }}
                <div class="text-xs font-normal text-slate-500">{{ d.email }}</div>
              </td>
              <td class="px-4 py-3 text-slate-600 whitespace-nowrap">
                {{ d.crm ? `${d.crm}/${d.crmUf}` : '—' }}
              </td>
              <td class="px-4 py-3 text-slate-600">{{ d.specialty || '—' }}</td>
              <td class="px-4 py-3 text-slate-900 whitespace-nowrap">
                {{ fmtBRL(d.consultationPrice) }}
              </td>
              <td class="px-4 py-3 text-slate-600 whitespace-nowrap">
                {{ splitLabel(d) }}
              </td>
              <td class="px-4 py-3">
                <span
                  class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border"
                  :class="
                    d.isActive
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-slate-100 text-slate-500 border-slate-200'
                  "
                >
                  {{ d.isActive ? 'Ativo' : 'Inativo' }}
                </span>
              </td>
              <td class="px-4 py-3 text-right">
                <button
                  @click.stop="openEdit(d)"
                  class="text-xs text-bula-600 hover:text-bula-700 font-medium"
                >
                  Editar
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <UserFormModal
      :open="showModal"
      role="doctor"
      :user="editing"
      @close="showModal = false"
      @saved="
        () => {
          showModal = false
          load()
        }
      "
      @changed="load"
    />
  </div>
</template>
