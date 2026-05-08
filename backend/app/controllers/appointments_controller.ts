import { DateTime } from 'luxon'
import type { HttpContext } from '@adonisjs/core/http'
import Appointment from '#models/appointment'
import {
  createAppointmentValidator,
  updateAppointmentValidator,
  listAppointmentsValidator,
} from '#validators/appointment'

function scopeToClinic(query: any, ctx: HttpContext) {
  const user = ctx.auth.getUserOrFail()
  if (user.role !== 'super_admin') {
    query.where('clinic_id', user.clinicId!)
  }
  return query
}

export default class AppointmentsController {
  /**
   * GET /api/appointments?from=&to=&doctorId=&patientId=
   *
   * Default = semana atual.
   */
  async index({ request, auth }: HttpContext) {
    const data = await request.validateUsing(listAppointmentsValidator, {
      data: request.qs(),
    })

    const from =
      data.from ?? DateTime.now().startOf('week').toJSDate()
    const to =
      data.to ?? DateTime.now().endOf('week').toJSDate()

    const query = Appointment.query()
      .whereBetween('scheduled_at', [from as any, to as any])
      .orderBy('scheduled_at', 'asc')
      .preload('patient')
      .preload('doctor')

    scopeToClinic(query, { auth } as HttpContext)

    if (data.doctorId) query.where('doctor_id', data.doctorId)
    if (data.patientId) query.where('patient_id', data.patientId)

    const appointments = await query
    return {
      data: appointments,
      range: { from: from, to: to },
    }
  }

  /**
   * GET /api/appointments/:id
   */
  async show({ params, auth, response }: HttpContext) {
    const query = Appointment.query()
      .where('id', Number(params.id))
      .preload('patient')
      .preload('doctor')
    scopeToClinic(query, { auth } as HttpContext)
    const appointment = await query.first()
    if (!appointment) {
      return response.notFound({ error: 'Consulta não encontrada' })
    }
    return { data: appointment }
  }

  /**
   * POST /api/appointments
   */
  async store({ request, auth, response }: HttpContext) {
    const data = await request.validateUsing(createAppointmentValidator)
    const user = auth.getUserOrFail()

    if (!user.clinicId && user.role !== 'super_admin') {
      return response.badRequest({ error: 'Usuário sem clínica associada' })
    }

    const appointment = await Appointment.create({
      clinicId: user.clinicId!,
      doctorId: data.doctorId,
      patientId: data.patientId,
      scheduledAt: DateTime.fromJSDate(data.scheduledAt),
      durationMinutes: data.durationMinutes ?? 30,
      reason: data.reason ?? null,
      notes: data.notes ?? null,
      price: data.price ?? null,
      status: data.status ?? 'scheduled',
      paymentStatus: 'none',
      reminderSent: false,
    } as any)

    await appointment.load('patient')
    await appointment.load('doctor')

    return response.created({ data: appointment })
  }

  /**
   * PATCH /api/appointments/:id
   */
  async update({ params, request, auth, response }: HttpContext) {
    const data = await request.validateUsing(updateAppointmentValidator)

    const query = Appointment.query().where('id', Number(params.id))
    scopeToClinic(query, { auth } as HttpContext)
    const appointment = await query.first()
    if (!appointment) {
      return response.notFound({ error: 'Consulta não encontrada' })
    }

    if (data.scheduledAt) {
      appointment.scheduledAt = DateTime.fromJSDate(data.scheduledAt)
    }
    appointment.merge({
      ...(data.doctorId !== undefined && { doctorId: data.doctorId }),
      ...(data.patientId !== undefined && { patientId: data.patientId }),
      ...(data.durationMinutes !== undefined && {
        durationMinutes: data.durationMinutes,
      }),
      ...(data.reason !== undefined && { reason: data.reason as any }),
      ...(data.notes !== undefined && { notes: data.notes as any }),
      ...(data.price !== undefined && { price: data.price as any }),
      ...(data.status !== undefined && { status: data.status }),
      ...(data.paymentStatus !== undefined && {
        paymentStatus: data.paymentStatus,
      }),
      ...(data.paymentMethod !== undefined && {
        paymentMethod: data.paymentMethod as any,
      }),
    } as any)

    await appointment.save()
    await appointment.load('patient')
    await appointment.load('doctor')

    return { data: appointment }
  }

  /**
   * DELETE /api/appointments/:id  (cancela)
   */
  async destroy({ params, auth, response }: HttpContext) {
    const query = Appointment.query().where('id', Number(params.id))
    scopeToClinic(query, { auth } as HttpContext)
    const appointment = await query.first()
    if (!appointment) {
      return response.notFound({ error: 'Consulta não encontrada' })
    }

    appointment.status = 'cancelled'
    await appointment.save()

    return { ok: true }
  }

  /**
   * POST /api/appointments/:id/payment
   * Body: { method: 'cash' | 'pix_manual' | 'card_manual' | 'deposit', status?: 'paid' | 'pending' }
   *
   * Endpoint dedicado pra secretária bater "recebido" no atendimento.
   * Não passa dinheiro pelo SaaS — só registra.
   */
  async markPayment({ params, request, auth, response }: HttpContext) {
    const method = request.input('method') as string
    const status = (request.input('status') as 'paid' | 'pending') ?? 'paid'

    const validMethods = ['cash', 'pix_manual', 'card_manual', 'deposit']
    if (!validMethods.includes(method)) {
      return response.badRequest({
        error: `Método inválido. Use: ${validMethods.join(', ')}`,
      })
    }

    const query = Appointment.query().where('id', Number(params.id))
    scopeToClinic(query, { auth } as HttpContext)
    const appointment = await query.first()
    if (!appointment) {
      return response.notFound({ error: 'Consulta não encontrada' })
    }

    appointment.paymentStatus = status
    appointment.paymentMethod = method
    await appointment.save()
    await appointment.load('patient')
    await appointment.load('doctor')

    return { data: appointment }
  }

  /**
   * DELETE /api/appointments/:id/payment
   * Reverte pagamento (volta a none).
   */
  async clearPayment({ params, auth, response }: HttpContext) {
    const query = Appointment.query().where('id', Number(params.id))
    scopeToClinic(query, { auth } as HttpContext)
    const appointment = await query.first()
    if (!appointment) {
      return response.notFound({ error: 'Consulta não encontrada' })
    }

    appointment.paymentStatus = 'none'
    appointment.paymentMethod = null
    await appointment.save()

    return { data: appointment }
  }
}
