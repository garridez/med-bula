import vine from '@vinejs/vine'

/**
 * Cria clínica + gestor inicial em uma chamada só.
 * Se plan='consultorio': initialUser.role = 'doctor' (com CRM obrigatório).
 * Se plan='clinica': initialUser.role = 'admin'.
 */
export const createClinicValidator = vine.compile(
  vine.object({
    clinic: vine.object({
      name: vine.string().trim().minLength(2),
      cnpj: vine.string().trim().optional().nullable(),
      phone: vine.string().trim().optional().nullable(),
      address: vine.string().trim().optional().nullable(),
      plan: vine.enum(['consultorio', 'clinica']),
      monthlyFee: vine.number().min(0).optional().nullable(),
      subscriptionStatus: vine
        .enum(['active', 'past_due', 'cancelled', 'trial'])
        .optional(),
    }),
    initialUser: vine.object({
      fullName: vine.string().trim().minLength(2),
      email: vine.string().email().normalizeEmail(),
      password: vine.string().minLength(6).maxLength(72),
      phone: vine.string().trim().optional().nullable(),
      cpf: vine.string().trim().optional().nullable(),
      crm: vine.string().trim().optional().nullable(),
      crmUf: vine.string().trim().fixedLength(2).optional().nullable(),
      specialty: vine.string().trim().optional().nullable(),
      consultationPrice: vine.number().positive().optional().nullable(),
    }),
  })
)

export const updateClinicValidator = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(2).optional(),
    cnpj: vine.string().trim().optional().nullable(),
    phone: vine.string().trim().optional().nullable(),
    address: vine.string().trim().optional().nullable(),
    plan: vine.enum(['consultorio', 'clinica']).optional(),
    monthlyFee: vine.number().min(0).optional().nullable(),
    subscriptionStatus: vine
      .enum(['active', 'past_due', 'cancelled', 'trial'])
      .optional(),
    isActive: vine.boolean().optional(),
  })
)

export const impersonateValidator = vine.compile(
  vine.object({
    userId: vine.number().positive(),
  })
)
