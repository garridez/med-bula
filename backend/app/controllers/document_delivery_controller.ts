import { DateTime } from 'luxon'
import vine from '@vinejs/vine'
import type { HttpContext } from '@adonisjs/core/http'
import Document from '#models/document'
import DocumentDispensing from '#models/document_dispensing'
import { whatsapp } from '#services/whatsapp_service'
import { isValidCnpj, digitsOnlyCnpj, formatCnpj } from '#utils/cnpj'
import env from '#start/env'

const verifyValidator = vine.compile(
  vine.object({
    otp: vine.string().trim().regex(/^\d{4}$/),
  })
)

const dispenseValidator = vine.compile(
  vine.object({
    cnpj: vine.string().trim(),
    name: vine.string().trim().maxLength(200).optional().nullable(),
  })
)

const TYPE_LABELS = {
  prescription: 'sua receita',
  exam_request: 'seu pedido de exame',
  medical_certificate: 'seu atestado',
} as const

/** Mapeia tipo de doc → metadados de quem dá baixa */
const DISPENSING_META = {
  prescription: {
    actorType: 'pharmacy' as const,
    actor: 'farmácia',
    cnpjLabel: 'CNPJ da farmácia',
    nameLabel: 'Nome da farmácia (opcional)',
    actionLabel: 'Dar baixa',
    description: 'Registre a dispensação dos medicamentos.',
  },
  exam_request: {
    actorType: 'lab' as const,
    actor: 'laboratório',
    cnpjLabel: 'CNPJ do laboratório',
    nameLabel: 'Nome do laboratório (opcional)',
    actionLabel: 'Registrar',
    description: 'Registre a entrada do pedido no laboratório.',
  },
  medical_certificate: {
    actorType: 'employer' as const,
    actor: 'empresa',
    cnpjLabel: 'CNPJ da empresa',
    nameLabel: 'Razão social (opcional)',
    actionLabel: 'Registrar',
    description: 'Registre o recebimento do atestado.',
  },
}

/**
 * Endpoints PÚBLICOS — sem auth middleware. Há dois fluxos:
 *
 *  1) PACIENTE (recebe link via WhatsApp): /api/public/r/:token + OTP
 *     OTP = últimos 4 dígitos do telefone do paciente.
 *
 *  2) FARMÁCIA / LABORATÓRIO / EMPRESA (escaneia QR no PDF): mesmo /api/public/r/:token
 *     mas com query ?baixa=1. Não pede OTP — só CNPJ. CNPJ é registrado pra
 *     auditoria, e o documento é marcado como entregue/dispensado.
 *
 * Justificativa de não pedir OTP no fluxo 2: a farmácia não tem o telefone
 * do paciente. O QR no PDF físico é o token de acesso. CNPJ serve pra log.
 */
export default class DocumentDeliveryController {
  /**
   * GET /api/public/r/:token  → meta-info pra a tela.
   */
  async preview({ params, response }: HttpContext) {
    const token = params.token as string
    const document = await Document.query()
      .where('delivery_token', token)
      .preload('patient')
      .preload('doctor')
      .first()

    if (!document) {
      return response.notFound({ error: 'Documento não encontrado ou link expirado' })
    }
    if (document.status === 'cancelled') {
      return response.gone({ error: 'Documento cancelado' })
    }

    const patient = document.patient
    const phone = (patient?.phone ?? '').replace(/\D/g, '')
    const masked = patient?.fullName ? this.maskName(patient.fullName) : 'Paciente'
    const phoneHint = phone.length >= 4 ? `••••${phone.slice(-4)}` : '••••'

    const dispensing = DISPENSING_META[document.type] ?? DISPENSING_META.prescription

    // Conta dispensações prévias (warning pra farmácia)
    const priorCount = await DocumentDispensing.query()
      .where('document_id', document.id)
      .count('* as total')
    const priorDispensings = Number((priorCount[0] as any)?.$extras?.total ?? 0)

    return {
      data: {
        type: document.type,
        typeLabel: TYPE_LABELS[document.type] ?? 'seu documento',
        status: document.status,
        patientName: masked,
        patientCpf: this.maskCpf(patient?.cpf ?? null),
        phoneHint,
        doctorName: document.doctor?.fullName ?? null,
        clinicName: 'Clínica',
        dispensing,
        priorDispensings,
      },
    }
  }

  /**
   * POST /api/public/r/:token/verify  body: { otp }  — fluxo paciente
   */
  async verify({ params, request, response }: HttpContext) {
    const { otp } = await request.validateUsing(verifyValidator)
    const token = params.token as string

    const document = await Document.query()
      .where('delivery_token', token)
      .preload('patient')
      .first()
    if (!document) return response.notFound({ error: 'Link inválido' })
    if (document.status === 'cancelled') {
      return response.gone({ error: 'Documento cancelado' })
    }

    const phone = (document.patient?.phone ?? '').replace(/\D/g, '')
    if (phone.length < 4) {
      return response.badRequest({ error: 'Paciente sem telefone cadastrado' })
    }
    if (otp !== phone.slice(-4)) {
      return response.unauthorized({ error: 'Código incorreto' })
    }

    if (!document.firstViewedAt) document.firstViewedAt = DateTime.now()
    if (!document.deliveredAt) {
      document.deliveredAt = DateTime.now()
      if (document.status === 'signed') document.status = 'delivered'
    }
    document.viewCount = (document.viewCount ?? 0) + 1
    await document.save()

    return {
      data: {
        ok: true,
        pdfUrl: `/api/public/r/${token}/pdf?otp=${otp}`,
        type: document.type,
        status: document.status,
      },
    }
  }

  /**
   * POST /api/public/r/:token/dispense  body: { cnpj, name? }  — fluxo farmácia/lab/empresa
   *
   * Sem OTP. CNPJ valida formato + dígitos verificadores. Cria registro de
   * dispensing pra audit trail e retorna URL do PDF (que aceita o
   * dispensingId no lugar do OTP).
   */
  async dispense({ params, request, response }: HttpContext) {
    const data = await request.validateUsing(dispenseValidator)
    const token = params.token as string

    const document = await Document.query()
      .where('delivery_token', token)
      .preload('patient')
      .first()
    if (!document) return response.notFound({ error: 'Link inválido' })
    if (document.status === 'cancelled') {
      return response.gone({ error: 'Documento cancelado' })
    }

    const cnpj = digitsOnlyCnpj(data.cnpj)
    if (!isValidCnpj(cnpj)) {
      return response.badRequest({
        error: 'CNPJ inválido. Confira os dígitos.',
      })
    }

    const meta = DISPENSING_META[document.type] ?? DISPENSING_META.prescription

    const dispensing = await DocumentDispensing.create({
      documentId: document.id,
      cnpj,
      name: data.name?.trim() || null,
      actorType: meta.actorType,
      ipAddress: request.ip(),
      dispensedAt: DateTime.now(),
    } as any)

    if (!document.deliveredAt) {
      document.deliveredAt = DateTime.now()
      if (document.status === 'signed') document.status = 'delivered'
      await document.save()
    }

    return {
      data: {
        ok: true,
        dispensingId: dispensing.id,
        cnpjFormatted: formatCnpj(cnpj),
        pdfUrl: `/api/public/r/${token}/pdf?dispensingId=${dispensing.id}`,
      },
    }
  }

  /**
   * GET /api/public/r/:token/pdf?otp=xxxx  OR  ?dispensingId=xxx
   * Aceita qualquer um dos dois caminhos de autorização.
   */
  async pdf({ params, request, response }: HttpContext) {
    const otp = (request.input('otp') as string | undefined) ?? ''
    const dispensingId = (request.input('dispensingId') as string | undefined) ?? ''
    const token = params.token as string

    const document = await Document.query()
      .where('delivery_token', token)
      .preload('patient')
      .first()
    if (!document) return response.notFound({ error: 'Link inválido' })
    if (document.status === 'cancelled') return response.gone({ error: 'Cancelado' })

    let authorized = false

    // Path 1: paciente (OTP = últimos 4 do telefone)
    if (otp) {
      const phone = (document.patient?.phone ?? '').replace(/\D/g, '')
      if (phone.length >= 4 && otp === phone.slice(-4)) authorized = true
    }

    // Path 2: farmácia/lab/empresa (dispensingId válido)
    if (!authorized && dispensingId) {
      const dispensing = await DocumentDispensing.query()
        .where('id', dispensingId)
        .where('document_id', document.id)
        .first()
      if (dispensing) authorized = true
    }

    if (!authorized) {
      return response.unauthorized({ error: 'Não autorizado' })
    }

    const base64 = document.pdfSignedBase64 ?? document.pdfUnsignedBase64
    if (!base64) return response.notFound({ error: 'PDF indisponível' })

    response.header('Content-Type', 'application/pdf')
    response.header(
      'Content-Disposition',
      `inline; filename="${document.type}-${document.id.slice(0, 8)}.pdf"`
    )
    return response.send(Buffer.from(base64, 'base64'))
  }

  /**
   * POST /api/documents/:id/send-whatsapp  (auth)
   */
  async sendToWhatsApp({ params, auth, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const document = await Document.query()
      .where('id', params.id)
      .where('clinic_id', user.clinicId!)
      .preload('patient')
      .preload('doctor')
      .first()
    if (!document) return response.notFound({ error: 'Documento não encontrado' })

    const phone = (document.patient?.phone ?? '').replace(/\D/g, '')
    if (phone.length < 4) {
      return response.badRequest({
        error: 'Paciente sem telefone — não dá pra mandar WhatsApp',
      })
    }

    const frontendUrl = env.get('FRONTEND_URL', 'http://localhost:3000').split(',')[0].trim()
    const url = `${frontendUrl}/r/${document.deliveryToken}`

    const result = await whatsapp.send({
      to: phone,
      template: 'document_delivery',
      variables: {
        patientName: document.patient!.fullName,
        doctorName: document.doctor?.fullName ?? '',
        docTypeLabel: TYPE_LABELS[document.type] ?? 'documento',
        url,
      },
    })

    return { data: { ok: true, messageId: result.messageId, url } }
  }

  // ----- Helpers -----
  private maskName(name: string): string {
    const parts = name.split(' ').filter(Boolean)
    if (parts.length <= 1) return parts[0] ?? ''
    return parts[0] + ' ' + parts.slice(1).map((p) => p[0]?.toUpperCase() + '.').join(' ')
  }

  private maskCpf(cpf: string | null): string | null {
    if (!cpf) return null
    const d = cpf.replace(/\D/g, '')
    if (d.length !== 11) return cpf
    return `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**`
  }
}
