<script setup lang="ts">
import {
  useUsers,
  type ManagedUser,
  type CreateUserBody,
  type UpdateUserBody,
} from '~/composables/useUsers'

const props = defineProps<{
  open: boolean
  role: 'doctor' | 'secretary'
  user?: ManagedUser | null // null = criar novo
}>()

const emit = defineEmits<{
  close: []
  saved: [user: ManagedUser]
  /** disparado depois de reset/desativar pra a página recarregar */
  changed: []
}>()

const usersApi = useUsers()
const isEdit = computed(() => !!props.user)
const loading = ref(false)
const error = ref('')

const form = reactive({
  fullName: '',
  email: '',
  password: '',
  phone: '',
  cpf: '',
  address: '',
  // doctor-only
  crm: '',
  crmUf: 'MG',
  specialty: '',
  consultationPrice: '' as string | number,
  signatureProvider: 'vidaas',
  splitType: '' as '' | 'percentual' | 'absoluto',
  splitValue: '' as string | number,
})

// Reset password sub-form
const showResetPwd = ref(false)
const newPassword = ref('')

function reset() {
  form.fullName = props.user?.fullName ?? ''
  form.email = props.user?.email ?? ''
  form.password = ''
  form.phone = props.user?.phone ?? ''
  form.cpf = props.user?.cpf ?? ''
  form.address = props.user?.address ?? ''
  form.crm = props.user?.crm ?? ''
  form.crmUf = props.user?.crmUf ?? 'MG'
  form.specialty = props.user?.specialty ?? ''
  form.consultationPrice =
    props.user?.consultationPrice != null ? props.user.consultationPrice : ''
  form.signatureProvider = props.user?.signatureProvider ?? 'vidaas'
  form.splitType = props.user?.splitType ?? ''
  form.splitValue = props.user?.splitValue != null ? props.user.splitValue : ''
  showResetPwd.value = false
  newPassword.value = ''
  error.value = ''
}

watch(
  () => props.open,
  (v) => {
    if (v) reset()
  }
)

async function submit() {
  error.value = ''
  if (!form.fullName.trim()) {
    error.value = 'Nome é obrigatório'
    return
  }
  if (!form.email.trim()) {
    error.value = 'Email é obrigatório'
    return
  }
  if (!isEdit.value && form.password.length < 6) {
    error.value = 'Senha precisa ter ao menos 6 caracteres'
    return
  }

  loading.value = true
  try {
    if (isEdit.value && props.user) {
      const body: UpdateUserBody = {
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        phone: form.phone || null,
        cpf: form.cpf || null,
        address: form.address || null,
      }
      if (props.role === 'doctor') {
        body.crm = form.crm || null
        body.crmUf = form.crmUf || null
        body.specialty = form.specialty || null
        body.consultationPrice =
          form.consultationPrice !== '' ? Number(form.consultationPrice) : null
        body.signatureProvider = form.signatureProvider || null
        body.splitType = form.splitType || null
        body.splitValue = form.splitValue !== '' ? Number(form.splitValue) : null
      }
      const res = await usersApi.update(props.user.id, body)
      emit('saved', res.data)
    } else {
      const body: CreateUserBody = {
        role: props.role,
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        password: form.password,
        phone: form.phone || null,
        cpf: form.cpf || null,
        address: form.address || null,
      }
      if (props.role === 'doctor') {
        body.crm = form.crm || null
        body.crmUf = form.crmUf || null
        body.specialty = form.specialty || null
        body.consultationPrice =
          form.consultationPrice !== '' ? Number(form.consultationPrice) : null
        body.signatureProvider = form.signatureProvider || null
        body.splitType = form.splitType || null
        body.splitValue = form.splitValue !== '' ? Number(form.splitValue) : null
      }
      const res = await usersApi.create(body)
      emit('saved', res.data)
    }
  } catch (e: any) {
    error.value =
      e?.data?.error ||
      e?.data?.errors?.[0]?.message ||
      'Erro ao salvar usuário'
  } finally {
    loading.value = false
  }
}

async function deactivate() {
  if (!props.user) return
  if (!confirm(`Desativar ${props.user.fullName}? Pode reativar depois.`))
    return
  loading.value = true
  try {
    await usersApi.deactivate(props.user.id)
    emit('changed')
    emit('close')
  } catch (e: any) {
    error.value = e?.data?.error || 'Erro ao desativar'
  } finally {
    loading.value = false
  }
}

async function reactivate() {
  if (!props.user) return
  loading.value = true
  try {
    await usersApi.update(props.user.id, { isActive: true })
    emit('changed')
    emit('close')
  } catch (e: any) {
    error.value = e?.data?.error || 'Erro ao reativar'
  } finally {
    loading.value = false
  }
}

async function resetPassword() {
  if (!props.user) return
  if (newPassword.value.length < 6) {
    error.value = 'Nova senha precisa ter ao menos 6 caracteres'
    return
  }
  loading.value = true
  try {
    await usersApi.resetPassword(props.user.id, newPassword.value)
    showResetPwd.value = false
    newPassword.value = ''
    alert('Senha redefinida com sucesso')
  } catch (e: any) {
    error.value = e?.data?.error || 'Erro ao redefinir senha'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <Modal
    :open="open"
    :title="
      isEdit
        ? `Editar ${role === 'doctor' ? 'médico' : 'secretária'}`
        : `Novo ${role === 'doctor' ? 'médico' : 'secretária'}`
    "
    size="lg"
    @close="emit('close')"
  >
    <form @submit.prevent="submit" class="p-6 space-y-4">
      <!-- Linha 1: nome + email -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label class="label">Nome completo *</label>
          <input
            v-model="form.fullName"
            type="text"
            class="input"
            :disabled="loading"
            required
          />
        </div>
        <div>
          <label class="label">Email *</label>
          <input
            v-model="form.email"
            type="email"
            class="input"
            :disabled="loading"
            required
          />
        </div>
      </div>

      <!-- Senha (só na criação) -->
      <div v-if="!isEdit">
        <label class="label">Senha inicial *</label>
        <input
          v-model="form.password"
          type="text"
          class="input"
          :disabled="loading"
          placeholder="Mínimo 6 caracteres"
        />
        <p class="mt-1 text-[11px] text-slate-500">
          O usuário pode trocar essa senha em "Configurações" depois do primeiro
          login.
        </p>
      </div>

      <!-- Telefone + CPF -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label class="label">Telefone</label>
          <input v-model="form.phone" type="text" class="input" :disabled="loading" />
        </div>
        <div>
          <label class="label">CPF</label>
          <input v-model="form.cpf" type="text" class="input" :disabled="loading" />
        </div>
      </div>

      <!-- Endereço -->
      <div>
        <label class="label">Endereço</label>
        <input v-model="form.address" type="text" class="input" :disabled="loading" />
      </div>

      <!-- ===== Campos exclusivos de médico ===== -->
      <template v-if="role === 'doctor'">
        <div class="border-t border-slate-100 pt-4">
          <h3 class="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">
            Dados profissionais
          </h3>
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label class="label">CRM *</label>
              <input
                v-model="form.crm"
                type="text"
                class="input"
                :disabled="loading"
              />
            </div>
            <div>
              <label class="label">UF *</label>
              <input
                v-model="form.crmUf"
                type="text"
                maxlength="2"
                class="input uppercase"
                :disabled="loading"
              />
            </div>
            <div>
              <label class="label">Especialidade</label>
              <input
                v-model="form.specialty"
                type="text"
                class="input"
                :disabled="loading"
              />
            </div>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
            <div>
              <label class="label">Preço da consulta particular (R$)</label>
              <input
                v-model="form.consultationPrice"
                type="number"
                step="0.01"
                min="0"
                class="input"
                :disabled="loading"
              />
            </div>
            <div>
              <label class="label">Provedor de assinatura</label>
              <select
                v-model="form.signatureProvider"
                class="input"
                :disabled="loading"
              >
                <option value="">Nenhum</option>
                <option value="vidaas">Vidaas</option>
              </select>
            </div>
          </div>
        </div>

        <div class="border-t border-slate-100 pt-4">
          <h3 class="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">
            Split clínica × médico
          </h3>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="label">Tipo</label>
              <select
                v-model="form.splitType"
                class="input"
                :disabled="loading"
              >
                <option value="">Sem split (médico fica com 100%)</option>
                <option value="percentual">% que fica na clínica</option>
                <option value="absoluto">R$ fixo que fica na clínica</option>
              </select>
            </div>
            <div>
              <label class="label">
                Valor
                <span v-if="form.splitType === 'percentual'" class="text-slate-400">
                  (0–100)
                </span>
                <span v-else-if="form.splitType === 'absoluto'" class="text-slate-400">
                  (R$)
                </span>
              </label>
              <input
                v-model="form.splitValue"
                type="number"
                step="0.01"
                min="0"
                :max="form.splitType === 'percentual' ? 100 : undefined"
                class="input"
                :disabled="loading || !form.splitType"
                placeholder="0"
              />
            </div>
          </div>
          <p class="mt-2 text-[11px] text-slate-500">
            Ex: 30% da consulta fica com a clínica e 70% com o médico. Ou R$80
            fixos da consulta vão pra clínica e o restante pro médico.
          </p>
        </div>
      </template>

      <!-- Reset de senha (só na edição) -->
      <div v-if="isEdit" class="border-t border-slate-100 pt-4">
        <button
          v-if="!showResetPwd"
          type="button"
          @click="showResetPwd = true"
          class="text-xs text-bula-600 hover:text-bula-700 font-medium"
        >
          Redefinir senha…
        </button>
        <div v-else class="space-y-2">
          <label class="label">Nova senha</label>
          <div class="flex gap-2">
            <input
              v-model="newPassword"
              type="text"
              class="input flex-1"
              placeholder="Mínimo 6 caracteres"
            />
            <button
              type="button"
              @click="resetPassword"
              :disabled="loading || newPassword.length < 6"
              class="px-3 py-2 bg-bula-500 hover:bg-bula-600 text-white rounded-lg text-sm font-medium disabled:opacity-50"
            >
              Definir
            </button>
            <button
              type="button"
              @click="showResetPwd = false"
              class="px-3 py-2 text-slate-500 hover:text-slate-700 text-sm"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>

      <Transition name="fade">
        <div
          v-if="error"
          class="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700"
        >
          {{ error }}
        </div>
      </Transition>
    </form>

    <template #footer>
      <button
        v-if="isEdit && user?.isActive"
        type="button"
        @click="deactivate"
        :disabled="loading"
        class="btn-ghost text-red-600 hover:bg-red-50 hover:text-red-700"
      >
        Desativar
      </button>
      <button
        v-else-if="isEdit && user && !user.isActive"
        type="button"
        @click="reactivate"
        :disabled="loading"
        class="btn-ghost text-emerald-700 hover:bg-emerald-50"
      >
        Reativar
      </button>
      <div class="flex-1" />
      <button
        type="button"
        @click="emit('close')"
        :disabled="loading"
        class="btn-secondary"
      >
        Fechar
      </button>
      <button
        type="button"
        @click="submit"
        :disabled="loading"
        class="btn-primary"
      >
        {{ loading ? 'Salvando…' : isEdit ? 'Salvar' : 'Cadastrar' }}
      </button>
    </template>
  </Modal>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 200ms ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
