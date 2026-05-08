import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

export type UserRole = 'super_admin' | 'admin' | 'doctor' | 'secretary'

export default class RoleMiddleware {
  async handle(ctx: HttpContext, next: NextFn, allowedRoles: UserRole[]) {
    const user = ctx.auth.user
    if (!user) {
      return ctx.response.unauthorized({ error: 'Não autenticado' })
    }
    if (!allowedRoles.includes(user.role as UserRole)) {
      return ctx.response.forbidden({
        error: 'Acesso negado para o seu perfil',
        role: user.role,
      })
    }
    return next()
  }
}
