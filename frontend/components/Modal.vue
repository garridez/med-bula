<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    open: boolean
    title?: string
    subtitle?: string
    size?: 'sm' | 'md' | 'lg' | 'xl'
    closeOnBackdrop?: boolean
  }>(),
  { size: 'md', closeOnBackdrop: true }
)
const emit = defineEmits<{ close: [] }>()

const sizeClass = computed(() => {
  switch (props.size) {
    case 'sm':
      return 'max-w-md'
    case 'md':
      return 'max-w-xl'
    case 'lg':
      return 'max-w-3xl'
    case 'xl':
      return 'max-w-5xl'
  }
})

function onBackdropClick() {
  if (props.closeOnBackdrop) emit('close')
}

// Lock body scroll when modal is open
watchEffect(() => {
  if (import.meta.client) {
    document.body.style.overflow = props.open ? 'hidden' : ''
  }
})

// ESC fecha
onMounted(() => {
  if (import.meta.client) {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && props.open) emit('close')
    }
    document.addEventListener('keydown', handler)
    onBeforeUnmount(() => document.removeEventListener('keydown', handler))
  }
})
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="open"
        class="fixed inset-0 z-50 flex items-center justify-center p-4
               bg-slate-900/40 backdrop-blur-sm"
        @click.self="onBackdropClick"
      >
        <Transition
          enter-active-class="transition duration-250 ease-out"
          enter-from-class="opacity-0 scale-95 translate-y-2"
          enter-to-class="opacity-100 scale-100 translate-y-0"
          leave-active-class="transition duration-150 ease-in"
          leave-from-class="opacity-100 scale-100"
          leave-to-class="opacity-0 scale-95"
          appear
        >
          <div
            v-if="open"
            class="w-full bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col
                   max-h-[90vh]"
            :class="sizeClass"
          >
            <header
              v-if="title || subtitle || $slots.header"
              class="px-6 py-4 border-b border-slate-100 flex items-start justify-between gap-4 shrink-0"
            >
              <div class="flex-1 min-w-0">
                <slot name="header">
                  <h2 v-if="title" class="text-lg font-semibold text-slate-900">
                    {{ title }}
                  </h2>
                  <p v-if="subtitle" class="text-sm text-slate-500 mt-0.5">
                    {{ subtitle }}
                  </p>
                </slot>
              </div>
              <button
                @click="emit('close')"
                class="p-1.5 -m-1.5 rounded-md text-slate-400 hover:text-slate-700
                       hover:bg-slate-100 transition shrink-0"
              >
                <svg
                  class="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </header>

            <div class="flex-1 overflow-y-auto">
              <slot />
            </div>

            <footer
              v-if="$slots.footer"
              class="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center
                     justify-end gap-2 shrink-0"
            >
              <slot name="footer" />
            </footer>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>
