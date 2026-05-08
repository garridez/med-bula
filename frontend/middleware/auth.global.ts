import { useAuthStore } from '~/stores/auth'

const PUBLIC_ROUTE_PREFIXES = ['/login', '/r']

/**
 * Rotas só pra papéis específicos. Se o usuário não tem o role,
 * redireciona pra agenda (ou home dele).
 */
const ROUTE_ROLES: Record<string, string[]> = {
  '/consulta': ['doctor', 'admin', 'super_admin'], // secretária NÃO entra
  '/documentos': ['doctor', 'admin', 'super_admin'],
  '/financeiro': ['doctor', 'admin'],
  '/medicos': ['admin', 'super_admin'],
  '/secretarias': ['admin', 'super_admin'],
  '/admin': ['super_admin'],
}

export default defineNuxtRouteMiddleware((to) => {
  const auth = useAuthStore()

  if (import.meta.client && !auth.token) {
    auth.hydrateFromStorage()
  }

  const isPublic = PUBLIC_ROUTE_PREFIXES.some(
    (p) => to.path === p || to.path.startsWith(p + '/')
  )

  if (!auth.isAuthenticated && !isPublic) {
    return navigateTo('/login')
  }
  if (auth.isAuthenticated && to.path === '/login') {
    return navigateTo('/')
  }
  if (!auth.isAuthenticated) return

  // Role-based blocking
  for (const [prefix, allowed] of Object.entries(ROUTE_ROLES)) {
    if (to.path === prefix || to.path.startsWith(prefix + '/')) {
      if (!allowed.includes(auth.role!)) {
        return navigateTo('/agenda')
      }
      break
    }
  }
})
