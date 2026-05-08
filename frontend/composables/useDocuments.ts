import { useApi } from '~/composables/useApi'

export type DocumentType = 'prescription' | 'exam_request' | 'medical_certificate'
export type DocumentStatus =
  | 'draft'
  | 'awaiting_signature'
  | 'signed'
  | 'delivered'
  | 'cancelled'

export interface PrescriptionItem {
  name: string
  dose?: string | null
  route?: string | null
  frequency?: string | null
  duration?: string | null
  notes?: string | null
  controlled?: boolean
}

export interface ExamItem {
  name: string
  tuss?: string | null
  notes?: string | null
}

export interface CertificatePayload {
  reason: string
  daysOff: number
  cid?: string | null
  notes?: string | null
}

export interface Document {
  id: string
  clinicId: number
  patientId: number
  doctorId: number
  appointmentId: number | null
  medicalRecordId: number | null
  type: DocumentType
  title: string | null
  payload: any
  status: DocumentStatus
  signatureProvider: string | null
  pdfUnsignedSha256: string | null
  deliveryToken: string | null
  deliveredAt: string | null
  viewCount: number
  createdAt: string
  patient?: { id: number; fullName: string }
  doctor?: { id: number; fullName: string; crm?: string | null }
}

export interface CreateDocumentInput {
  type: DocumentType
  patientId: number
  appointmentId?: number | null
  medicalRecordId?: number | null
  title?: string | null
  payload:
    | { items: PrescriptionItem[] }
    | { items: ExamItem[] }
    | CertificatePayload
}

export function useDocuments() {
  const api = useApi()
  const { apiBase } = useRuntimeConfig().public

  /**
   * Abre o PDF do documento numa nova aba.
   *
   * Como o endpoint exige Authorization Bearer, não dá pra usar um <a href>
   * direto — a nova aba não envia headers. A solução é baixar via fetch
   * autenticado, criar um Blob URL, abrir em nova aba e revogar depois.
   */
  async function openPdf(id: string) {
    const auth = useAuthStore()
    const res = await fetch(`${apiBase}/api/documents/${id}/pdf`, {
      headers: auth.token ? { Authorization: `Bearer ${auth.token}` } : {},
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(text || `Erro ao abrir PDF (${res.status})`)
    }
    const blob = await res.blob()
    const blobUrl = URL.createObjectURL(blob)
    window.open(blobUrl, '_blank')
    // Revoga depois de 1 minuto pra liberar memória — tempo suficiente pra
    // a nova aba carregar o PDF.
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000)
  }

  return {
    listByAppointment: (appointmentId: number) =>
      api.get<{ data: Document[] }>(
        `/api/documents?appointmentId=${appointmentId}`
      ),
    listByPatient: (patientId: number) =>
      api.get<{ data: Document[] }>(`/api/documents?patientId=${patientId}`),
    listAll: () => api.get<{ data: Document[] }>('/api/documents'),
    create: (body: CreateDocumentInput) =>
      api.post<{ data: Document }>('/api/documents', body),
    cancel: (id: string) => api.delete<{ ok: true }>(`/api/documents/${id}`),
    pdfUrl: (id: string) => `${apiBase}/api/documents/${id}/pdf`,
    openPdf,
  }
}
