import { useApi } from '~/composables/useApi'

export interface Vitals {
  bp?: string
  hr?: number
  rr?: number
  temp?: number
  spo2?: number
  weight?: number
  height?: number
}

export interface MedicalRecord {
  id: number
  clinicId: number
  patientId: number
  doctorId: number
  appointmentId: number | null
  subjective: string | null
  objective: string | null
  assessment: string | null
  plan: string | null
  notes: string | null
  vitals: Vitals | null
  createdAt: string
  updatedAt: string | null
  doctor?: { id: number; fullName: string; crm?: string | null; crmUf?: string | null }
}

export interface MedicalRecordInput {
  patientId: number
  appointmentId?: number | null
  subjective?: string | null
  objective?: string | null
  assessment?: string | null
  plan?: string | null
  notes?: string | null
  vitals?: Vitals | null
}

export function useMedicalRecords() {
  const api = useApi()
  return {
    listByPatient: (patientId: number) =>
      api.get<{ data: MedicalRecord[] }>(
        `/api/medical-records?patientId=${patientId}`
      ),
    listByAppointment: (appointmentId: number) =>
      api.get<{ data: MedicalRecord[] }>(
        `/api/medical-records?appointmentId=${appointmentId}`
      ),
    upsert: (body: MedicalRecordInput) =>
      api.post<{ data: MedicalRecord }>('/api/medical-records', body),
  }
}
