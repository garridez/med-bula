<script setup lang="ts">
/**
 * Card editável: parece um placeholder "Inserir informação" quando vazio.
 * Click vira textarea. Blur salva via callback.
 * Reusado pros 6 cards: clinical/surgical/family history, hábitos, alergias, meds.
 */
const props = defineProps<{
  label: string
  modelValue: string | null
  /** Permissão de edição (false = só leitura, esconde click-to-edit) */
  canEdit?: boolean
  /** Callback async pra salvar; recebe o novo valor */
  onSave: (value: string | null) => Promise<void>
}>()

const emit = defineEmits<{
  'update:modelValue': [v: string | null]
}>()

const editing = ref(false)
const localValue = ref(props.modelValue ?? '')
const saving = ref(false)
const error = ref('')
const textareaRef = ref<HTMLTextAreaElement | null>(null)

watch(
  () => props.modelValue,
  (v) => {
    if (!editing.value) localValue.value = v ?? ''
  }
)

async function startEdit() {
  if (props.canEdit === false) return
  editing.value = true
  await nextTick()
  textareaRef.value?.focus()
  textareaRef.value?.select()
}

async function commit() {
  if (!editing.value) return
  const newValue = localValue.value.trim() || null
  const oldValue = props.modelValue
  if (newValue === oldValue) {
    editing.value = false
    return
  }
  saving.value = true
  error.value = ''
  try {
    await props.onSave(newValue)
    emit('update:modelValue', newValue)
    editing.value = false
  } catch (e: any) {
    error.value = e?.data?.error || e?.message || 'Erro ao salvar'
  } finally {
    saving.value = false
  }
}

function cancel() {
  localValue.value = props.modelValue ?? ''
  editing.value = false
  error.value = ''
}
</script>

<template>
  <div class="bg-white rounded-lg border border-slate-200 p-4 hover:border-slate-300 transition">
    <div class="text-xs font-semibold text-slate-700 mb-2">{{ label }}</div>

    <div v-if="!editing">
      <button
        type="button"
        @click="startEdit"
        class="w-full text-left min-h-[40px] -m-1 p-1 rounded"
        :class="canEdit !== false ? 'hover:bg-slate-50 cursor-text' : 'cursor-default'"
      >
        <p
          v-if="modelValue"
          class="text-sm text-slate-700 whitespace-pre-wrap"
        >
          {{ modelValue }}
        </p>
        <p v-else class="text-sm text-slate-400 italic">
          Inserir informação
        </p>
      </button>
    </div>

    <div v-else class="space-y-2">
      <textarea
        ref="textareaRef"
        v-model="localValue"
        @keydown.esc.prevent="cancel"
        @keydown.ctrl.enter.prevent="commit"
        @keydown.meta.enter.prevent="commit"
        rows="3"
        class="w-full px-2 py-1.5 border border-bula-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-bula-200 resize-y"
      />
      <div class="flex items-center gap-2 text-xs">
        <button
          type="button"
          @click="commit"
          :disabled="saving"
          class="px-3 py-1 bg-bula-500 hover:bg-bula-600 text-white rounded font-medium disabled:opacity-50"
        >
          {{ saving ? 'Salvando…' : 'Salvar' }}
        </button>
        <button
          type="button"
          @click="cancel"
          :disabled="saving"
          class="px-3 py-1 text-slate-500 hover:text-slate-700"
        >
          Cancelar
        </button>
        <span class="ml-auto text-[10px] text-slate-400">
          Ctrl+Enter pra salvar · Esc pra cancelar
        </span>
      </div>
      <p v-if="error" class="text-xs text-red-600">{{ error }}</p>
    </div>
  </div>
</template>
