import { defineStore } from 'pinia'

export type UserRole = 'super_admin' | 'admin' | 'doctor' | 'secretary'
export type ClinicPlan = 'consultorio' | 'clinica'

export interface AuthUser {
  id: number
  fullName: string
  email: string
  role: UserRole
  clinicId: number | null
  cpf?: string | null
  phone?: string | null
  crm?: string | null
  crmUf?: string | null
  specialty?: string | null
  consultationPrice?: number | null
  permissions?: Record<string, boolean> | null
  isDoctor?: boolean
  isAdmin?: boolean
  isSuperAdmin?: boolean
  clinic?: {
    id: number
    name: string
    plan: ClinicPlan
    primaryColor: string
    cnpj?: string | null
    phone?: string | null
    address?: string | null
  } | null
}

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: null as string | null,
    user: null as AuthUser | null,
    loading: false,
  }),
  getters: {
    isAuthenticated: (s) => !!s.token && !!s.user,
    role: (s) => s.user?.role,
    clinicPlan: (s): 'consultorio' | 'clinica' | null =>
      (s.user?.clinic?.plan as any) ?? null,
    /**
     * Pra onde mandar o usuário quando ele cair em "/" ou quando uma rota
     * bloqueada precisa redirecionar. Cada papel tem seu home natural.
     */
    homeRoute(): string {
      const role = this.user?.role
      if (role === 'super_admin') return '/admin/clinicas'
      if (role === 'admin') return '/financeiro'
      // doctor + secretary → agenda
      return '/agenda'
    },
    isSecretary: (s) => s.user?.role === 'secretary',
    isDoctor: (s) => s.user?.role === 'doctor',
    isAdmin: (s) => s.user?.role === 'admin',
    isSuperAdmin: (s) => s.user?.role === 'super_admin',
    isConsultorio: (s) => s.user?.clinic?.plan === 'consultorio',
    isClinica: (s) => s.user?.clinic?.plan === 'clinica',
    /**
     * "Admin da clínica" no sentido operacional: quem manda dentro de
     * UMA clínica específica. Super_admin NÃO entra aqui — ele opera a
     * plataforma toda de fora, e quando quer atuar dentro de uma clínica
     * usa "Personificar" pra entrar como algum usuário dela.
     */
    isClinicAdmin(): boolean {
      return (
        this.role === 'admin' ||
        (this.role === 'doctor' && this.clinicPlan === 'consultorio')
      )
    },
    canAccessAgenda: (s) =>
      !!s.user && (s.user.role === 'doctor' || s.user.role === 'secretary'),
    canAccessProntuario: (s) =>
      !!s.user &&
      (s.user.role === 'doctor' ||
        s.user.role === 'admin' ||
        s.user.role === 'super_admin'),
    canAccessDocumentos: (s) => !!s.user && s.user.role === 'doctor',
    canStartConsultation: (s) => s.user?.role === 'doctor',
  },
  actions: {
    hydrateFromStorage() {
      if (import.meta.server) return
      const raw = localStorage.getItem('mb_auth')
      if (!raw) return
      try {
        const parsed = JSON.parse(raw)
        this.token = parsed.token ?? null
        this.user = parsed.user ?? null
      } catch {
        localStorage.removeItem('mb_auth')
      }
    },
    persist() {
      if (import.meta.server) return
      if (this.token && this.user) {
        localStorage.setItem(
          'mb_auth',
          JSON.stringify({ token: this.token, user: this.user })
        )
      } else {
        localStorage.removeItem('mb_auth')
      }
    },
    setUser(u: AuthUser | null) {
      this.user = u
      this.persist()
    },
    async login(email: string, password: string) {
      this.loading = true
      try {
        const { apiBase } = useRuntimeConfig().public
        const res = await $fetch<{ token: string; user: AuthUser }>(
          `${apiBase}/api/auth/login`,
          { method: 'POST', body: { email, password } }
        )
        this.token = res.token
        this.user = res.user
        this.persist()
        return res.user
      } finally {
        this.loading = false
      }
    },
    async fetchMe() {
      if (!this.token) return null
      try {
        const { apiBase } = useRuntimeConfig().public
        const res = await $fetch<{ user: AuthUser }>(`${apiBase}/api/auth/me`, {
          headers: { Authorization: `Bearer ${this.token}` },
        })
        this.user = res.user
        this.persist()
        return res.user
      } catch {
        this.logout()
        return null
      }
    },
    async logout() {
      const { apiBase } = useRuntimeConfig().public
      if (this.token) {
        try {
          await $fetch(`${apiBase}/api/auth/logout`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${this.token}` },
          })
        } catch {
          /* ignore */
        }
      }
      this.token = null
      this.user = null
      this.persist()
      await navigateTo('/login')
    },
  },
})
