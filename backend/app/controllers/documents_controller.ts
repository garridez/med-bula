import type { HttpContext } from '@adonisjs/core/http'
import crypto from 'node:crypto'
import Document from '#models/document'
import Patient from '#models/patient'
import User from '#models/user'
import Clinic from '#models/clinic'
import PdfService from '#services/pdf_service'
import { sha256Base64 } from '#utils/hash'
import { createDocumentValidator } from '#validators/document'

function scopeToClinic(query: any, ctx: HttpContext) {
  const user = ctx.auth.getUserOrFail()
  if (user.role !== 'super_admin') {
    query.where('clinic_id', user.clinicId!)
  }
  return query
}

function makeDeliveryToken(): string {
  return crypto.randomBytes(16).toString('hex')
}

const TYPE_LABELS = {
  prescription: 'Receita',
  exam_request: 'Pedido de exame',
  medical_certificate: 'Atestado',
} as const

export default class DocumentsController {
  /**
   * GET /api/documents?patientId=&appointmentId=&type=
   */
  async index({ request, auth }: HttpContext) {
    const query = Document.query()
      .orderBy('created_at', 'desc')
      .preload('patient')
      .preload('doctor')
      .limit(200)
    scopeToClinic(query, { auth } as HttpContext)

    const patientId = Number(request.input('patientId') ?? 0)
    const appointmentId = Number(request.input('appointmentId') ?? 0)
    const type = request.input('type') as string | undefined

    if (patientId) query.where('patient_id', patientId)
    if (appointmentId) query.where('appointment_id', appointmentId)
    if (type) query.where('type', type)

    const documents = await query
    return { data: documents }
  }

  /**
   * GET /api/documents/:id
   */
  async show({ params, auth, response }: HttpContext) {
    const query = Document.query()
      .where('id', String(params.id))
      .preload('patient')
      .preload('doctor')
    scopeToClinic(query, { auth } as HttpContext)
    const document = await query.first()
    if (!document) return response.notFound({ error: 'Documento não encontrado' })
    return { data: document }
  }

  /**
   * POST /api/documents
   * Cria + gera PDF + calcula hash. Status fica 'awaiting_signature' aguardando
   * o Drop 4 plugar o Vidaas.
   */
  async store({ request, auth, response }: HttpContext) {
    const data = await request.validateUsing(createDocumentValidator)
    const user = auth.getUserOrFail()
    if (!user.clinicId && user.role !== 'super_admin') {
      return response.badRequest({ error: 'Usuário sem clínica' })
    }

    // Carrega contexto do PDF
    const patient = await Patient.query()
      .where('id', data.patientId)
      .where('clinic_id', user.clinicId!)
      .first()
    if (!patient) return response.notFound({ error: 'Paciente não encontrado' })

    const clinic = await Clinic.find(user.clinicId)
    if (!clinic) return response.badRequest({ error: 'Clínica não encontrada' })

    const doctor = user.role === 'doctor' ? user : await User.find(user.id)
    if (!doctor) return response.badRequest({ error: 'Médico não encontrado' })

    // Cria o registro inicial
    const document = await Document.create({
      clinicId: user.clinicId!,
      patientId: data.patientId,
      doctorId: user.role === 'doctor' ? user.id : user.id, // futuramente: secretária pode emitir em nome de médico
      appointmentId: data.appointmentId ?? null,
      medicalRecordId: data.medicalRecordId ?? null,
      type: data.type,
      title: data.title ?? TYPE_LABELS[data.type],
      payload: data.payload as any,
      status: 'awaiting_signature',
      signatureProvider: null,
      deliveryToken: makeDeliveryToken(),
      viewCount: 0,
    } as any)

    // Gera PDF
    const pdfService = new PdfService()
    const pdfBuffer = await pdfService.generate({
      document,
      patient,
      doctor,
      clinic,
    })
    const pdfBase64 = pdfBuffer.toString('base64')
    const pdfHash = sha256Base64(pdfBuffer)

    document.merge({
      pdfUnsignedBase64: pdfBase64,
      pdfUnsignedSha256: pdfHash,
    } as any)
    await document.save()

    await document.load('patient')
    await document.load('doctor')

    return response.created({ data: document })
  }

  /**
   * GET /api/documents/:id/pdf
   * Stream o PDF (assinado se disponível, senão o unsigned).
   */
  async pdf({ params, auth, response }: HttpContext) {
    const query = Document.query().where('id', String(params.id))
    scopeToClinic(query, { auth } as HttpContext)
    const document = await query.first()
    if (!document) return response.notFound({ error: 'Documento não encontrado' })

    const base64 = document.pdfSignedBase64 ?? document.pdfUnsignedBase64
    if (!base64) {
      return response.notFound({ error: 'PDF não gerado ainda' })
    }
    const buffer = Buffer.from(base64, 'base64')

    response.header('Content-Type', 'application/pdf')
    response.header(
      'Content-Disposition',
      `inline; filename="${document.type}-${document.id.slice(0, 8)}.pdf"`
    )
    return response.send(buffer)
  }

  /**
   * DELETE /api/documents/:id  (cancela documento — não pode reverter)
   */
  async destroy({ params, auth, response }: HttpContext) {
    const query = Document.query().where('id', String(params.id))
    scopeToClinic(query, { auth } as HttpContext)
    const document = await query.first()
    if (!document) return response.notFound({ error: 'Documento não encontrado' })

    if (document.status === 'signed' || document.status === 'delivered') {
      return response.badRequest({
        error: 'Documento já assinado/entregue não pode ser cancelado',
      })
    }

    document.status = 'cancelled'
    await document.save()
    return { ok: true }
  }
}
