import { useApi } from '~/composables/useApi'

export interface ProfileData {
  id: number
  email: string
  fullName: string
  role: string
  cpf: string | null
  phone: string | null
  address: string | null
  crm: string | null
  crmUf: string | null
  specialty: string | null
  consultationPrice: number | null
  signatureProvider: string | null
  clinic: {
    id: number
    name: string
    plan: 'consultorio' | 'clinica'
    cnpj: string | null
    phone: string | null
    address: string | null
  } | null
}

export interface ClinicSettings {
  id: number
  name: string
  cnpj: string | null
  phone: string | null
  address: string | null
  plan: 'consultorio' | 'clinica'
}

export function useProfile() {
  const api = useApi()
  return {
    me: () => api.get<{ data: ProfileData }>('/api/profile/me'),
    update: (body: Partial<ProfileData>) =>
      api.patch<{ data: ProfileData }>('/api/profile/me', body),
    changePassword: (currentPassword: string, newPassword: string) =>
      api.post<{ ok: true }>('/api/profile/password', {
        currentPassword,
        newPassword,
      }),
    getClinic: () => api.get<{ data: ClinicSettings }>('/api/clinic/me'),
    updateClinic: (body: Partial<ClinicSettings>) =>
      api.patch<{ data: ClinicSettings }>('/api/clinic/me', body),
  }
}
