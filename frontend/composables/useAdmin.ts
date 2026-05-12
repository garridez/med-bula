import { useApi } from '~/composables/useApi'
import type { UserRole } from '~/composables/useUsers'

export type SubscriptionStatus = 'active' | 'past_due' | 'cancelled' | 'trial'

export interface AdminClinic {
  id: number
  name: string
  cnpj: string | null
  phone: string | null
  address: string | null
  plan: 'consultorio' | 'clinica'
  isActive: boolean
  subscriptionStatus: SubscriptionStatus
  monthlyFee: number | null
  subscriptionStartedAt: string | null
  nextBillingAt: string | null
  trialEndsAt: string | null
  createdAt: string
  updatedAt: string
  counts?: Partial<Record<UserRole, number>>
}

export interface AdminClinicWithUsers extends AdminClinic {
  users: {
    id: number
    fullName: string
    email: string
    role: UserRole
    isActive: boolean
    lastLoginAt: string | null
  }[]
}

export interface AdminMetrics {
  totalClinics: number
  byStatus: Record<SubscriptionStatus, number>
  byPlan: Record<'consultorio' | 'clinica', number>
  mrr: number
  newThisMonth: number
  newLastMonth: number
  churnThisMonth: number
}

export interface CreateClinicBody {
  clinic: {
    name: string
    cnpj?: string | null
    phone?: string | null
    address?: string | null
    plan: 'consultorio' | 'clinica'
    monthlyFee?: number | null
    subscriptionStatus?: SubscriptionStatus
  }
  initialUser: {
    fullName: string
    email: string
    password: string
    phone?: string | null
    cpf?: string | null
    crm?: string | null
    crmUf?: string | null
    specialty?: string | null
    consultationPrice?: number | null
  }
}

export type UpdateClinicBody = Partial<CreateClinicBody['clinic']> & {
  isActive?: boolean
}

export function useAdmin() {
  const api = useApi()
  return {
    listClinics: (params: { q?: string; status?: string; plan?: string } = {}) => {
      const qs = new URLSearchParams()
      if (params.q) qs.set('q', params.q)
      if (params.status) qs.set('status', params.status)
      if (params.plan) qs.set('plan', params.plan)
      const q = qs.toString()
      return api.get<{ data: AdminClinic[] }>(
        `/api/admin/clinics${q ? '?' + q : ''}`
      )
    },
    showClinic: (id: number) =>
      api.get<{ data: AdminClinicWithUsers }>(`/api/admin/clinics/${id}`),
    createClinic: (body: CreateClinicBody) =>
      api.post<{ data: { clinic: AdminClinic; user: any } }>(
        '/api/admin/clinics',
        body
      ),
    updateClinic: (id: number, body: UpdateClinicBody) =>
      api.patch<{ data: AdminClinic }>(`/api/admin/clinics/${id}`, body),
    destroyClinic: (id: number) =>
      api.delete<{ ok: true }>(`/api/admin/clinics/${id}`),
    impersonate: (userId: number) =>
      api.post<{ token: string; user: any; impersonatedBy: any }>(
        '/api/admin/impersonate',
        { userId }
      ),
    metrics: () => api.get<AdminMetrics>('/api/admin/metrics'),
  }
}
