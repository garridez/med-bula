import type { HttpContext } from '@adonisjs/core/http'
import Patient from '#models/patient'
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
}
