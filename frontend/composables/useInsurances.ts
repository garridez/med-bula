import { useApi } from '~/composables/useApi'

export interface DoctorInsurance {
  id: number
  doctorId: number
  insuranceId: number
  price: number
  isActive: boolean
  doctor?: { id: number; fullName: string; isActive: boolean }
}

export interface Insurance {
  id: number
  clinicId: number
  name: string
  isActive: boolean
  createdAt: string
  updatedAt: string | null
  doctorInsurances?: DoctorInsurance[]
}

export interface InsuranceForDoctor {
  id: number
  insuranceId: number
  insuranceName: string
  price: number
}

export function useInsurances() {
  const api = useApi()
  return {
    list: () => api.get<{ data: Insurance[] }>('/api/insurances'),
    byDoctor: (doctorId: number) =>
      api.get<{ data: InsuranceForDoctor[] }>(
        `/api/insurances/by-doctor/${doctorId}`
      ),
    create: (name: string) =>
      api.post<{ data: Insurance }>('/api/insurances', { name }),
    update: (id: number, body: { name?: string; isActive?: boolean }) =>
      api.patch<{ data: Insurance }>(`/api/insurances/${id}`, body),
    remove: (id: number) =>
      api.delete<{ ok: true }>(`/api/insurances/${id}`),
    upsertDoctorPrice: (
      insuranceId: number,
      body: { doctorId: number; price: number }
    ) =>
      api.post<{ data: DoctorInsurance }>(
        `/api/insurances/${insuranceId}/doctors`,
        body
      ),
    updateDoctorPrice: (
      doctorInsuranceId: number,
      body: { price?: number; isActive?: boolean }
    ) =>
      api.patch<{ data: DoctorInsurance }>(
        `/api/doctor-insurances/${doctorInsuranceId}`,
        body
      ),
    removeDoctorPrice: (doctorInsuranceId: number) =>
      api.delete<{ ok: true }>(`/api/doctor-insurances/${doctorInsuranceId}`),
  }
}
