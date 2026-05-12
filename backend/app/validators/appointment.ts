import vine from '@vinejs/vine'

export const createAppointmentValidator = vine.compile(
  vine.object({
    doctorId: vine.number().positive(),
    patientId: vine.number().positive(),
    insuranceId: vine.number().positive().optional().nullable(),
    scheduledAt: vine.date({ formats: { utc: true } }),
    durationMinutes: vine.number().min(5).max(480).optional(),
    reason: vine.string().trim().maxLength(300).optional().nullable(),
    notes: vine.string().trim().optional().nullable(),
    price: vine.number().min(0).optional().nullable(),
    copayAmount: vine.number().min(0).optional().nullable(),
    status: vine
      .enum([
        'scheduled',
        'confirmed',
        'in_progress',
        'completed',
        'cancelled',
        'no_show',
      ])
      .optional(),
  })
)

export const updateAppointmentValidator = vine.compile(
  vine.object({
    doctorId: vine.number().positive().optional(),
    patientId: vine.number().positive().optional(),
    insuranceId: vine.number().positive().optional().nullable(),
    scheduledAt: vine.date({ formats: { utc: true } }).optional(),
    durationMinutes: vine.number().min(5).max(480).optional(),
    reason: vine.string().trim().maxLength(300).optional().nullable(),
    notes: vine.string().trim().optional().nullable(),
    price: vine.number().min(0).optional().nullable(),
    copayAmount: vine.number().min(0).optional().nullable(),
    status: vine
      .enum([
        'scheduled',
        'confirmed',
        'in_progress',
        'completed',
        'cancelled',
        'no_show',
      ])
      .optional(),
    paymentStatus: vine.enum(['none', 'pending', 'paid', 'refunded']).optional(),
    paymentMethod: vine.string().trim().maxLength(30).optional().nullable(),
  })
)

export const listAppointmentsValidator = vine.compile(
  vine.object({
    from: vine.date({ formats: { utc: true } }).optional(),
    to: vine.date({ formats: { utc: true } }).optional(),
    doctorId: vine.number().positive().optional(),
    patientId: vine.number().positive().optional(),
  })
)
