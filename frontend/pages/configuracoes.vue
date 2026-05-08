<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'
import { useProfile, type ProfileData, type ClinicSettings } from '~/composables/useProfile'
import { formatBRL } from '~/utils/format'

const auth = useAuthStore()
const profileApi = useProfile()

const profile = ref<ProfileData | null>(null)
const clinic = ref<ClinicSettings | null>(null)
const loading = ref(true)
const savingProfile = ref(false)
const savingClinic = ref(false)
const savingPassword = ref(false)
const profileMsg = ref<{ type: 'ok' | 'err'; text: string } | null>(null)
const clinicMsg = ref<{ type: 'ok' | 'err'; text: string } | null>(null)
const passwordMsg = ref<{ type: 'ok' | 'err'; text: string } | null>(null)

const passwordForm = reactive({ currentPassword: '', newPassword: '', confirm: '' })

const canEditClinic = computed(
  () =>
    auth.isAdmin ||
    auth.isSuperAdmin ||
    (auth.isDoctor && auth.isConsultorio)
)
const canEditOwnPrice = computed(
  () => (auth.isDoctor && auth.isConsultorio) || auth.isAdmin || auth.isSuperAdmin
)
const showProfessionalFields = computed(() => auth.isDoctor)

async function load() {
  loading.value = true
  try {
    const res = await profileApi.me()
    profile.value = res.data
    if (canEditClinic.value && profile.value.clinic) {
      const cRes = await profileApi.getClinic()
      clinic.value = cRes.data
    }
  } catch (e: any) {
    profileMsg.value = { type: 'err', text: e?.message || 'Erro ao carregar' }
  } finally {
    loading.value = false
  }
}

async function saveProfile() {
  if (!profile.value) return
  savingProfile.value = true
  profileMsg.value = null
  try {
    const body: any = {
      fullName: profile.value.fullName,
      phone: profile.value.phone,
      address: profile.value.address,
    }
    if (showProfessionalFields.value) {
      body.crm = profile.value.crm
      body.crmUf = profile.value.crmUf
      body.specialty = profile.value.specialty
    }
    if (canEditOwnPrice.value) {
      body.consultationPrice = profile.value.consultationPrice
    }
    const res = await profileApi.update(body)
    profile.value = res.data
    auth.setUser({
      ...auth.user!,
      fullName: profile.value.fullName,
      crm: profile.value.crm,
      crmUf: profile.value.crmUf,
      specialty: profile.value.specialty,
      consultationPrice: profile.value.consultationPrice,
    })
    profileMsg.value = { type: 'ok', text: 'Dados atualizados.' }
  } catch (e: any) {
    profileMsg.value = {
      type: 'err',
      text: e?.data?.errors?.[0]?.message || e?.data?.error || e?.message || 'Erro',
    }
  } finally {
    savingProfile.value = false
  }
}

async function saveClinic() {
  if (!clinic.value) return
  savingClinic.value = true
  clinicMsg.value = null
  try {
    const res = await profileApi.updateClinic({
      name: clinic.value.name,
      cnpj: clinic.value.cnpj,
      phone: clinic.value.phone,
      address: clinic.value.address,
    })
    clinic.value = res.data
    if (auth.user?.clinic) {
      auth.setUser({
        ...auth.user,
        clinic: { ...auth.user.clinic, name: res.data.name },
      })
    }
    clinicMsg.value = { type: 'ok', text: 'Clínica atualizada.' }
  } catch (e: any) {
    clinicMsg.value = {
      type: 'err',
      text: e?.data?.error || e?.message || 'Erro',
    }
  } finally {
    savingClinic.value = false
  }
}

async function changePassword() {
  if (passwordForm.newPassword !== passwordForm.confirm) {
    passwordMsg.value = { type: 'err', text: 'Confirmação não bate' }
    return
  }
  if (passwordForm.newPassword.length < 6) {
    passwordMsg.value = { type: 'err', text: 'Mínimo 6 caracteres' }
    return
  }
  savingPassword.value = true
  passwordMsg.value = null
  try {
    await profileApi.changePassword(passwordForm.currentPassword, passwordForm.newPassword)
    passwordMsg.value = { type: 'ok', text: 'Senha alterada com sucesso.' }
    passwordForm.currentPassword = ''
    passwordForm.newPassword = ''
    passwordForm.confirm = ''
  } catch (e: any) {
    passwordMsg.value = {
      type: 'err',
      text: e?.data?.error || e?.message || 'Erro',
    }
  } finally {
    savingPassword.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="p-6 max-w-4xl mx-auto animate-fade-in">
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-slate-900 tracking-tight">Configurações</h1>
      <p class="text-sm text-slate-500 mt-0.5">
        Seu perfil, dados profissionais e senha.
      </p>
    </div>

    <div v-if="loading" class="card p-12 text-center text-slate-500">Carregando…</div>

    <div v-else-if="profile" class="space-y-6">
      <!-- Meu perfil -->
      <section class="card p-6">
        <h2 class="text-base font-semibold text-slate-900 mb-4">Meu perfil</h2>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="label">Nome completo</label>
            <input v-model="profile.fullName" type="text" class="input" />
          </div>
          <div>
            <label class="label">E-mail (login)</label>
            <input :value="profile.email" type="email" class="input bg-slate-50" disabled />
          </div>
          <div>
            <label class="label">CPF</label>
            <input
              :value="profile.cpf"
              type="text"
              class="input bg-slate-50 font-mono"
              disabled
              :title="
                showProfessionalFields
                  ? 'Vinculado ao seu certificado digital. Não editável.'
                  : ''
              "
            />
            <p v-if="showProfessionalFields" class="text-xs text-slate-500 mt-1">
              Esse CPF é usado pra autenticar com Vidaas. Não editável.
            </p>
          </div>
          <div>
            <label class="label">Telefone</label>
            <input v-model="profile.phone" type="tel" class="input" />
          </div>
          <div class="md:col-span-2">
            <label class="label">Endereço</label>
            <input v-model="profile.address" type="text" class="input" placeholder="Rua, número, bairro, cidade/UF" />
          </div>

          <template v-if="showProfessionalFields">
            <div>
              <label class="label">CRM</label>
              <input v-model="profile.crm" type="text" class="input" />
            </div>
            <div>
              <label class="label">UF</label>
              <input v-model="profile.crmUf" type="text" maxlength="2" class="input uppercase" />
            </div>
            <div class="md:col-span-2">
              <label class="label">Especialidade</label>
              <input v-model="profile.specialty" type="text" class="input" />
            </div>
          </template>

          <div v-if="canEditOwnPrice && showProfessionalFields" class="md:col-span-2">
            <label class="label">Preço da consulta (R$)</label>
            <input
              v-model.number="profile.consultationPrice"
              type="number"
              step="0.01"
              min="0"
              class="input"
              placeholder="250.00"
            />
            <p class="text-xs text-slate-500 mt-1">
              Esse valor vem pré-preenchido nas novas consultas (a secretária pode
              alterar caso a caso).
              <span v-if="profile.consultationPrice">
                Valor atual: <strong>{{ formatBRL(profile.consultationPrice) }}</strong>
              </span>
            </p>
          </div>
        </div>

        <div class="mt-5 flex items-center gap-3">
          <button @click="saveProfile" :disabled="savingProfile" class="btn-primary">
            {{ savingProfile ? 'Salvando…' : 'Salvar perfil' }}
          </button>
          <span
            v-if="profileMsg"
            class="text-sm"
            :class="profileMsg.type === 'ok' ? 'text-emerald-600' : 'text-red-600'"
          >
            {{ profileMsg.text }}
          </span>
        </div>
      </section>

      <!-- Dados da clínica -->
      <section v-if="canEditClinic && clinic" class="card p-6">
        <h2 class="text-base font-semibold text-slate-900">Dados da clínica</h2>
        <p class="text-xs text-slate-500 mt-0.5 mb-4">
          {{
            auth.isConsultorio
              ? 'Esses dados aparecem no header das receitas, exames e atestados.'
              : 'Dados da clínica multi-médico.'
          }}
        </p>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="md:col-span-2">
            <label class="label">Nome / Razão social</label>
            <input v-model="clinic.name" type="text" class="input" />
          </div>
          <div>
            <label class="label">CNPJ</label>
            <input v-model="clinic.cnpj" type="text" class="input" />
          </div>
          <div>
            <label class="label">Telefone</label>
            <input v-model="clinic.phone" type="text" class="input" />
          </div>
          <div class="md:col-span-2">
            <label class="label">Endereço</label>
            <input v-model="clinic.address" type="text" class="input" />
          </div>
        </div>

        <div class="mt-5 flex items-center gap-3">
          <button @click="saveClinic" :disabled="savingClinic" class="btn-primary">
            {{ savingClinic ? 'Salvando…' : 'Salvar clínica' }}
          </button>
          <span
            v-if="clinicMsg"
            class="text-sm"
            :class="clinicMsg.type === 'ok' ? 'text-emerald-600' : 'text-red-600'"
          >
            {{ clinicMsg.text }}
          </span>
        </div>
      </section>

      <!-- Trocar senha -->
      <section class="card p-6">
        <h2 class="text-base font-semibold text-slate-900 mb-4">Trocar senha</h2>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-2xl">
          <div>
            <label class="label">Senha atual</label>
            <input v-model="passwordForm.currentPassword" type="password" class="input" autocomplete="current-password" />
          </div>
          <div>
            <label class="label">Nova senha</label>
            <input v-model="passwordForm.newPassword" type="password" class="input" autocomplete="new-password" />
          </div>
          <div>
            <label class="label">Confirmar</label>
            <input v-model="passwordForm.confirm" type="password" class="input" autocomplete="new-password" />
          </div>
        </div>

        <div class="mt-5 flex items-center gap-3">
          <button @click="changePassword" :disabled="savingPassword" class="btn-primary">
            {{ savingPassword ? 'Alterando…' : 'Alterar senha' }}
          </button>
          <span
            v-if="passwordMsg"
            class="text-sm"
            :class="passwordMsg.type === 'ok' ? 'text-emerald-600' : 'text-red-600'"
          >
            {{ passwordMsg.text }}
          </span>
        </div>
      </section>
    </div>
  </div>
</template>
