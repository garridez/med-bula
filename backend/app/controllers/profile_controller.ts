import type { HttpContext } from '@adonisjs/core/http'
import hash from '@adonisjs/core/services/hash'
import {
  updateProfileValidator,
  changePasswordValidator,
} from '#validators/profile'

export default class ProfileController {
  /**
   * GET /api/profile/me — retorna dados do usuário logado com extensão
   * (preço da consulta, endereço, CPF mesmo que mascarado, plano da clínica).
   */
  async me({ auth }: HttpContext) {
    const user = auth.getUserOrFail()
    await user.load('clinic')
    return {
      data: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        cpf: user.cpf, // bate com o cert; read-only no front
        phone: user.phone,
        address: user.address,
        crm: user.crm,
        crmUf: user.crmUf,
        specialty: user.specialty,
        consultationPrice: user.consultationPrice,
        signatureProvider: user.signatureProvider,
        clinic: user.clinic
          ? {
              id: user.clinic.id,
              name: user.clinic.name,
              plan: user.clinic.plan,
              cnpj: user.clinic.cnpj,
              phone: user.clinic.phone,
              address: user.clinic.address,
            }
          : null,
      },
    }
  }

  /**
   * PATCH /api/profile/me — médico atualiza próprio perfil.
   * Secretárias não podem editar consultationPrice nem dados clínicos.
   */
  async update({ request, auth }: HttpContext) {
    const user = auth.getUserOrFail()
    const data = await request.validateUsing(updateProfileValidator)

    // Secretária não edita preço de consulta, CRM, especialidade, signatureProvider
    if (user.role === 'secretary') {
      delete data.consultationPrice
      delete data.crm
      delete data.crmUf
      delete data.specialty
      delete data.signatureProvider
    }

    // Médico em clínica (não consultório) também não edita o próprio preço
    // — o admin da clínica que define. Em consultório, o médico configura.
    if (user.role === 'doctor') {
      await user.load('clinic')
      if (user.clinic?.plan === 'clinica') {
        delete data.consultationPrice
      }
    }

    user.merge(data as any)
    await user.save()
    return this.me({ auth } as HttpContext)
  }

  /**
   * POST /api/profile/password — troca de senha.
   */
  async changePassword({ request, auth, response }: HttpContext) {
    const { currentPassword, newPassword } =
      await request.validateUsing(changePasswordValidator)
    const user = auth.getUserOrFail()

    const match = await hash.verify(user.password, currentPassword)
    if (!match) {
      return response.badRequest({ error: 'Senha atual incorreta' })
    }

    user.password = newPassword
    await user.save()
    return { ok: true }
  }
}
