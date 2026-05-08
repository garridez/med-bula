import vine from '@vinejs/vine'

const prescriptionItemSchema = vine.object({
  name: vine.string().trim().minLength(1).maxLength(200),
  dose: vine.string().trim().maxLength(100).optional().nullable(),
  route: vine.string().trim().maxLength(40).optional().nullable(),
  frequency: vine.string().trim().maxLength(120).optional().nullable(),
  duration: vine.string().trim().maxLength(60).optional().nullable(),
  notes: vine.string().trim().maxLength(500).optional().nullable(),
  controlled: vine.boolean().optional(),
})

const examItemSchema = vine.object({
  name: vine.string().trim().minLength(1).maxLength(200),
  tuss: vine.string().trim().maxLength(20).optional().nullable(),
  notes: vine.string().trim().maxLength(500).optional().nullable(),
})

export const createDocumentValidator = vine.compile(
  vine.object({
    type: vine.enum(['prescription', 'exam_request', 'medical_certificate']),
    patientId: vine.number().positive(),
    appointmentId: vine.number().positive().optional().nullable(),
    medicalRecordId: vine.number().positive().optional().nullable(),
    title: vine.string().trim().maxLength(200).optional().nullable(),
    payload: vine.union([
      vine.union.if(
        (data) => (data as any).type === 'prescription',
        vine.object({
          items: vine.array(prescriptionItemSchema).minLength(1),
        })
      ),
      vine.union.if(
        (data) => (data as any).type === 'exam_request',
        vine.object({
          items: vine.array(examItemSchema).minLength(1),
        })
      ),
      vine.union.if(
        (data) => (data as any).type === 'medical_certificate',
        vine.object({
          reason: vine.string().trim().minLength(2).maxLength(300),
          daysOff: vine.number().min(0).max(365),
          cid: vine.string().trim().maxLength(20).optional().nullable(),
          notes: vine.string().trim().maxLength(500).optional().nullable(),
        })
      ),
      vine.union.else(vine.any()),
    ]),
  })
)
