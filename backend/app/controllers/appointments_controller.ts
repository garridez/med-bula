import { DateTime } from 'luxon'
import type { HttpContext } from '@adonisjs/core/http'
import Appointment from '#models/appointment'
import DoctorInsurance from '#models/doctor_insurance'
import User from '#models/user'
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

/**
 * Resolve preço default da consulta dado médico + (opcional) convênio.
 * - Convênio: busca em doctor_insurances. Se não tiver, retorna null.
 * - Particular: usa users.consultation_price.
 */
async function resolveDefaultPrice(
  doctorId: number,
  insuranceId: number | null
): Promise<number | null> {
  if (insuranceId) {
    const di = await DoctorInsurance.query()
      .where('doctor_id', doctorId)
      .where('insurance_id', insuranceId)
      .where('is_active', true)
      .first()
    return di ? Number(di.price) : null
  }
  const doctor = await User.find(doctorId)
  return doctor?.consultationPrice != null ? Number(doctor.consultationPrice) : null
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

    const query = Appointment.query()
      .orderBy('scheduled_at', 'desc')
      .preload('patient')
      .preload('doctor')
      .preload('insurance')

    // Filtro de data:
    //  - Se filtra por paciente (Patient360), traz histórico completo
    //  - Caso contrário, default = semana atual (visão de agenda)
    let from: Date | null = null
    let to: Date | null = null
    if (!data.patientId) {
      from = (data.from ?? DateTime.now().startOf('week').toJSDate()) as Date
      to = (data.to ?? DateTime.now().endOf('week').toJSDate()) as Date
      query.whereBetween('scheduled_at', [from as any, to as any])
    } else if (data.from || data.to) {
      from = (data.from ??
        DateTime.now().minus({ years: 5 }).toJSDate()) as Date
      to = (data.to ?? DateTime.now().plus({ years: 5 }).toJSDate()) as Date
      query.whereBetween('scheduled_at', [from as any, to as any])
    }

    scopeToClinic(query, { auth } as HttpContext)

    if (data.doctorId) query.where('doctor_id', data.doctorId)
    if (data.patientId) query.where('patient_id', data.patientId)

    const appointments = await query
    return {
      data: appointments,
      range: from && to ? { from, to } : null,
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
      .preload('insurance')
    scopeToClinic(query, { auth } as HttpContext)
    const appointment = await query.first()
    if (!appointment) {
      return response.notFound({ error: 'Consulta não encontrada' })
    }
    return { data: appointment }
  }

  /**
   * POST /api/appointments
   *
   * Auto-fill regra:
   * - Se cliente NÃO mandou price: busca default (consultation_price ou
   *   doctor_insurances.price).
   * - Se cliente NÃO mandou copayAmount:
   *     - Particular → copay = price (paciente paga tudo)
   *     - Convênio → copay = 0 (paciente não paga, só convênio)
   * Cliente pode override qualquer valor.
   */
  async store({ request, auth, response }: HttpContext) {
    const data = await request.validateUsing(createAppointmentValidator)
    const user = auth.getUserOrFail()

    if (!user.clinicId && user.role !== 'super_admin') {
      return response.badRequest({ error: 'Usuário sem clínica associada' })
    }

    const insuranceId = data.insuranceId ?? null
    let price = data.price ?? null
    if (price == null) {
      price = await resolveDefaultPrice(data.doctorId, insuranceId)
    }
    let copayAmount = data.copayAmount ?? null
    if (copayAmount == null) {
      copayAmount = insuranceId ? 0 : price
    }

    const appointment = await Appointment.create({
      clinicId: user.clinicId!,
      doctorId: data.doctorId,
      patientId: data.patientId,
      insuranceId,
      scheduledAt: DateTime.fromJSDate(data.scheduledAt),
      durationMinutes: data.durationMinutes ?? 30,
      reason: data.reason ?? null,
      notes: data.notes ?? null,
      price,
      copayAmount,
      status: data.status ?? 'scheduled',
      paymentStatus: 'none',
      reminderSent: false,
    } as any)

    await appointment.load('patient')
    await appointment.load('doctor')
    await appointment.load('insurance')

    return response.created({ data: appointment })
  }

  /**
   * PATCH /api/appointments/:id
   *
   * Se mudar `insuranceId` SEM mandar price, recalcula price + copay defaults.
   * Se mandar price/copay junto, usa os valores enviados (override explícito).
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

    // Recalcula price/copay se mudou insurance ou doctor sem price explícito
    let nextInsuranceId =
      data.insuranceId !== undefined ? data.insuranceId : appointment.insuranceId
    let nextDoctorId = data.doctorId ?? appointment.doctorId
    let nextPrice = data.price !== undefined ? data.price : appointment.price
    let nextCopay =
      data.copayAmount !== undefined ? data.copayAmount : appointment.copayAmount

    const insuranceChanged =
      data.insuranceId !== undefined && data.insuranceId !== appointment.insuranceId
    const doctorChanged =
      data.doctorId !== undefined && data.doctorId !== appointment.doctorId

    if ((insuranceChanged || doctorChanged) && data.price === undefined) {
      nextPrice = await resolveDefaultPrice(nextDoctorId, nextInsuranceId)
    }
    if ((insuranceChanged || doctorChanged) && data.copayAmount === undefined) {
      nextCopay = nextInsuranceId ? 0 : nextPrice
    }

    appointment.merge({
      ...(data.doctorId !== undefined && { doctorId: data.doctorId }),
      ...(data.patientId !== undefined && { patientId: data.patientId }),
      insuranceId: nextInsuranceId,
      ...(data.durationMinutes !== undefined && {
        durationMinutes: data.durationMinutes,
      }),
      ...(data.reason !== undefined && { reason: data.reason as any }),
      ...(data.notes !== undefined && { notes: data.notes as any }),
      price: nextPrice as any,
      copayAmount: nextCopay as any,
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
    await appointment.load('insurance')

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
   * Marca o COPAY como recebido (a parte que o paciente paga em mãos).
   * O valor pago pelo convênio é tracked separadamente (futuro Drop 5c).
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
    await appointment.load('insurance')

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
