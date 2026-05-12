import vine from '@vinejs/vine'

/**
 * Validator pra criação de usuário pelo admin.
 *
 * Campos comuns: nome, email, senha, telefone, role.
 * Campos de médico: crm, crmUf, specialty, consultationPrice,
 *   signatureProvider, splitType, splitValue.
 *
 * Não força os campos de médico no schema porque dá pra criar uma
 * secretária — quem valida isso é o controller, baseado no `role`.
 */
export const createUserValidator = vine.compile(
  vine.object({
    role: vine.enum(['doctor', 'secretary', 'admin']),
    fullName: vine.string().trim().minLength(2),
    email: vine.string().email().normalizeEmail(),
    password: vine.string().minLength(6).maxLength(72),
    phone: vine.string().trim().optional().nullable(),
    cpf: vine.string().trim().optional().nullable(),
    address: vine.string().trim().optional().nullable(),

    // Doctor-specific
    crm: vine.string().trim().optional().nullable(),
    crmUf: vine.string().trim().fixedLength(2).optional().nullable(),
    specialty: vine.string().trim().optional().nullable(),
    consultationPrice: vine.number().positive().optional().nullable(),
    signatureProvider: vine.string().trim().optional().nullable(),
    splitType: vine.enum(['percentual', 'absoluto']).optional().nullable(),
    splitValue: vine.number().min(0).optional().nullable(),
  })
)

export const updateUserValidator = vine.compile(
  vine.object({
    fullName: vine.string().trim().minLength(2).optional(),
    email: vine.string().email().normalizeEmail().optional(),
    phone: vine.string().trim().optional().nullable(),
    cpf: vine.string().trim().optional().nullable(),
    address: vine.string().trim().optional().nullable(),
    isActive: vine.boolean().optional(),

    crm: vine.string().trim().optional().nullable(),
    crmUf: vine.string().trim().fixedLength(2).optional().nullable(),
    specialty: vine.string().trim().optional().nullable(),
    consultationPrice: vine.number().positive().optional().nullable(),
    signatureProvider: vine.string().trim().optional().nullable(),
    splitType: vine.enum(['percentual', 'absoluto']).optional().nullable(),
    splitValue: vine.number().min(0).optional().nullable(),
  })
)

export const resetPasswordValidator = vine.compile(
  vine.object({
    newPassword: vine.string().minLength(6).maxLength(72),
  })
)
