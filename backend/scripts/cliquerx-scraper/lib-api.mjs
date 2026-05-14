/**
 * lib-api.mjs — wrapper compartilhado pra falar com a Cliquerx.
 * Replica fielmente os headers do browser, faz retry com backoff e
 * trata 401/403/429/5xx com mensagens claras.
 */

export const BASE = process.env.CLIQUERX_BASE_URL || 'https://api.cliquerx.com.br'

if (!process.env.CLIQUERX_BEARER) {
  console.error('❌ Defina CLIQUERX_BEARER no .env')
  process.exit(1)
}

export const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:150.0) Gecko/20100101 Firefox/150.0',
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
  // Note: deixa o Node decidir o Accept-Encoding (ele lida com gzip/br nativamente)
  Authorization: `Bearer ${process.env.CLIQUERX_BEARER}`,
  'cache-control': 'no-cache',
  pragma: 'no-cache',
  expires: '0',
  Origin: 'https://app.cliquerx.com.br',
  Connection: 'keep-alive',
  Referer: 'https://app.cliquerx.com.br/',
  'Sec-Fetch-Dest': 'empty',
  'Sec-Fetch-Mode': 'cors',
  'Sec-Fetch-Site': 'same-site',
}

const MAX_RETRIES = 5

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}

/** GET com retry exponencial. Lança em 4xx (exceto 429) sem retry. */
export async function getJson(url, attempt = 0) {
  let res
  try {
    res = await fetch(url, { headers: HEADERS })
  } catch (netErr) {
    // erro de rede — sempre retry
    if (attempt >= MAX_RETRIES) throw netErr
    const wait = 500 * 2 ** attempt + Math.random() * 300
    console.warn(`  ⚠️  rede (${netErr.message}), retry ${attempt + 1}/${MAX_RETRIES} em ${Math.round(wait)}ms`)
    await sleep(wait)
    return getJson(url, attempt + 1)
  }

  if (res.status === 401) {
    throw new Error(`401 não autorizado — Bearer expirado? Cheque o .env.`)
  }
  if (res.status === 403) {
    throw new Error(`403 proibido — bloqueio/cloudflare? URL: ${url}`)
  }
  if (res.status === 429) {
    if (attempt >= MAX_RETRIES) throw new Error(`429 rate-limit estourado em ${url}`)
    const retryAfter = Number(res.headers.get('retry-after')) || 0
    const wait = Math.max(retryAfter * 1000, 1000 * 2 ** attempt) + Math.random() * 500
    console.warn(`  ⚠️  429, esperando ${Math.round(wait)}ms (tentativa ${attempt + 1})`)
    await sleep(wait)
    return getJson(url, attempt + 1)
  }
  if (res.status >= 500) {
    if (attempt >= MAX_RETRIES) throw new Error(`${res.status} server-error em ${url}`)
    const wait = 1000 * 2 ** attempt + Math.random() * 500
    console.warn(`  ⚠️  ${res.status}, retry ${attempt + 1}/${MAX_RETRIES} em ${Math.round(wait)}ms`)
    await sleep(wait)
    return getJson(url, attempt + 1)
  }
  if (!res.ok) {
    const txt = await res.text().catch(() => '')
    throw new Error(`HTTP ${res.status} em ${url}: ${txt.slice(0, 200)}`)
  }

  return res.json()
}

export async function fetchProducts(query) {
  const url = `${BASE}/v1/physician/medications/products?q=${encodeURIComponent(query)}`
  const body = await getJson(url)
  // a API retorna { data: [...] }
  return Array.isArray(body) ? body : body.data ?? []
}

export async function fetchPosology(medicationId) {
  const url = `${BASE}/v1/physician/patient_instructions?medicationId=${medicationId}`
  const body = await getJson(url)
  return Array.isArray(body) ? body : body.data ?? []
}
