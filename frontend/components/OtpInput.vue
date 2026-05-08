<script setup lang="ts">
/**
 * 4-digit OTP input — usado pelo paciente pra acessar receita via WhatsApp.
 * Os 4 dígitos = últimos 4 do telefone cadastrado.
 *
 * v(emit('complete', code)) dispara quando os 4 são preenchidos.
 */
const props = defineProps<{
  modelValue?: string
  length?: number
  disabled?: boolean
  error?: boolean
}>()
const emit = defineEmits<{
  'update:modelValue': [v: string]
  complete: [v: string]
}>()

const len = computed(() => props.length ?? 4)
const digits = ref<string[]>(Array(len.value).fill(''))
const inputs = ref<HTMLInputElement[]>([])

watch(
  () => props.modelValue,
  (v) => {
    const incoming = (v || '').slice(0, len.value).split('')
    digits.value = Array.from({ length: len.value }, (_, i) => incoming[i] || '')
  },
  { immediate: true }
)

function syncOut() {
  const v = digits.value.join('')
  emit('update:modelValue', v)
  if (v.length === len.value && !v.includes('')) emit('complete', v)
}

function onInput(e: Event, idx: number) {
  const el = e.target as HTMLInputElement
  const raw = el.value.replace(/\D/g, '').slice(-1)
  digits.value[idx] = raw
  if (raw && idx < len.value - 1) inputs.value[idx + 1]?.focus()
  syncOut()
}

function onKeydown(e: KeyboardEvent, idx: number) {
  if (e.key === 'Backspace' && !digits.value[idx] && idx > 0) {
    inputs.value[idx - 1]?.focus()
  }
  if (e.key === 'ArrowLeft' && idx > 0) inputs.value[idx - 1]?.focus()
  if (e.key === 'ArrowRight' && idx < len.value - 1) inputs.value[idx + 1]?.focus()
}

function onPaste(e: ClipboardEvent) {
  const text = (e.clipboardData?.getData('text') || '').replace(/\D/g, '')
  if (!text) return
  e.preventDefault()
  for (let i = 0; i < len.value; i++) digits.value[i] = text[i] || ''
  inputs.value[Math.min(text.length, len.value - 1)]?.focus()
  syncOut()
}
</script>

<template>
  <div class="flex gap-2.5 justify-center" @paste="onPaste">
    <input
      v-for="(_, i) in len"
      :key="i"
      :ref="(el) => el && (inputs[i] = el as HTMLInputElement)"
      :value="digits[i]"
      :disabled="disabled"
      inputmode="numeric"
      maxlength="1"
      autocomplete="one-time-code"
      class="w-14 h-16 text-center text-2xl font-bold rounded-lg border-2
             bg-white text-slate-900 transition-all
             focus:outline-none focus:ring-4 focus:ring-bula-500/15"
      :class="
        error
          ? 'border-red-400 focus:border-red-500'
          : 'border-slate-200 focus:border-bula-500'
      "
      @input="onInput($event, i)"
      @keydown="onKeydown($event, i)"
    />
  </div>
</template>
