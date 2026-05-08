/**
 * Compatibilidade com a redirect_uri legada cadastrada na Soluti
 * (`http://localhost:3000/vidaas/callback`).
 *
 * O Vidaas redireciona o navegador pra essa URL após o médico autenticar.
 * Como o backend do med-bula está em outra porta (3333), aqui apenas
 * proxiamos a request pro endpoint real `/api/signature/callback` no
 * backend, mantendo a URL bar do popup em `localhost:3000` (que é o que
 * a Soluti aceita).
 *
 * Quando você cadastrar `http://localhost:3333/api/signature/callback` na
 * Soluti, pode trocar VIDAAS_REDIRECT_URI no .env e essa rota deixa de
 * ser necessária — mas pode continuar existindo sem prejuízo.
 */
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const backendUrl = config.backendInternalUrl as string

  const query = getQuery(event)
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(query)) {
    if (v != null) params.set(k, String(v))
  }

  const target = `${backendUrl}/api/signature/callback?${params.toString()}`
  return proxyRequest(event, target)
})
