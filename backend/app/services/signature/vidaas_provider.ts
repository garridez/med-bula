import axios from 'axios'
import crypto from 'node:crypto'
import env from '#start/env'
import { makePkce } from '#utils/pkce'
import type {
  SignatureProvider,
  SignatureProviderInfo,
  AuthorizationParams,
  SignParams,
  SignResult,
} from '#services/signature/signature_provider'

/**
 * Vidaas (Soluti) — assinatura ICP-Brasil em nuvem.
 *
 * Documentação base usada:
 *   - Authorize: GET {VIDAAS_BASE_URL}/v0/oauth/authorize  (PKCE S256)
 *   - Token:     POST {VIDAAS_BASE_URL}/v0/oauth/token
 *   - Sign:      POST {VIDAAS_BASE_URL}/v0/oauth/signature
 *
 * Hash algorithm OID 2.16.840.1.101.3.4.2.1 = SHA-256
 * Signature format: PAdES_AD_RT (PDF com referência de tempo)
 */
export default class VidaasProvider implements SignatureProvider {
  readonly info: SignatureProviderInfo = {
    id: 'vidaas',
    name: 'Vidaas (Soluti)',
    type: 'cloud_a3',
    get available() {
      return Boolean(
        env.get('VIDAAS_CLIENT_ID') &&
          env.get('VIDAAS_CLIENT_SECRET') &&
          env.get('VIDAAS_REDIRECT_URI')
      )
    },
  } as any

  private get baseUrl() {
    return env.get('VIDAAS_BASE_URL', 'https://certificado.vidaas.com.br')
  }
  private get clientId() {
    return env.get('VIDAAS_CLIENT_ID')
  }
  private get clientSecret() {
    return env.get('VIDAAS_CLIENT_SECRET')
  }
  private get redirectUri() {
    return env.get('VIDAAS_REDIRECT_URI')
  }

  buildAuthorization(params: AuthorizationParams) {
    if (!this.clientId || !this.redirectUri) {
      throw new Error(
        'Vidaas não configurado: defina VIDAAS_CLIENT_ID e VIDAAS_REDIRECT_URI'
      )
    }
    const { codeVerifier, codeChallenge } = makePkce()
    const state = crypto.randomUUID()

    const qs = new URLSearchParams()
    qs.set('client_id', this.clientId)
    qs.set('response_type', 'code')
    qs.set('redirect_uri', this.redirectUri)
    qs.set('code_challenge', codeChallenge)
    qs.set('code_challenge_method', 'S256')
    // signature_session é o scope recomendado pra assinar várias hashes na mesma sessão
    qs.set('scope', params.scope ?? 'signature_session')
    qs.set('state', state)
    if (params.cpf) qs.set('login_hint', params.cpf)

    return {
      authorizeUrl: `${this.baseUrl}/v0/oauth/authorize?${qs.toString()}`,
      codeVerifier,
    }
  }

  async exchangeCode({
    code,
    codeVerifier,
  }: {
    code: string
    codeVerifier: string
  }) {
    const body = new URLSearchParams()
    body.set('grant_type', 'authorization_code')
    body.set('code', code)
    body.set('redirect_uri', this.redirectUri!)
    body.set('client_id', this.clientId!)
    body.set('client_secret', this.clientSecret!)
    body.set('code_verifier', codeVerifier)

    const res = await axios.post(`${this.baseUrl}/v0/oauth/token`, body.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      timeout: 20000,
    })

    return {
      accessToken: res.data.access_token as string,
      expiresIn: (res.data.expires_in as number) ?? 300,
      raw: res.data,
    }
  }

  async sign(params: SignParams): Promise<SignResult> {
    const payload = {
      hashes: [
        {
          id: params.documentId,
          alias: params.alias,
          hash: params.pdfHashBase64,
          hash_algorithm: '2.16.840.1.101.3.4.2.1', // SHA-256
          signature_format: 'PAdES_AD_RT',
          pdf_signature_page: 'true',
          base64_content: params.pdfBase64,
        },
      ],
    }

    const res = await axios.post(`${this.baseUrl}/v0/oauth/signature`, payload, {
      headers: {
        'Content-Type': 'application/json;charset=UTF-8',
        'Accept': 'application/json',
        'Authorization': `Bearer ${params.accessToken}`,
      },
      timeout: 30000,
    })

    const signed = res.data?.signatures?.[0]?.file_base64_signed
    if (!signed) {
      throw new Error(
        'Vidaas não retornou file_base64_signed: ' +
          JSON.stringify(res.data).slice(0, 500)
      )
    }

    return {
      signedPdfBase64: signed,
      metadata: res.data,
    }
  }
}
