<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'

definePageMeta({ layout: 'auth' })

const auth = useAuthStore()
const router = useRouter()

const email = ref('medico@clinica.com.br')
const password = ref('senha123')
const showPassword = ref(false)
const error = ref<string | null>(null)

async function submit() {
  error.value = null
  try {
    await auth.login(email.value, password.value)
    await router.push('/')
  } catch (e: any) {
    error.value =
      e?.data?.error ||
      e?.message ||
      'Não foi possível fazer login. Tente novamente.'
  }
}

const testAccounts = [
  { label: 'Médico', email: 'medico@clinica.com.br' },
  { label: 'Secretária', email: 'sec@clinica.com.br' },
  { label: 'Admin', email: 'admin@clinica.com.br' },
  { label: 'Super Admin', email: 'super@bula.com.br' },
]

function pickAccount(e: string) {
  email.value = e
  password.value = 'senha123'
}
</script>

<template>
  <div class="space-y-8">
    <!-- Logo mobile (some no desktop, que já mostra a logo no painel esquerdo) -->
    <div class="flex items-center gap-2.5 lg:hidden">
      <BulaLogo size="md" rounded="lg" />
      <span class="font-bold text-xl">med.bula</span>
    </div>

    <!-- Header -->
    <div>
      <h1 class="text-2xl font-bold text-slate-900 tracking-tight">
        Entrar no consultório
      </h1>
      <p class="text-sm text-slate-500 mt-1.5">
        Use seu e-mail e senha pra acessar o painel.
      </p>
    </div>

    <!-- Form -->
    <form @submit.prevent="submit" class="space-y-4">
      <div>
        <label for="email" class="label">E-mail</label>
        <input
          id="email"
          v-model="email"
          type="email"
          autocomplete="email"
          required
          placeholder="seu@email.com"
          class="input"
          :disabled="auth.loading"
        />
      </div>

      <div>
        <div class="flex items-center justify-between mb-1.5">
          <label for="password" class="label !mb-0">Senha</label>
          <button
            type="button"
            class="text-xs font-medium text-bula-600 hover:text-bula-700"
          >
            Esqueci a senha
          </button>
        </div>
        <div class="relative">
          <input
            id="password"
            v-model="password"
            :type="showPassword ? 'text' : 'password'"
            autocomplete="current-password"
            required
            placeholder="••••••••"
            class="input pr-11"
            :disabled="auth.loading"
          />
          <button
            type="button"
            @click="showPassword = !showPassword"
            class="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-slate-400
                   hover:text-slate-700 rounded-md"
            :title="showPassword ? 'Esconder' : 'Mostrar'"
          >
            <svg
              v-if="!showPassword"
              class="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
              />
            </svg>
            <svg
              v-else
              class="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
              />
            </svg>
          </button>
        </div>
      </div>

      <Transition name="fade">
        <div
          v-if="error"
          class="p-3 rounded-lg bg-red-50 border border-red-200 text-sm
                 text-red-700 flex items-start gap-2"
        >
          <svg
            class="w-4 h-4 mt-0.5 shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <span>{{ error }}</span>
        </div>
      </Transition>

      <button
        type="submit"
        class="btn-primary w-full !py-3"
        :disabled="auth.loading"
      >
        <svg
          v-if="auth.loading"
          class="animate-spin w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            class="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            stroke-width="4"
          />
          <path
            class="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
        {{ auth.loading ? 'Entrando…' : 'Entrar' }}
      </button>
    </form>

    <!-- Test accounts -->
    <div class="pt-4 border-t border-slate-100">
      <p class="text-xs text-slate-500 mb-2.5 uppercase tracking-wider font-medium">
        Contas de teste (senha: senha123)
      </p>
      <div class="grid grid-cols-2 gap-2">
        <button
          v-for="acc in testAccounts"
          :key="acc.email"
          @click="pickAccount(acc.email)"
          class="text-left px-3 py-2 rounded-lg border border-slate-200
                 hover:border-bula-300 hover:bg-bula-50/50 transition-all group"
          type="button"
        >
          <div class="text-xs font-semibold text-slate-700 group-hover:text-bula-700">
            {{ acc.label }}
          </div>
          <div class="text-[11px] text-slate-500 truncate">{{ acc.email }}</div>
        </button>
      </div>
    </div>

    <p class="text-center text-xs text-slate-400">
      med.bula.com.br · v0.1.0
    </p>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 200ms ease, transform 200ms ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
