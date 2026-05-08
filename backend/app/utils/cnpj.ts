/**
 * Valida CNPJ brasileiro:
 *   - 14 dígitos numéricos
 *   - Não pode ser todos iguais (00000000000000, 11111111111111, etc)
 *   - Dois dígitos verificadores módulo 11
 *
 * Retorna true se o CNPJ for sintaticamente válido. NÃO consulta a Receita
 * Federal — pra isso, integrar com BrasilAPI / Receita CNPJ é V2.
 */
export function isValidCnpj(input: string): boolean {
  const cnpj = (input || '').replace(/\D/g, '')
  if (cnpj.length !== 14) return false
  if (/^(\d)\1{13}$/.test(cnpj)) return false

  // Primeiro dígito verificador
  let sum = 0
  let weight = 5
  for (let i = 0; i < 12; i++) {
    sum += Number(cnpj[i]) * weight
    weight = weight === 2 ? 9 : weight - 1
  }
  let digit1 = sum % 11
  digit1 = digit1 < 2 ? 0 : 11 - digit1
  if (Number(cnpj[12]) !== digit1) return false

  // Segundo dígito verificador
  sum = 0
  weight = 6
  for (let i = 0; i < 13; i++) {
    sum += Number(cnpj[i]) * weight
    weight = weight === 2 ? 9 : weight - 1
  }
  let digit2 = sum % 11
  digit2 = digit2 < 2 ? 0 : 11 - digit2
  if (Number(cnpj[13]) !== digit2) return false

  return true
}

export function formatCnpj(input: string): string {
  const d = (input || '').replace(/\D/g, '')
  if (d.length !== 14) return input
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
}

export function digitsOnlyCnpj(input: string): string {
  return (input || '').replace(/\D/g, '')
}
