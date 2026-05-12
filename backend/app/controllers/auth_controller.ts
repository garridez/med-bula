import { DateTime } from 'luxon'
import vine from '@vinejs/vine'
import type { HttpContext } from '@adonisjs/core/http'
import User from '#models/user'

const loginValidator = vine.compile(
  vine.object({
    email: vine.string().email().normalizeEmail(),
    password: vine.string().minLength(6),
  })
)

export default class AuthController {
  /**
   * POST /api/auth/login
   */
  async login({ request, response }: HttpContext) {
    const { email, password } = await request.validateUsing(loginValidator)

    let user: User
    try {
      user = await User.verifyCredentials(email, password)
    } catch {
      return response.unauthorized({ error: 'Credenciais inválidas' })
    }

    if (!user.isActive) {
      return response.forbidden({ error: 'Usuário inativo' })
    }

    user.lastLoginAt = DateTime.now()
    await user.save()
    if (user.clinicId) await user.load('clinic')

    const token = await User.accessTokens.create(user, ['*'], {
      name: 'web',
      expiresIn: '30 days',
    })

    return response.ok({
      token: token.value!.release(),
      expiresAt: token.expiresAt,
      user: {
        ...user.serialize(),
        clinic: user.clinic ? user.clinic.serialize() : null,
      },
    })
  }

  /**
   * GET /api/auth/me
   */
  async me({ auth, response }: HttpContext) {
    const user = auth.getUserOrFail()
    if (user.clinicId) await user.load('clinic')
    return response.ok({
      user: {
        ...user.serialize(),
        clinic: user.clinic ? user.clinic.serialize() : null,
      },
    })
  }

  /**
   * POST /api/auth/logout
   */
  async logout({ auth, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const token = auth.user!.currentAccessToken
    if (token) {
      await User.accessTokens.delete(user, token.identifier)
    }
    return response.ok({ ok: true })
  }
}
