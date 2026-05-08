import { defineStore } from 'pinia'

export interface AuthUser {
  id: number
  fullName: string
  email: string
  role: 'super_admin' | 'admin' | 'doctor' | 'secretary'
  clinicId: number | null
  crm?: string | null
  crmUf?: string | null
  specialty?: string | null
  permissions?: Record<string, boolean> | null
  isDoctor?: boolean
  isAdmin?: boolean
  isSuperAdmin?: boolean
  clinic?: {
    id: number
    name: string
    primaryColor: string
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
    canAccessProntuario: (s) => {
      if (!s.user) return false
      if (s.user.role === 'doctor' || s.user.role === 'super_admin') return true
      if (s.user.role === 'admin') return true
      return s.user.permissions?.prontuario === true
    },
    canAccessAgenda: (s) => {
      if (!s.user) return false
      if (s.user.role === 'secretary') {
        return s.user.permissions?.agenda !== false
      }
      return true
    },
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
    async login(email: string, password: string) {
      this.loading = true
      try {
        const { apiBase } = useRuntimeConfig().public
        const res = await $fetch<{ token: string; user: AuthUser }>(
          `${apiBase}/api/auth/login`,
          {
            method: 'POST',
            body: { email, password },
          }
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
          // ignore
        }
      }
      this.token = null
      this.user = null
      this.persist()
      await navigateTo('/login')
    },
  },
})
