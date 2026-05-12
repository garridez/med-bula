import { useApi } from '~/composables/useApi'
import type { Appointment } from '~/composables/useAppointments'

export interface FinancialReport {
  summary: {
    totalRevenue: number
    totalCopay: number
    completedCount: number
    paidCount: number
    pendingCount: number
    noShowCount: number
  }
  previousPeriod: {
    totalRevenue: number
  }
  byMethod: { method: string; count: number; total: number }[]
  byDay: { date: string; total: number }[]
  payments: Appointment[]
  range: { from: string; to: string }
}

export function useReports() {
  const api = useApi()
  return {
    financial: (params: { from?: string; to?: string; doctorId?: number } = {}) => {
      const qs = new URLSearchParams()
      if (params.from) qs.set('from', params.from)
      if (params.to) qs.set('to', params.to)
      if (params.doctorId) qs.set('doctorId', String(params.doctorId))
      const q = qs.toString()
      return api.get<FinancialReport>(
        `/api/reports/financial${q ? '?' + q : ''}`
      )
    },
  }
}
