import type { HttpContext } from '@adonisjs/core/http'
import User from '#models/user'
import Clinic from '#models/clinic'
import { updateClinicValidator } from '#validators/profile'

export default class ClinicsController {
  /**
   * GET /api/clinics/doctors
   * Lista médicos ativos da clínica.
   */
  async doctors({ auth }: HttpContext) {
    const user = auth.getUserOrFail()
    const query = User.query()
      .where('role', 'doctor')
      .where('is_active', true)
      .orderBy('full_name', 'asc')

    if (user.role !== 'super_admin' && user.clinicId) {
      query.where('clinic_id', user.clinicId)
    }

    const doctors = await query
    return { data: doctors }
  }

  /**
   * GET /api/clinic/me — retorna dados da clínica do usuário logado.
   */
  async showMine({ auth, response }: HttpContext) {
    const user = auth.getUserOrFail()
    if (!user.clinicId) {
      return response.notFound({ error: 'Usuário sem clínica' })
    }
    const clinic = await Clinic.find(user.clinicId)
    if (!clinic) return response.notFound({ error: 'Clínica não encontrada' })
    return { data: clinic }
  }

  /**
   * PATCH /api/clinic/me — atualiza dados da clínica.
   * Permitido pra:
   *   - admin (qualquer plano)
   *   - doctor SE o plano for 'consultorio'
   * Em plano 'clinica', médico não edita dados clínicos — só o admin.
   */
  async update({ request, auth, response }: HttpContext) {
    const user = auth.getUserOrFail()
    if (!user.clinicId) {
      return response.notFound({ error: 'Usuário sem clínica' })
    }

    const clinic = await Clinic.find(user.clinicId)
    if (!clinic) return response.notFound({ error: 'Clínica não encontrada' })

    const isAdmin = user.role === 'admin' || user.role === 'super_admin'
    const isDoctorInConsultorio =
      user.role === 'doctor' && clinic.plan === 'consultorio'

    if (!isAdmin && !isDoctorInConsultorio) {
      return response.forbidden({
        error:
          'Apenas o admin da clínica (ou o médico, em plano consultório) pode editar os dados da clínica.',
      })
    }

    const data = await request.validateUsing(updateClinicValidator)
    clinic.merge(data as any)
    await clinic.save()
    return { data: clinic }
  }
}
