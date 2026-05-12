import type { HttpContext } from '@adonisjs/core/http'
import Patient from '#models/patient'
import Appointment from '#models/appointment'
import MedicalRecord from '#models/medical_record'
import Document from '#models/document'
import {
  createPatientValidator,
  updatePatientValidator,
} from '#validators/patient'

/**
 * Aplica isolamento por clínica:
 * - super_admin vê tudo
 * - demais só veem pacientes da própria clínica
 */
function scopeToClinic(query: any, ctx: HttpContext) {
  const user = ctx.auth.getUserOrFail()
  if (user.role !== 'super_admin') {
    query.where('clinic_id', user.clinicId!)
  }
  return query
}

export default class PatientsController {
  /**
   * GET /api/patients?q=&limit=
   */
  async index({ request, auth }: HttpContext) {
    const q = (request.input('q') as string | undefined)?.trim()
    const limit = Math.min(Number(request.input('limit', 50)), 200)

    const query = Patient.query()
      .where('is_active', true)
      .orderBy('full_name', 'asc')
      .limit(limit)

    scopeToClinic(query, { auth } as HttpContext)

    if (q && q.length > 0) {
      query.where((b) => {
        b.whereILike('full_name', `%${q}%`)
        b.orWhereILike('cpf', `%${q}%`)
        b.orWhereILike('phone', `%${q}%`)
      })
    }

    const patients = await query
    return { data: patients }
  }

  /**
   * GET /api/patients/:id
   */
  async show({ params, auth, response }: HttpContext) {
    const query = Patient.query().where('id', Number(params.id))
    scopeToClinic(query, { auth } as HttpContext)
    const patient = await query.first()
    if (!patient) return response.notFound({ error: 'Paciente não encontrado' })

    await patient.load('appointments', (q) =>
      q.orderBy('scheduled_at', 'desc').limit(20).preload('doctor')
    )

    return { data: patient }
  }

  /**
   * POST /api/patients
   */
  async store({ request, auth, response }: HttpContext) {
    const data = await request.validateUsing(createPatientValidator)
    const user = auth.getUserOrFail()

    if (!user.clinicId && user.role !== 'super_admin') {
      return response.badRequest({ error: 'Usuário sem clínica associada' })
    }

    const patient = await Patient.create({
      ...data,
      clinicId: user.clinicId!,
      isActive: true,
    } as any)

    return response.created({ data: patient })
  }

  /**
   * PATCH /api/patients/:id
   */
  async update({ params, request, auth, response }: HttpContext) {
    const data = await request.validateUsing(updatePatientValidator)

    const query = Patient.query().where('id', Number(params.id))
    scopeToClinic(query, { auth } as HttpContext)
    const patient = await query.first()
    if (!patient) return response.notFound({ error: 'Paciente não encontrado' })

    patient.merge(data as any)
    await patient.save()

    return { data: patient }
  }

  /**
   * DELETE /api/patients/:id  (soft delete)
   */
  async destroy({ params, auth, response }: HttpContext) {
    const query = Patient.query().where('id', Number(params.id))
    scopeToClinic(query, { auth } as HttpContext)
    const patient = await query.first()
    if (!patient) return response.notFound({ error: 'Paciente não encontrado' })

    patient.isActive = false
    await patient.save()

    return { ok: true }
  }

  /**
   * GET /api/patients/:id/history?limit=10&excludeAppointmentId=N
   *
   * Retorna últimas consultas do paciente, com SOAP + documentos aninhados.
   * Usado pela sala de consulta pra mostrar histórico na sidebar direita.
   *
   * excludeAppointmentId: se passado, omite essa consulta (a atual). Evita
   * mostrar "histórico" da consulta em andamento.
   */
  async history({ params, request, auth, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const limit = Math.min(Number(request.input('limit', 10)), 50)
    const exclude = Number(request.input('excludeAppointmentId', 0))

    const patient = await Patient.find(params.id)
    if (!patient || (user.role !== 'super_admin' && patient.clinicId !== user.clinicId)) {
      return response.notFound({ error: 'Paciente não encontrado' })
    }

    // Carrega consultas + médico + record SOAP + documentos
    const appointmentsQuery = Appointment.query()
      .where('patient_id', patient.id)
      .where('clinic_id', patient.clinicId)
      .whereNot('status', 'cancelled')
      .orderBy('scheduled_at', 'desc')
      .limit(limit)
      .preload('doctor', (q) => q.select('id', 'fullName', 'crm', 'crmUf', 'specialty'))
      .preload('insurance')
    if (exclude) appointmentsQuery.whereNot('id', exclude)

    const appointments = await appointmentsQuery
    const apptIds = appointments.map((a) => a.id)
    if (apptIds.length === 0) {
      return { data: [] }
    }

    const records = await MedicalRecord.query().whereIn('appointment_id', apptIds)
    const recordsByAppt = new Map(records.map((r) => [r.appointmentId, r]))

    const documents = await Document.query()
      .whereIn('appointment_id', apptIds)
      .orderBy('created_at', 'asc')
    const docsByAppt = new Map<number, Document[]>()
    for (const d of documents) {
      // Já filtrado por whereIn(appointment_id, apptIds), então != null
      const apptId = d.appointmentId!
      const list = docsByAppt.get(apptId) ?? []
      list.push(d)
      docsByAppt.set(apptId, list)
    }

    const data = appointments.map((a) => {
      const rec = recordsByAppt.get(a.id)
      return {
        id: a.id,
        scheduledAt: a.scheduledAt,
        status: a.status,
        reason: a.reason,
        doctor: a.doctor
          ? {
              id: a.doctor.id,
              fullName: a.doctor.fullName,
              crm: a.doctor.crm,
              crmUf: a.doctor.crmUf,
              specialty: a.doctor.specialty,
            }
          : null,
        insurance: a.insurance ? { id: a.insurance.id, name: a.insurance.name } : null,
        record: rec
          ? {
              subjective: rec.subjective,
              objective: rec.objective,
              assessment: rec.assessment,
              plan: rec.plan,
              vitals: rec.vitals,
            }
          : null,
        documents: (docsByAppt.get(a.id) ?? []).map((d) => ({
          id: d.id,
          type: d.type,
          status: d.status,
          createdAt: d.createdAt,
        })),
      }
    })

    return { data }
  }
}
