import vine from '@vinejs/vine'

/** Atualização do próprio perfil — campos que o médico/secretária pode editar. */
export const updateProfileValidator = vine.compile(
  vine.object({
    fullName: vine.string().trim().minLength(2).maxLength(150).optional(),
    phone: vine.string().trim().maxLength(30).optional().nullable(),
    address: vine.string().trim().maxLength(300).optional().nullable(),
    crm: vine.string().trim().maxLength(20).optional().nullable(),
    crmUf: vine
      .string()
      .trim()
      .regex(/^[A-Z]{2}$/i)
      .optional()
      .nullable(),
    specialty: vine.string().trim().maxLength(120).optional().nullable(),
    /** Preço default da consulta — só doctor/admin edita; secretária não. */
    consultationPrice: vine.number().min(0).max(99999).optional().nullable(),
    signatureProvider: vine.string().trim().maxLength(30).optional().nullable(),
  })
)

/** Troca de senha. */
export const changePasswordValidator = vine.compile(
  vine.object({
    currentPassword: vine.string().minLength(1),
    newPassword: vine.string().minLength(6).maxLength(100),
  })
)

/** Edição de dados da clínica — só doctor (consultório) ou admin pode. */
export const updateClinicValidator = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(2).maxLength(150).optional(),
    cnpj: vine.string().trim().maxLength(20).optional().nullable(),
    phone: vine.string().trim().maxLength(30).optional().nullable(),
    address: vine.string().trim().maxLength(300).optional().nullable(),
  })
)
