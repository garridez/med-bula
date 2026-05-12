import vine from '@vinejs/vine'

export const createInsuranceValidator = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(2).maxLength(100),
  })
)

export const updateInsuranceValidator = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(2).maxLength(100).optional(),
    isActive: vine.boolean().optional(),
  })
)

export const upsertDoctorInsuranceValidator = vine.compile(
  vine.object({
    doctorId: vine.number().positive(),
    price: vine.number().min(0).max(99999),
  })
)

export const updateDoctorInsuranceValidator = vine.compile(
  vine.object({
    price: vine.number().min(0).max(99999).optional(),
    isActive: vine.boolean().optional(),
  })
)
