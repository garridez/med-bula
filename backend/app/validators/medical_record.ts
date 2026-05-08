import vine from '@vinejs/vine'

export const upsertMedicalRecordValidator = vine.compile(
  vine.object({
    patientId: vine.number().positive(),
    appointmentId: vine.number().positive().optional().nullable(),
    subjective: vine.string().trim().optional().nullable(),
    objective: vine.string().trim().optional().nullable(),
    assessment: vine.string().trim().optional().nullable(),
    plan: vine.string().trim().optional().nullable(),
    notes: vine.string().trim().optional().nullable(),
    vitals: vine
      .object({
        bp: vine.string().trim().optional(),
        hr: vine.number().min(0).max(300).optional(),
        rr: vine.number().min(0).max(80).optional(),
        temp: vine.number().min(30).max(45).optional(),
        spo2: vine.number().min(0).max(100).optional(),
        weight: vine.number().min(0).max(500).optional(),
        height: vine.number().min(0).max(300).optional(),
      })
      .optional()
      .nullable(),
  })
)
