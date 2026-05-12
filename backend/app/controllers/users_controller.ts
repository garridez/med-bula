import type { HttpContext } from '@adonisjs/core/http'
import User from '#models/user'
import {
  createUserValidator,
  updateUserValidator,
  resetPasswordValidator,
} from '#validators/user'

/**
 * Drop 5d — Admin de clínica gerencia usuários.
 *
 * Quem pode usar:
 *   - admin: gerencia usuários da própria clínica
 *   - super_admin: gerencia qualquer um
 *   - doctor com plano consultório: pode gerenciar secretárias
 *     (NÃO pode criar outro médico — pra isso vira plano clínica)
 *
 * O endpoint de cadastro inicial da CLÍNICA inteira fica fora daqui;
 * só super_admin via futura UI no Drop 5e.
 */
export default class UsersController {
  /**
   * GET /api/users?role=doctor|secretary|admin
   * Lista users da clínica do solicitante. Filtra por role se passado.
   */
  async index({ request, auth, response }: HttpContext) {
    const user = auth.getUserOrFail()
    if (!user.clinicId && user.role !== 'super_admin') {
      return response.badRequest({ error: 'Sem clínica' })
    }

    const role = request.input('role') as string | undefined
    const includeInactive = request.input('includeInactive') === 'true'

    const query = User.query().orderBy('full_name', 'asc')
    if (user.role !== 'super_admin') {
      query.where('clinic_id', user.clinicId!)
    }
    if (role) query.where('role', role)
    if (!includeInactive) query.where('is_active', true)

    const users = await query
    return { data: users }
  }

  /**
   * GET /api/users/:id
   */
  async show({ params, auth, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const target = await User.find(params.id)
    if (!target || (user.role !== 'super_admin' && target.clinicId !== user.clinicId)) {
      return response.notFound({ error: 'Usuário não encontrado' })
    }
    return { data: target }
  }

  /**
   * POST /api/users
   */
  async store({ request, auth, response }: HttpContext) {
    const me = auth.getUserOrFail()
    const data = await request.validateUsing(createUserValidator)

    if (!this.canManageRole(me, data.role)) {
      return response.forbidden({
        error: `Você não pode criar usuários com role ${data.role}`,
      })
    }

    if (!me.clinicId && me.role !== 'super_admin') {
      return response.badRequest({ error: 'Sem clínica' })
    }

    // Email único na clínica (e globalmente, pra MVP)
    const exists = await User.findBy('email', data.email)
    if (exists) {
      return response.conflict({ error: 'Já existe usuário com esse email' })
    }

    const created = await User.create({
      clinicId: me.clinicId!,
      role: data.role,
      fullName: data.fullName,
      email: data.email,
      password: data.password, // hashed via authFinder
      phone: data.phone ?? null,
      cpf: data.cpf ?? null,
      address: data.address ?? null,
      crm: data.role === 'doctor' ? data.crm ?? null : null,
      crmUf: data.role === 'doctor' ? data.crmUf ?? null : null,
      specialty: data.role === 'doctor' ? data.specialty ?? null : null,
      consultationPrice:
        data.role === 'doctor' ? data.consultationPrice ?? null : null,
      signatureProvider:
        data.role === 'doctor' ? data.signatureProvider ?? null : null,
      splitType: data.role === 'doctor' ? data.splitType ?? null : null,
      splitValue: data.role === 'doctor' ? data.splitValue ?? null : null,
      isActive: true,
    } as any)

    return response.created({ data: created })
  }

  /**
   * PATCH /api/users/:id
   */
  async update({ params, request, auth, response }: HttpContext) {
    const me = auth.getUserOrFail()
    const target = await User.find(params.id)
    if (!target || (me.role !== 'super_admin' && target.clinicId !== me.clinicId)) {
      return response.notFound({ error: 'Usuário não encontrado' })
    }

    if (!this.canManageRole(me, target.role)) {
      return response.forbidden({ error: 'Sem permissão pra editar esse usuário' })
    }

    const data = await request.validateUsing(updateUserValidator)

    // Campos exclusivos de médico só são aplicados se target for médico
    const onlyDoctor = [
      'crm',
      'crmUf',
      'specialty',
      'consultationPrice',
      'signatureProvider',
      'splitType',
      'splitValue',
    ]
    const sanitized: any = { ...data }
    if (target.role !== 'doctor') {
      for (const k of onlyDoctor) delete sanitized[k]
    }

    target.merge(sanitized)
    await target.save()
    return { data: target }
  }

  /**
   * DELETE /api/users/:id
   * Soft delete — marca isActive = false. Mantém integridade referencial.
   */
  async destroy({ params, auth, response }: HttpContext) {
    const me = auth.getUserOrFail()
    const target = await User.find(params.id)
    if (!target || (me.role !== 'super_admin' && target.clinicId !== me.clinicId)) {
      return response.notFound({ error: 'Usuário não encontrado' })
    }
    if (target.id === me.id) {
      return response.badRequest({ error: 'Você não pode desativar a si mesmo' })
    }
    if (!this.canManageRole(me, target.role)) {
      return response.forbidden({ error: 'Sem permissão' })
    }

    target.isActive = false
    await target.save()
    return { ok: true }
  }

  /**
   * POST /api/users/:id/reset-password
   * Admin define nova senha pra um usuário (esquecimento, primeira senha…).
   */
  async resetPassword({ params, request, auth, response }: HttpContext) {
    const me = auth.getUserOrFail()
    const target = await User.find(params.id)
    if (!target || (me.role !== 'super_admin' && target.clinicId !== me.clinicId)) {
      return response.notFound({ error: 'Usuário não encontrado' })
    }
    if (!this.canManageRole(me, target.role)) {
      return response.forbidden({ error: 'Sem permissão' })
    }

    const { newPassword } = await request.validateUsing(resetPasswordValidator)
    target.password = newPassword
    await target.save()
    return { ok: true }
  }

  // -----------------------------------------------------------------

  /**
   * Regras de quem pode gerenciar quem:
   *  - super_admin → tudo
   *  - admin → doctor, secretary, admin (na própria clínica)
   *  - doctor (consultório) → secretary apenas
   *  - secretary → ninguém
   */
  private canManageRole(me: User, targetRole: string): boolean {
    if (me.role === 'super_admin') return true
    if (me.role === 'admin') return ['doctor', 'secretary', 'admin'].includes(targetRole)
    if (me.role === 'doctor') return targetRole === 'secretary'
    return false
  }
}
