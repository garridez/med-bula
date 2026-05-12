<script setup lang="ts">
import { useUsers, type ManagedUser } from '~/composables/useUsers'

definePageMeta({ layout: 'default' })

const usersApi = useUsers()
const list = ref<ManagedUser[]>([])
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
      role: 'secretary',
      includeInactive: showInactive.value,
    })
    list.value = res.data
  } catch (e: any) {
    error.value = e?.data?.error || 'Erro ao carregar secretárias'
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
</script>

<template>
  <div class="p-8">
    <div class="max-w-5xl mx-auto">
      <div class="flex items-center justify-between mb-6">
        <div>
          <h1 class="text-2xl font-bold text-slate-900">Secretárias</h1>
          <p class="text-sm text-slate-500 mt-0.5">
            Equipe de apoio que opera a agenda e cadastro de pacientes.
          </p>
        </div>
        <div class="flex items-center gap-3">
          <label class="text-xs text-slate-600 flex items-center gap-2 cursor-pointer">
            <input v-model="showInactive" type="checkbox" />
            Mostrar inativas
          </label>
          <button
            @click="openCreate"
            class="px-4 py-2 bg-bula-500 hover:bg-bula-600 text-white rounded-lg text-sm font-medium"
          >
            + Nova secretária
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
          v-else-if="list.length === 0"
          class="p-12 text-center text-sm text-slate-400 italic"
        >
          Nenhuma secretária cadastrada ainda.
        </div>
        <table v-else class="w-full text-sm">
          <thead class="bg-slate-50 border-b border-slate-200">
            <tr class="text-left text-slate-500 text-[11px] uppercase tracking-wide">
              <th class="px-4 py-2.5 font-semibold">Nome</th>
              <th class="px-4 py-2.5 font-semibold">Email</th>
              <th class="px-4 py-2.5 font-semibold">Telefone</th>
              <th class="px-4 py-2.5 font-semibold">Status</th>
              <th class="px-4 py-2.5 font-semibold w-20"></th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr
              v-for="u in list"
              :key="u.id"
              class="hover:bg-slate-50 cursor-pointer"
              :class="{ 'opacity-60': !u.isActive }"
              @click="openEdit(u)"
            >
              <td class="px-4 py-3 font-medium text-slate-900">{{ u.fullName }}</td>
              <td class="px-4 py-3 text-slate-600">{{ u.email }}</td>
              <td class="px-4 py-3 text-slate-600">{{ u.phone || '—' }}</td>
              <td class="px-4 py-3">
                <span
                  class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border"
                  :class="
                    u.isActive
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-slate-100 text-slate-500 border-slate-200'
                  "
                >
                  {{ u.isActive ? 'Ativa' : 'Inativa' }}
                </span>
              </td>
              <td class="px-4 py-3 text-right">
                <button
                  @click.stop="openEdit(u)"
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
      role="secretary"
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
