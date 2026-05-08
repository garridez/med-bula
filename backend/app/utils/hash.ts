import crypto from 'node:crypto'

/**
 * SHA-256 base64 — formato exigido pelo Vidaas no fluxo de assinatura digital
 * (vai ser usado no Drop 4).
 */
export function sha256Base64(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('base64')
}

export function sha256Hex(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex')
}
