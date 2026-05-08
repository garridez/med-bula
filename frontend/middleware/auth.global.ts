import { useAuthStore } from '~/stores/auth'

export default defineNuxtRouteMiddleware((to) => {
  const auth = useAuthStore()
  // hydrate from localStorage on first navigation (client-side)
  if (import.meta.client && !auth.token) {
    auth.hydrateFromStorage()
  }

  const publicRoutes = ['/login', '/r']
  const isPublic =
    publicRoutes.some((p) => to.path === p || to.path.startsWith(p + '/'))

  if (!auth.isAuthenticated && !isPublic) {
    return navigateTo('/login')
  }

  if (auth.isAuthenticated && to.path === '/login') {
    return navigateTo('/')
  }
})
