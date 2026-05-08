import crypto from 'node:crypto'

/**
 * PKCE (Proof Key for Code Exchange) — RFC 7636.
 * Vidaas exige PKCE com S256 no fluxo OAuth.
 */
export function makePkce(): { codeVerifier: string; codeChallenge: string } {
  const codeVerifier = crypto.randomBytes(32).toString('hex')
  const codeChallenge = crypto
    .createHash('sha256')
    .update(codeVerifier)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
  return { codeVerifier, codeChallenge }
}
