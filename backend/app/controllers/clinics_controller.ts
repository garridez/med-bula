import type { HttpContext } from '@adonisjs/core/http'
import User from '#models/user'

export default class ClinicsController {
  /**
   * GET /api/clinics/doctors
   * Retorna lista de médicos ativos da clínica do usuário logado
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
}
