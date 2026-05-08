<script setup lang="ts">
import type { Patient, PatientInput } from '~/composables/usePatients'
import { maskCPF, maskPhone } from '~/utils/format'

const props = defineProps<{
  modelValue: PatientInput
  loading?: boolean
}>()
const emit = defineEmits<{
  'update:modelValue': [v: PatientInput]
  submit: []
}>()

function set<K extends keyof PatientInput>(key: K, value: PatientInput[K]) {
  emit('update:modelValue', { ...props.modelValue, [key]: value })
}

const cpfInput = computed({
  get: () => maskCPF((props.modelValue.cpf ?? '') as string),
  set: (v) => set('cpf', v.replace(/\D/g, '') || null),
})
const phoneInput = computed({
  get: () => maskPhone((props.modelValue.phone ?? '') as string),
  set: (v) => set('phone', v.replace(/\D/g, '') || null),
})

const otpHint = computed(() => {
  const d = (props.modelValue.phone ?? '').replace(/\D/g, '')
  return d.length >= 4 ? d.slice(-4) : null
})
</script>

<template>
  <form
    class="p-6 space-y-5"
    @submit.prevent="emit('submit')"
  >
    <!-- Nome -->
    <div>
      <label class="label">Nome completo *</label>
      <input
        :value="modelValue.fullName"
        @input="set('fullName', ($event.target as HTMLInputElement).value)"
        type="text"
        required
        placeholder="Ex: João da Silva"
        class="input"
        :disabled="loading"
      />
    </div>

    <!-- CPF + Nascimento + Sexo -->
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <div>
        <label class="label">CPF</label>
        <input
          v-model="cpfInput"
          type="text"
          inputmode="numeric"
          placeholder="000.000.000-00"
          class="input"
          :disabled="loading"
        />
      </div>
      <div>
        <label class="label">Data de nascimento</label>
        <input
          :value="modelValue.birthDate ?? ''"
          @input="set('birthDate', ($event.target as HTMLInputElement).value || null)"
          type="date"
          class="input"
          :disabled="loading"
        />
      </div>
      <div>
        <label class="label">Sexo</label>
        <select
          :value="modelValue.gender ?? ''"
          @change="set('gender', (($event.target as HTMLSelectElement).value || null) as any)"
          class="input"
          :disabled="loading"
        >
          <option value="">—</option>
          <option value="M">Masculino</option>
          <option value="F">Feminino</option>
          <option value="O">Outro</option>
        </select>
      </div>
    </div>

    <!-- Telefone + Email -->
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div>
        <label class="label">
          Telefone (WhatsApp)
          <span
            v-if="otpHint"
            class="ml-1 text-[10px] font-normal text-slate-500"
            >OTP: ••••{{ otpHint }}</span
          >
        </label>
        <input
          v-model="phoneInput"
          type="tel"
          inputmode="numeric"
          placeholder="(00) 00000-0000"
          class="input"
          :disabled="loading"
        />
      </div>
      <div>
        <label class="label">E-mail</label>
        <input
          :value="modelValue.email ?? ''"
          @input="set('email', ($event.target as HTMLInputElement).value || null)"
          type="email"
          placeholder="paciente@email.com"
          class="input"
          :disabled="loading"
        />
      </div>
    </div>

    <!-- Peso / Altura -->
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div>
        <label class="label">Peso (kg)</label>
        <input
          :value="modelValue.weightKg ?? ''"
          @input="
            set(
              'weightKg',
              ($event.target as HTMLInputElement).value
                ? Number(($event.target as HTMLInputElement).value)
                : null
            )
          "
          type="number"
          step="0.1"
          min="0"
          max="500"
          placeholder="70.0"
          class="input"
          :disabled="loading"
        />
      </div>
      <div>
        <label class="label">Altura (cm)</label>
        <input
          :value="modelValue.heightCm ?? ''"
          @input="
            set(
              'heightCm',
              ($event.target as HTMLInputElement).value
                ? Number(($event.target as HTMLInputElement).value)
                : null
            )
          "
          type="number"
          step="0.1"
          min="0"
          max="300"
          placeholder="175"
          class="input"
          :disabled="loading"
        />
      </div>
    </div>

    <!-- Cidade + UF -->
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <div class="sm:col-span-2">
        <label class="label">Cidade</label>
        <input
          :value="modelValue.city ?? ''"
          @input="set('city', ($event.target as HTMLInputElement).value || null)"
          type="text"
          placeholder="Belo Horizonte"
          class="input"
          :disabled="loading"
        />
      </div>
      <div>
        <label class="label">UF</label>
        <input
          :value="modelValue.state ?? ''"
          @input="set('state', (($event.target as HTMLInputElement).value || null)?.toUpperCase() ?? null)"
          type="text"
          maxlength="2"
          placeholder="MG"
          class="input uppercase"
          :disabled="loading"
        />
      </div>
    </div>

    <!-- Observações -->
    <div>
      <label class="label">Observações (alergias, comorbidades…)</label>
      <textarea
        :value="modelValue.notes ?? ''"
        @input="set('notes', ($event.target as HTMLTextAreaElement).value || null)"
        rows="3"
        placeholder="Notas relevantes sobre o paciente"
        class="input resize-none"
        :disabled="loading"
      />
    </div>
  </form>
</template>
