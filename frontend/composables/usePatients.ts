import { useApi } from '~/composables/useApi'

export interface Patient {
  id: number
  clinicId: number
  fullName: string
  cpf: string | null
  rg: string | null
  birthDate: string | null
  gender: 'M' | 'F' | 'O' | null
  weightKg: number | null
  heightCm: number | null
  phone: string | null
  email: string | null
  address: string | null
  city: string | null
  state: string | null
  zipcode: string | null
  notes: string | null
  extra: Record<string, unknown> | null
  isActive: boolean
  createdAt: string
  updatedAt: string | null
}

export type PatientInput = Partial<
  Omit<Patient, 'id' | 'clinicId' | 'isActive' | 'createdAt' | 'updatedAt'>
>

export function usePatients() {
  const api = useApi()

  return {
    list: (q?: string) =>
      api.get<{ data: Patient[] }>(
        '/api/patients' + (q ? `?q=${encodeURIComponent(q)}` : '')
      ),
    get: (id: number) =>
      api.get<{ data: Patient & { appointments?: any[] } }>(`/api/patients/${id}`),
    create: (body: PatientInput) =>
      api.post<{ data: Patient }>('/api/patients', body),
    update: (id: number, body: PatientInput) =>
      api.patch<{ data: Patient }>(`/api/patients/${id}`, body),
    remove: (id: number) => api.delete<{ ok: true }>(`/api/patients/${id}`),
  }
}
