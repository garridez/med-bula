<script setup lang="ts">
import { usePatients, type Patient, type PatientInput } from '~/composables/usePatients'
import { maskCPF, maskPhone, ageFromBirthDate, initials } from '~/utils/format'

const patientsApi = usePatients()

const patients = ref<Patient[]>([])
const search = ref('')
const loading = ref(false)
const modalOpen = ref(false)
const editing = ref<Patient | null>(null)
const formData = ref<PatientInput>(emptyForm())
const saving = ref(false)
const error = ref<string | null>(null)

function emptyForm(): PatientInput {
  return {
    fullName: '',
    cpf: null,
    rg: null,
    birthDate: null,
    gender: null,
    weightKg: null,
    heightCm: null,
    phone: null,
    email: null,
    address: null,
    city: null,
    state: null,
    zipcode: null,
    notes: null,
  }
}

async function load() {
  loading.value = true
  try {
    const res = await patientsApi.list(search.value || undefined)
    patients.value = res.data
  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
}

let searchTimer: any = null
watch(search, () => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(load, 250)
})

onMounted(load)

function openCreate() {
  editing.value = null
  formData.value = emptyForm()
  error.value = null
  modalOpen.value = true
}

function openEdit(p: Patient) {
  editing.value = p
  formData.value = {
    fullName: p.fullName,
    cpf: p.cpf,
    rg: p.rg,
    birthDate: p.birthDate ? p.birthDate.slice(0, 10) : null,
    gender: p.gender,
    weightKg: p.weightKg,
    heightCm: p.heightCm,
    phone: p.phone,
    email: p.email,
    address: p.address,
    city: p.city,
    state: p.state,
    zipcode: p.zipcode,
    notes: p.notes,
  }
  error.value = null
  modalOpen.value = true
}

async function save() {
  if (!formData.value.fullName || formData.value.fullName.trim().length < 2) {
    error.value = 'Informe o nome do paciente'
    return
  }
  saving.value = true
  error.value = null
  try {
    if (editing.value) {
      await patientsApi.update(editing.value.id, formData.value)
    } else {
      await patientsApi.create(formData.value)
    }
    modalOpen.value = false
    await load()
  } catch (e: any) {
    error.value =
      e?.data?.errors?.[0]?.message ||
      e?.data?.error ||
      e?.message ||
      'Erro ao salvar paciente'
  } finally {
    saving.value = false
  }
}

async function remove(p: Patient) {
  if (!confirm(`Remover ${p.fullName}? (Pode ser reativado depois.)`)) return
  try {
    await patientsApi.remove(p.id)
    await load()
  } catch (e: any) {
    alert(e?.message || 'Erro ao remover')
  }
}
</script>

<template>
  <div class="p-6 max-w-7xl mx-auto animate-fade-in">
    <!-- Header -->
    <div class="flex items-center justify-between gap-4 mb-6">
      <div>
        <h1 class="text-2xl font-bold text-slate-900 tracking-tight">Pacientes</h1>
        <p class="text-sm text-slate-500 mt-0.5">
          {{ patients.length }} paciente{{ patients.length === 1 ? '' : 's' }}
        </p>
      </div>
      <button @click="openCreate" class="btn-primary">
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4" />
        </svg>
        Novo paciente
      </button>
    </div>

    <!-- Search -->
    <div class="mb-4 relative">
      <input
        v-model="search"
        type="text"
        placeholder="Buscar por nome, CPF ou telefone…"
        class="input pl-10"
      />
      <svg
        class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z"
        />
      </svg>
    </div>

    <!-- List -->
    <div v-if="loading && patients.length === 0" class="card p-12 text-center text-slate-500">
      Carregando…
    </div>
    <div v-else-if="patients.length === 0" class="card p-12 text-center text-slate-500">
      <p class="font-medium mb-1">Nenhum paciente encontrado</p>
      <p class="text-sm">{{ search ? 'Tente outra busca.' : 'Cadastre o primeiro paciente.' }}</p>
    </div>
    <div v-else class="card overflow-hidden">
      <table class="w-full">
        <thead class="bg-slate-50 text-xs font-medium text-slate-500 uppercase tracking-wider">
          <tr>
            <th class="text-left px-6 py-3">Nome</th>
            <th class="text-left px-6 py-3">CPF</th>
            <th class="text-left px-6 py-3">Telefone</th>
            <th class="text-left px-6 py-3">Idade</th>
            <th class="text-right px-6 py-3"></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          <tr
            v-for="p in patients"
            :key="p.id"
            class="hover:bg-slate-50/70 transition-colors"
          >
            <td class="px-6 py-3">
              <NuxtLink
                :to="`/pacientes/${p.id}`"
                class="flex items-center gap-3 group"
              >
                <div
                  class="w-9 h-9 rounded-full bg-bula-100 text-bula-700 font-semibold
                         flex items-center justify-center text-sm shrink-0"
                >
                  {{ initials(p.fullName) }}
                </div>
                <div>
                  <div class="font-medium text-slate-900 group-hover:text-bula-600">
                    {{ p.fullName }}
                  </div>
                  <div class="text-xs text-slate-500" v-if="p.email">{{ p.email }}</div>
                </div>
              </NuxtLink>
            </td>
            <td class="px-6 py-3 text-sm text-slate-600">{{ maskCPF(p.cpf) || '—' }}</td>
            <td class="px-6 py-3 text-sm text-slate-600">{{ maskPhone(p.phone) || '—' }}</td>
            <td class="px-6 py-3 text-sm text-slate-600">
              <span v-if="ageFromBirthDate(p.birthDate)">
                {{ ageFromBirthDate(p.birthDate) }} anos
              </span>
              <span v-else class="text-slate-400">—</span>
            </td>
            <td class="px-6 py-3 text-right whitespace-nowrap">
              <button
                @click="openEdit(p)"
                class="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                title="Editar"
              >
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </button>
              <button
                @click="remove(p)"
                class="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50"
                title="Remover"
              >
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V3a2 2 0 012-2h2a2 2 0 012 2v4" />
                </svg>
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Modal de criar/editar -->
    <Modal
      :open="modalOpen"
      :title="editing ? 'Editar paciente' : 'Novo paciente'"
      :subtitle="editing ? editing.fullName : 'Cadastre os dados do paciente'"
      size="lg"
      @close="modalOpen = false"
    >
      <PatientForm v-model="formData" :loading="saving" @submit="save" />
      <div
        v-if="error"
        class="mx-6 mb-2 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700"
      >
        {{ error }}
      </div>
      <template #footer>
        <button
          type="button"
          @click="modalOpen = false"
          class="btn-secondary"
          :disabled="saving"
        >
          Cancelar
        </button>
        <button type="button" @click="save" class="btn-primary" :disabled="saving">
          {{ saving ? 'Salvando…' : editing ? 'Salvar' : 'Cadastrar' }}
        </button>
      </template>
    </Modal>
  </div>
</template>
