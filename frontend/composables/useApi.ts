import { useAuthStore } from '~/stores/auth'

type FetchOptions = Parameters<typeof $fetch>[1]

export function useApi() {
  const auth = useAuthStore()
  const { apiBase } = useRuntimeConfig().public

  async function call<T = unknown>(path: string, opts: FetchOptions = {}): Promise<T> {
    const headers: Record<string, string> = {
      ...(opts?.headers as Record<string, string>),
    }
    if (auth.token) {
      headers.Authorization = `Bearer ${auth.token}`
    }
    return $fetch<T>(`${apiBase}${path}`, { ...opts, headers })
  }

  return {
    get: <T = unknown>(path: string, opts?: FetchOptions) =>
      call<T>(path, { ...opts, method: 'GET' }),
    post: <T = unknown>(path: string, body?: unknown, opts?: FetchOptions) =>
      call<T>(path, { ...opts, method: 'POST', body }),
    put: <T = unknown>(path: string, body?: unknown, opts?: FetchOptions) =>
      call<T>(path, { ...opts, method: 'PUT', body }),
    patch: <T = unknown>(path: string, body?: unknown, opts?: FetchOptions) =>
      call<T>(path, { ...opts, method: 'PATCH', body }),
    delete: <T = unknown>(path: string, opts?: FetchOptions) =>
      call<T>(path, { ...opts, method: 'DELETE' }),
  }
}
