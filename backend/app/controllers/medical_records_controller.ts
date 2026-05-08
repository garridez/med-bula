import type { HttpContext } from '@adonisjs/core/http'
import MedicalRecord from '#models/medical_record'
import Patient from '#models/patient'
import { upsertMedicalRecordValidator } from '#validators/medical_record'

function scopeToClinic(query: any, ctx: HttpContext) {
  const user = ctx.auth.getUserOrFail()
  if (user.role !== 'super_admin') {
    query.where('clinic_id', user.clinicId!)
  }
  return query
}

export default class MedicalRecordsController {
  /**
   * GET /api/medical-records?patientId=&appointmentId=
   */
  async index({ request, auth }: HttpContext) {
    const patientId = Number(request.input('patientId') ?? 0)
    const appointmentId = Number(request.input('appointmentId') ?? 0)

    const query = MedicalRecord.query()
      .orderBy('created_at', 'desc')
      .preload('doctor')
    scopeToClinic(query, { auth } as HttpContext)

    if (patientId) query.where('patient_id', patientId)
    if (appointmentId) query.where('appointment_id', appointmentId)

    const records = await query
    return { data: records }
  }

  /**
   * GET /api/medical-records/:id
   */
  async show({ params, auth, response }: HttpContext) {
    const query = MedicalRecord.query()
      .where('id', Number(params.id))
      .preload('doctor')
      .preload('patient')
    scopeToClinic(query, { auth } as HttpContext)
    const record = await query.first()
    if (!record) return response.notFound({ error: 'Prontuário não encontrado' })
    return { data: record }
  }

  /**
   * POST /api/medical-records
   * Upsert: se vier appointmentId E já existir prontuário pra essa consulta,
   * atualiza. Senão, cria um novo.
   */
  async upsert({ request, auth, response }: HttpContext) {
    const data = await request.validateUsing(upsertMedicalRecordValidator)
    const user = auth.getUserOrFail()

    if (!user.clinicId && user.role !== 'super_admin') {
      return response.badRequest({ error: 'Usuário sem clínica' })
    }

    // Verifica que paciente é da clínica
    const patient = await Patient.query()
      .where('id', data.patientId)
      .where('clinic_id', user.clinicId!)
      .first()
    if (!patient) {
      return response.notFound({ error: 'Paciente não encontrado' })
    }

    let record: MedicalRecord | null = null
    if (data.appointmentId) {
      record = await MedicalRecord.query()
        .where('appointment_id', data.appointmentId)
        .where('clinic_id', user.clinicId!)
        .first()
    }

    if (record) {
      record.merge({
        subjective: data.subjective ?? null,
        objective: data.objective ?? null,
        assessment: data.assessment ?? null,
        plan: data.plan ?? null,
        notes: data.notes ?? null,
        vitals: (data.vitals ?? null) as any,
      } as any)
      await record.save()
    } else {
      record = await MedicalRecord.create({
        clinicId: user.clinicId!,
        patientId: data.patientId,
        doctorId: user.id,
        appointmentId: data.appointmentId ?? null,
        subjective: data.subjective ?? null,
        objective: data.objective ?? null,
        assessment: data.assessment ?? null,
        plan: data.plan ?? null,
        notes: data.notes ?? null,
        vitals: (data.vitals ?? null) as any,
      } as any)
    }

    await record.load('doctor')

    return { data: record }
  }
}
