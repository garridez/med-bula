import { useApi } from '~/composables/useApi'

export interface MedicationSearchResult {
  id: string
  title: string | null
  subtitle: string | null
  activeIngredient: string | null
  laboratoryName: string | null
  category: string | null
  prescriptionType: string | null
  listType: string | null
  unitSingular: string | null
  unitPlural: string | null
  available: boolean
}

export interface MedicationPosology {
  id: number
  content: string
  usageQuantity: number | null
  indication: string | null
  population: string | null
  ageRange: string | null
  type: string | null
}

export interface PosologyResponse {
  source: 'direct' | 'fallback'
  sourceMedicationTitle?: string | null
  data: MedicationPosology[]
}

export function useMedications() {
  const api = useApi()
  return {
    search: (q: string, limit = 10) => {
      const qs = new URLSearchParams({ q, limit: String(limit) })
      return api.get<{ data: MedicationSearchResult[] }>(
        `/api/medications/search?${qs.toString()}`
      )
    },
    posologies: (id: string) =>
      api.get<PosologyResponse>(`/api/medications/${id}/posologies`),
  }
}
