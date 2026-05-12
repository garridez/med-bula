import type { HttpContext } from '@adonisjs/core/http'
import Insurance from '#models/insurance'
import DoctorInsurance from '#models/doctor_insurance'
import User from '#models/user'
import {
  createInsuranceValidator,
  updateInsuranceValidator,
  upsertDoctorInsuranceValidator,
  updateDoctorInsuranceValidator,
} from '#validators/insurance'

/**
 * Drop 5b — Convênios + preço por médico.
 *
 * Quem pode editar:
 *   - admin (qualquer plano) — gerencia todos os convênios da clínica
 *   - doctor com plano consultório — atua como gestor da própria clínica
 *
 * Quem só lê:
 *   - doctor em plano clínica — vê convênios próprios, não cria/apaga
 *   - secretary — só lê pra preencher no agendamento
 */
export default class InsurancesController {
  /**
   * GET /api/insurances
   * Lista convênios da clínica do usuário com `doctor_insurances` aninhado
   * (cada um com nome do médico). Front renderiza tabela flat ou expansível.
   */
  async index({ auth, response }: HttpContext) {
    const user = auth.getUserOrFail()
    if (!user.clinicId) {
      return response.badRequest({ error: 'Usuário sem clínica' })
    }

    const insurances = await Insurance.query()
      .where('clinic_id', user.clinicId)
      .orderBy('name', 'asc')
      .preload('doctorInsurances', (q) => {
        q.preload('doctor', (dq) => dq.select('id', 'fullName', 'isActive'))
      })

    return { data: insurances }
  }

  /**
   * GET /api/insurances/by-doctor/:doctorId
   * Retorna convênios ativos que esse médico aceita com o preço.
   * Usado pelo AppointmentModal pra preencher o dropdown.
   */
  async byDoctor({ params, auth, response }: HttpContext) {
    const user = auth.getUserOrFail()
    if (!user.clinicId) {
      return response.badRequest({ error: 'Usuário sem clínica' })
    }

    const doctorId = Number(params.doctorId)
    const items = await DoctorInsurance.query()
      .where('doctor_id', doctorId)
      .where('is_active', true)
      .preload('insurance')
      .whereHas('insurance', (q) => {
        q.where('clinic_id', user.clinicId!).where('is_active', true)
      })
      .orderBy('id', 'asc')

    return {
      data: items.map((di) => ({
        id: di.id,
        insuranceId: di.insuranceId,
        insuranceName: di.insurance?.name ?? '',
        price: di.price,
      })),
    }
  }

  /**
   * POST /api/insurances
   * Cria um novo convênio na clínica do usuário.
   */
  async store({ request, auth, response }: HttpContext) {
    const user = auth.getUserOrFail()
    if (!this.canManage(user, await user.related('clinic').query().first())) {
      return response.forbidden({ error: 'Sem permissão pra cadastrar convênios' })
    }

    const data = await request.validateUsing(createInsuranceValidator)

    // Garante unicidade case-insensitive básica
    const existing = await Insurance.query()
      .where('clinic_id', user.clinicId!)
      .whereILike('name', data.name)
      .first()
    if (existing) {
      return response.conflict({ error: 'Já existe um convênio com esse nome' })
    }

    const insurance = await Insurance.create({
      clinicId: user.clinicId!,
      name: data.name,
      isActive: true,
    })
    return response.created({ data: insurance })
  }

  /**
   * PATCH /api/insurances/:id
   * Renomeia ou ativa/desativa um convênio.
   */
  async update({ params, request, auth, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const insurance = await Insurance.find(params.id)
    if (!insurance || insurance.clinicId !== user.clinicId) {
      return response.notFound({ error: 'Convênio não encontrado' })
    }
    if (!this.canManage(user, await user.related('clinic').query().first())) {
      return response.forbidden({ error: 'Sem permissão' })
    }

    const data = await request.validateUsing(updateInsuranceValidator)
    insurance.merge(data as any)
    await insurance.save()
    return { data: insurance }
  }

  /**
   * DELETE /api/insurances/:id
   * Soft-delete: marca como inativo. Mantém appointments existentes.
   */
  async destroy({ params, auth, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const insurance = await Insurance.find(params.id)
    if (!insurance || insurance.clinicId !== user.clinicId) {
      return response.notFound({ error: 'Convênio não encontrado' })
    }
    if (!this.canManage(user, await user.related('clinic').query().first())) {
      return response.forbidden({ error: 'Sem permissão' })
    }

    insurance.isActive = false
    await insurance.save()
    return { ok: true }
  }

  /**
   * POST /api/insurances/:id/doctors
   * Cria ou atualiza o preço de um médico pra esse convênio.
   * (UPSERT pra simplificar a UI: enviar de novo edita.)
   */
  async upsertDoctorInsurance({ params, request, auth, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const insurance = await Insurance.find(params.id)
    if (!insurance || insurance.clinicId !== user.clinicId) {
      return response.notFound({ error: 'Convênio não encontrado' })
    }
    if (!this.canManage(user, await user.related('clinic').query().first())) {
      return response.forbidden({ error: 'Sem permissão' })
    }

    const data = await request.validateUsing(upsertDoctorInsuranceValidator)

    // Verifica que o médico é da mesma clínica
    const doctor = await User.find(data.doctorId)
    if (!doctor || doctor.clinicId !== user.clinicId || doctor.role !== 'doctor') {
      return response.badRequest({ error: 'Médico inválido' })
    }

    const existing = await DoctorInsurance.query()
      .where('doctor_id', data.doctorId)
      .where('insurance_id', insurance.id)
      .first()

    if (existing) {
      existing.price = data.price
      existing.isActive = true
      await existing.save()
      return { data: existing }
    }

    const created = await DoctorInsurance.create({
      doctorId: data.doctorId,
      insuranceId: insurance.id,
      price: data.price,
      isActive: true,
    })
    return response.created({ data: created })
  }

  /**
   * PATCH /api/doctor-insurances/:id
   * Edita o preço ou ativa/desativa diretamente.
   */
  async updateDoctorInsurance({ params, request, auth, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const di = await DoctorInsurance.query()
      .where('id', params.id)
      .preload('insurance')
      .first()
    if (!di || di.insurance?.clinicId !== user.clinicId) {
      return response.notFound({ error: 'Não encontrado' })
    }
    if (!this.canManage(user, await user.related('clinic').query().first())) {
      return response.forbidden({ error: 'Sem permissão' })
    }

    const data = await request.validateUsing(updateDoctorInsuranceValidator)
    di.merge(data as any)
    await di.save()
    return { data: di }
  }

  /**
   * DELETE /api/doctor-insurances/:id
   * Remove (hard delete — não tem appointment dependendo disso, pois o
   * appointment guarda só insurance_id, não doctor_insurance_id).
   */
  async destroyDoctorInsurance({ params, auth, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const di = await DoctorInsurance.query()
      .where('id', params.id)
      .preload('insurance')
      .first()
    if (!di || di.insurance?.clinicId !== user.clinicId) {
      return response.notFound({ error: 'Não encontrado' })
    }
    if (!this.canManage(user, await user.related('clinic').query().first())) {
      return response.forbidden({ error: 'Sem permissão' })
    }

    await di.delete()
    return { ok: true }
  }

  // -----------------------------------------------------------------------

  private canManage(user: User, clinic: any): boolean {
    if (user.role === 'super_admin' || user.role === 'admin') return true
    if (user.role === 'doctor' && clinic?.plan === 'consultorio') return true
    return false
  }
}
