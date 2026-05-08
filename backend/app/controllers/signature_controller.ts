import { DateTime } from 'luxon'
import QRCode from 'qrcode'
import vine from '@vinejs/vine'
import type { HttpContext } from '@adonisjs/core/http'
import SignatureSession from '#models/signature_session'
import Document from '#models/document'
import signatureRegistry from '#services/signature/registry'

const createSessionValidator = vine.compile(
  vine.object({
    provider: vine.string().trim(),
    cpf: vine.string().trim().optional().nullable(),
    documentIds: vine.array(vine.string().trim()).minLength(1),
  })
)

export default class SignatureController {
  /**
   * GET /api/signature/providers
   * Lista provedores disponíveis pro combo "Assinar com"
   */
  async providers() {
    return {
      data: signatureRegistry.list().map((p) => ({
        id: p.info.id,
        name: p.info.name,
        type: p.info.type,
        available: p.info.available,
      })),
    }
  }

  /**
   * POST /api/signature/sessions
   * Cria sessão de assinatura, gera authorize URL + QR code.
   */
  async createSession({ request, auth, response }: HttpContext) {
    const data = await request.validateUsing(createSessionValidator)
    const user = auth.getUserOrFail()

    const provider = signatureRegistry.get(data.provider)
    if (!provider) {
      return response.badRequest({ error: `Provedor '${data.provider}' não disponível` })
    }
    if (!provider.info.available) {
      return response.badRequest({
        error: `Provedor ${provider.info.name} não está configurado neste servidor`,
      })
    }

    // Verifica que todos os documentos existem na clínica e têm hash gerado
    const docs = await Document.query()
      .whereIn('id', data.documentIds)
      .where('clinic_id', user.clinicId!)
    if (docs.length !== data.documentIds.length) {
      return response.badRequest({ error: 'Um ou mais documentos não encontrados' })
    }
    for (const d of docs) {
      if (!d.pdfUnsignedSha256) {
        return response.badRequest({
          error: `Documento ${d.id} ainda não tem PDF gerado`,
        })
      }
    }

    // Monta URL de autorização (PKCE)
    const { authorizeUrl, codeVerifier } = provider.buildAuthorization({
      cpf: data.cpf ?? user.cpf,
      scope: 'signature_session',
      documentHashes: docs.map((d) => d.pdfUnsignedSha256!),
    })

    // Persiste sessão
    const session = await SignatureSession.create({
      userId: user.id,
      provider: provider.info.id,
      codeVerifier,
      cpf: data.cpf ?? user.cpf ?? null,
      documentIds: data.documentIds,
      status: 'pending',
      expiresAt: DateTime.now().plus({ minutes: 10 }),
    } as any)

    // Gera QR code (data URL) apontando pra authorizeUrl
    const qrDataUrl = await QRCode.toDataURL(authorizeUrl, {
      margin: 1,
      width: 320,
      color: { dark: '#1f2937', light: '#ffffff' },
    })

    return response.created({
      data: {
        sessionId: session.id,
        authorizeUrl,
        qrDataUrl,
        provider: { id: provider.info.id, name: provider.info.name },
        expiresAt: session.expiresAt,
      },
    })
  }

  /**
   * GET /api/signature/sessions/:id
   * Polling — frontend chama de 2 em 2s pra ver se o médico já autenticou.
   */
  async getSession({ params, auth, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const session = await SignatureSession.query()
      .where('id', params.id)
      .where('user_id', user.id)
      .first()
    if (!session) return response.notFound({ error: 'Sessão não encontrada' })

    // Auto-expira se passou do prazo
    if (session.status === 'pending' && DateTime.now() > session.expiresAt) {
      session.status = 'expired'
      await session.save()
    }

    return {
      data: {
        id: session.id,
        status: session.status,
        provider: session.provider,
        documentIds: session.documentIds,
        error: session.error,
        expiresAt: session.expiresAt,
      },
    }
  }

  /**
   * GET /api/signature/callback?code=...&state=...
   *
   * Chamado pelo browser do celular do médico após autenticar no Vidaas.
   * Esse endpoint é PÚBLICO (não tem auth middleware) — por isso a única
   * forma de garantir é o `state` UUID + tempo de expiração curto.
   *
   * Faz a troca code→token, salva, e devolve uma página de sucesso.
   */
  async callback({ request, response }: HttpContext) {
    const code = request.input('code') as string | undefined
    const state = request.input('state') as string | undefined
    const errorParam = request.input('error') as string | undefined

    if (errorParam) {
      return this.callbackHtml(
        response,
        `Autenticação cancelada: ${errorParam}`,
        false
      )
    }
    if (!code || !state) {
      return this.callbackHtml(response, 'Parâmetros ausentes (code/state)', false)
    }

    const session = await SignatureSession.find(state)
    if (!session) {
      return this.callbackHtml(response, 'Sessão de assinatura não encontrada', false)
    }
    if (session.status !== 'pending') {
      return this.callbackHtml(
        response,
        `Sessão já está no estado: ${session.status}`,
        false
      )
    }
    if (DateTime.now() > session.expiresAt) {
      session.status = 'expired'
      await session.save()
      return this.callbackHtml(response, 'Sessão expirada', false)
    }

    const provider = signatureRegistry.get(session.provider)
    if (!provider) {
      session.status = 'failed'
      session.error = `Provider ${session.provider} não disponível`
      await session.save()
      return this.callbackHtml(response, session.error, false)
    }

    try {
      const { accessToken } = await provider.exchangeCode({
        code,
        codeVerifier: session.codeVerifier,
      })
      session.accessToken = accessToken
      session.status = 'authenticated'
      await session.save()

      // Dispara assinatura em background — frontend (no desktop) vai ver
      // o status mudar pra 'signing' → 'signed' via polling.
      this.executeSignatureAsync(session.id).catch((e) => {
        console.error('[signature] async signing failed', e)
      })

      return this.callbackHtml(
        response,
        'Autenticação concluída! Volte ao computador — a assinatura está em andamento.',
        true
      )
    } catch (e: any) {
      session.status = 'failed'
      session.error = e?.response?.data
        ? JSON.stringify(e.response.data).slice(0, 500)
        : e?.message ?? 'erro desconhecido'
      await session.save()
      return this.callbackHtml(
        response,
        `Falha na autenticação: ${session.error}`,
        false
      )
    }
  }

  /**
   * Executa a assinatura de cada documento em background.
   * Lê o token salvo na sessão, gera/recupera o PDF, manda pro provider,
   * salva o resultado.
   */
  private async executeSignatureAsync(sessionId: string) {
    const session = await SignatureSession.find(sessionId)
    if (!session || session.status !== 'authenticated' || !session.accessToken) return

    session.status = 'signing'
    await session.save()

    const provider = signatureRegistry.getOrThrow(session.provider)

    try {
      for (const docId of session.documentIds) {
        const document = await Document.find(docId)
        if (!document || !document.pdfUnsignedBase64 || !document.pdfUnsignedSha256) continue

        const result = await provider.sign({
          accessToken: session.accessToken,
          documentId: docId,
          alias: `${document.type}-${docId.slice(0, 8)}.pdf`,
          pdfBase64: document.pdfUnsignedBase64,
          pdfHashBase64: document.pdfUnsignedSha256,
        })

        document.pdfSignedBase64 = result.signedPdfBase64
        document.signatureProvider = provider.info.id
        document.signatureMetadata = result.metadata
        document.status = 'signed'
        await document.save()
      }

      session.status = 'signed'
      session.accessToken = null
      await session.save()
    } catch (e: any) {
      session.status = 'failed'
      session.error =
        e?.response?.data
          ? JSON.stringify(e.response.data).slice(0, 500)
          : e?.message ?? 'erro desconhecido'
      session.accessToken = null
      await session.save()
    }
  }

  private callbackHtml(response: any, message: string, success: boolean) {
    response.header('Content-Type', 'text/html; charset=utf-8')
    return response.send(`<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Assinatura — med.bula</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
           margin: 0; min-height: 100vh; display: flex; align-items: center;
           justify-content: center; background: #fafafa; color: #1f2937; padding: 20px; }
    .card { max-width: 360px; text-align: center; padding: 40px 28px;
            background: white; border-radius: 16px;
            box-shadow: 0 4px 24px rgba(0,0,0,0.06); }
    .icon { width: 64px; height: 64px; border-radius: 50%; margin: 0 auto 16px;
            display: flex; align-items: center; justify-content: center;
            background: ${success ? '#dcfce7' : '#fee2e2'}; }
    h1 { font-size: 18px; margin: 0 0 8px; }
    p { font-size: 14px; color: #6b7280; line-height: 1.5; margin: 0; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="${success ? '#16a34a' : '#dc2626'}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
        ${success ? '<path d="M5 13l4 4L19 7" />' : '<path d="M6 18L18 6M6 6l12 12" />'}
      </svg>
    </div>
    <h1>${success ? 'Tudo certo!' : 'Algo deu errado'}</h1>
    <p>${message}</p>
  </div>
</body>
</html>`)
  }
}
