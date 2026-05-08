/**
 * Contrato modular pra provedores de assinatura digital ICP-Brasil.
 *
 * Implementações:
 *   - VidaasProvider (Drop 4)
 *   - BirdIdProvider (futuro)
 *   - SafeWebProvider (futuro)
 *
 * O fluxo é sempre o mesmo:
 *   1. buildAuthorization(): gera URL pra autenticar (PKCE) + state
 *   2. exchangeCode(): troca o código de retorno por accessToken (callback)
 *   3. sign(): assina cada hash com o token. Retorna PDF assinado.
 */

export interface SignatureProviderInfo {
  id: string // identificador interno: 'vidaas', 'birdid', etc.
  name: string // nome exibível: 'Vidaas (Soluti)', 'Bird ID (Soluti)', etc.
  type: 'cloud_a3' | 'cloud_a1' | 'a3_card' // tipo de certificado suportado
  available: boolean // se está pronto pra uso (credenciais configuradas)
}

export interface AuthorizationParams {
  cpf?: string | null
  scope?: string
  /** Lista de hashes que serão assinados na sessão. Permite single sign-on de várias receitas. */
  documentHashes?: string[]
}

export interface AuthorizationResult {
  authorizeUrl: string
  state: string
  codeVerifier: string
}

export interface SignParams {
  accessToken: string
  documentId: string
  /** Nome de arquivo do PDF — Vidaas pede como "alias". */
  alias: string
  /** PDF original em base64 (sem assinatura). */
  pdfBase64: string
  /** SHA-256 base64 do PDF. */
  pdfHashBase64: string
}

export interface SignResult {
  signedPdfBase64: string
  metadata: Record<string, unknown>
}

export interface SignatureProvider {
  readonly info: SignatureProviderInfo

  buildAuthorization(params: AuthorizationParams): {
    authorizeUrl: string
    codeVerifier: string
    state: string
  }

  exchangeCode(params: {
    code: string
    codeVerifier: string
  }): Promise<{ accessToken: string; expiresIn: number; raw: any }>

  sign(params: SignParams): Promise<SignResult>
}
