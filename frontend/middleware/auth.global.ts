import { useAuthStore } from '~/stores/auth'

const PUBLIC_ROUTE_PREFIXES = ['/login', '/r']

type AuthStore = ReturnType<typeof useAuthStore>

/**
 * Regra de acesso por prefixo de rota. Função recebe a store de auth e
 * decide se libera. Permite checar role + plano de uma vez.
 *
 * Lógica:
 *   - /consulta, /documentos: só quem tem permissão clínica (não secretária)
 *   - /convenios, /financeiro: gestor da clínica (admin OU médico
 *     consultório). Médico em plano clínica NÃO vê — admin que cuida.
 *   - /medicos: admin de clínica (multi-médico). Consultório não tem.
 *   - /secretarias: admin OU médico consultório (gerencia próprias).
 *   - /admin/*: super_admin.
 */
const ROUTE_RULES: Record<string, (a: AuthStore) => boolean> = {
  '/consulta': (a) => a.canStartConsultation,
  '/documentos': (a) => a.canAccessDocumentos,
  '/convenios': (a) => a.isClinicAdmin,
  '/financeiro': (a) => a.isClinicAdmin,
  '/medicos': (a) => a.isAdmin || a.isSuperAdmin,
  '/secretarias': (a) => a.isAdmin || (a.isDoctor && a.isConsultorio),
  '/admin': (a) => a.isSuperAdmin,
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

  for (const [prefix, allow] of Object.entries(ROUTE_RULES)) {
    if (to.path === prefix || to.path.startsWith(prefix + '/')) {
      if (!allow(auth)) {
        return navigateTo(auth.homeRoute)
      }
      break
    }
  }
})
