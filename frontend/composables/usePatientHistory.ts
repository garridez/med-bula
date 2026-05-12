import { useApi } from '~/composables/useApi'

export interface HistoryDoctor {
  id: number
  fullName: string
  crm: string | null
  crmUf: string | null
  specialty: string | null
}

export interface HistoryRecord {
  subjective: string | null
  objective: string | null
  assessment: string | null
  plan: string | null
  vitals: Record<string, unknown> | null
}

export interface HistoryDocument {
  id: string
  type: 'prescription' | 'exam_request' | 'medical_certificate'
  status: 'draft' | 'awaiting_signature' | 'signed' | 'failed'
  createdAt: string
}

export interface HistoryAppointment {
  id: number
  scheduledAt: string
  status: string
  reason: string | null
  doctor: HistoryDoctor | null
  insurance: { id: number; name: string } | null
  record: HistoryRecord | null
  documents: HistoryDocument[]
}

export function usePatientHistory() {
  const api = useApi()
  return {
    fetch: (
      patientId: number,
      params: { limit?: number; excludeAppointmentId?: number } = {}
    ) => {
      const qs = new URLSearchParams()
      if (params.limit) qs.set('limit', String(params.limit))
      if (params.excludeAppointmentId)
        qs.set('excludeAppointmentId', String(params.excludeAppointmentId))
      const q = qs.toString()
      return api.get<{ data: HistoryAppointment[] }>(
        `/api/patients/${patientId}/history${q ? '?' + q : ''}`
      )
    },
  }
}
