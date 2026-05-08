import { useApi } from '~/composables/useApi'

export type SignatureSessionStatus =
  | 'pending'
  | 'authenticated'
  | 'signing'
  | 'signed'
  | 'failed'
  | 'expired'

export interface SignatureProviderMeta {
  id: string
  name: string
  type: string
  available: boolean
}

export interface SignatureSession {
  id: string
  status: SignatureSessionStatus
  provider: string
  documentIds: string[]
  error: string | null
  expiresAt: string
}

export interface CreateSessionResult {
  sessionId: string
  authorizeUrl: string
  qrDataUrl: string
  provider: { id: string; name: string }
  expiresAt: string
}

export function useSignature() {
  const api = useApi()
  return {
    providers: () =>
      api.get<{ data: SignatureProviderMeta[] }>('/api/signature/providers'),
    createSession: (body: {
      provider: string
      cpf?: string | null
      documentIds: string[]
    }) =>
      api.post<{ data: CreateSessionResult }>(
        '/api/signature/sessions',
        body
      ),
    getSession: (id: string) =>
      api.get<{ data: SignatureSession }>(`/api/signature/sessions/${id}`),
    sendToWhatsApp: (documentId: string) =>
      api.post<{ data: { ok: true; messageId: string; url: string } }>(
        `/api/documents/${documentId}/send-whatsapp`
      ),
  }
}
