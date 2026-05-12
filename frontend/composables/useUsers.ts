import { useApi } from '~/composables/useApi'

export type UserRole = 'super_admin' | 'admin' | 'doctor' | 'secretary'
export type SplitType = 'percentual' | 'absoluto' | null

export interface ManagedUser {
  id: number
  clinicId: number | null
  role: UserRole
  fullName: string
  email: string
  phone: string | null
  cpf: string | null
  address: string | null
  crm: string | null
  crmUf: string | null
  specialty: string | null
  consultationPrice: number | null
  signatureProvider: string | null
  splitType: SplitType
  splitValue: number | null
  isActive: boolean
  createdAt: string
}

export interface CreateUserBody {
  role: 'doctor' | 'secretary' | 'admin'
  fullName: string
  email: string
  password: string
  phone?: string | null
  cpf?: string | null
  address?: string | null
  crm?: string | null
  crmUf?: string | null
  specialty?: string | null
  consultationPrice?: number | null
  signatureProvider?: string | null
  splitType?: SplitType
  splitValue?: number | null
}

export type UpdateUserBody = Partial<Omit<CreateUserBody, 'role' | 'password'>> & {
  isActive?: boolean
}

export function useUsers() {
  const api = useApi()
  return {
    list: (params: { role?: UserRole; includeInactive?: boolean } = {}) => {
      const qs = new URLSearchParams()
      if (params.role) qs.set('role', params.role)
      if (params.includeInactive) qs.set('includeInactive', 'true')
      const q = qs.toString()
      return api.get<{ data: ManagedUser[] }>(`/api/users${q ? '?' + q : ''}`)
    },
    show: (id: number) => api.get<{ data: ManagedUser }>(`/api/users/${id}`),
    create: (body: CreateUserBody) =>
      api.post<{ data: ManagedUser }>('/api/users', body),
    update: (id: number, body: UpdateUserBody) =>
      api.patch<{ data: ManagedUser }>(`/api/users/${id}`, body),
    deactivate: (id: number) => api.delete<{ ok: true }>(`/api/users/${id}`),
    resetPassword: (id: number, newPassword: string) =>
      api.post<{ ok: true }>(`/api/users/${id}/reset-password`, { newPassword }),
  }
}
