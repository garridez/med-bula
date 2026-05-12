import { useApi } from '~/composables/useApi'
import type { Patient } from '~/composables/usePatients'

export type AppointmentStatus =
  | 'scheduled'
  | 'confirmed'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'no_show'

export type PaymentStatus = 'none' | 'pending' | 'paid' | 'refunded'

export interface Doctor {
  id: number
  fullName: string
  crm: string | null
  crmUf: string | null
  specialty: string | null
}

export interface AppointmentInsurance {
  id: number
  name: string
  isActive: boolean
}

export interface Appointment {
  id: number
  clinicId: number
  doctorId: number
  patientId: number
  insuranceId: number | null
  scheduledAt: string
  durationMinutes: number
  status: AppointmentStatus
  reason: string | null
  notes: string | null
  price: number | null
  copayAmount: number | null
  paymentStatus: PaymentStatus
  paymentMethod: string | null
  reminderSent: boolean
  createdAt: string
  patient?: Patient
  doctor?: Doctor
  insurance?: AppointmentInsurance | null
}

export interface AppointmentInput {
  doctorId: number
  patientId: number
  insuranceId?: number | null
  scheduledAt: string // ISO
  durationMinutes?: number
  reason?: string | null
  notes?: string | null
  price?: number | null
  copayAmount?: number | null
  status?: AppointmentStatus
}

export function useAppointments() {
  const api = useApi()

  return {
    listInRange: (fromIso: string, toIso: string, doctorId?: number) => {
      const qs = new URLSearchParams({ from: fromIso, to: toIso })
      if (doctorId) qs.set('doctorId', String(doctorId))
      return api.get<{ data: Appointment[]; range: any }>(
        `/api/appointments?${qs.toString()}`
      )
    },
    create: (body: AppointmentInput) =>
      api.post<{ data: Appointment }>('/api/appointments', body),
    update: (
      id: number,
      body: Partial<AppointmentInput> & { paymentStatus?: PaymentStatus }
    ) =>
      api.patch<{ data: Appointment }>(`/api/appointments/${id}`, body),
    cancel: (id: number) =>
      api.delete<{ ok: true }>(`/api/appointments/${id}`),
  }
}

export function useDoctors() {
  const api = useApi()
  const list = () => api.get<{ data: Doctor[] }>('/api/clinics/doctors')
  return {
    list,
    fetchDoctors: async () => {
      const res = await list()
      return res.data
    },
  }
}
