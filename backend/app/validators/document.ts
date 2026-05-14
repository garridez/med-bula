import vine from '@vinejs/vine'

/**
 * Item de prescrição (Drop C).
 *
 * Suporta dois modos:
 *  1. Medicamento do catálogo: medicationId + medicationTitle + posology
 *  2. Texto livre: freeText (medicationId null, posology opcional)
 *
 * Cada item carrega seu próprio prescriptionType e usageType. O PDF
 * agrupa todos os items num mesmo documento e usa o tipo mais
 * restritivo pra título.
 *
 * Campos legados (dose/route/frequency/duration/controlled) mantidos
 * como opcionais pra não quebrar receitas antigas. Não são mais usados
 * em criações novas.
 */
const prescriptionItemSchema = vine.object({
  // Modo medicamento ↓
  medicationId: vine.string().trim().maxLength(64).optional().nullable(),
  medicationTitle: vine.string().trim().maxLength(200).optional().nullable(),
  activeIngredient: vine.string().trim().maxLength(200).optional().nullable(),
  laboratoryName: vine.string().trim().maxLength(120).optional().nullable(),
  category: vine.string().trim().maxLength(40).optional().nullable(),
  unit: vine.string().trim().maxLength(40).optional().nullable(),

  // Modo texto livre ↓
  freeText: vine.string().trim().maxLength(500).optional().nullable(),

  // Comum aos dois ↓
  posology: vine.string().trim().maxLength(1000).optional().nullable(),
  prescriptionType: vine
    .enum([
      'simples',
      'duas_vias',
      'controle_especial',
      'controle_antimicrobiano',
    ])
    .optional(),
  usageType: vine
    .enum([
      'nao_informada',
      'uso_continuo',
      'comprimidos',
      'embalagens',
      'unidades',
    ])
    .optional(),
  usageQuantity: vine.number().min(0).optional().nullable(),

  // Legados — aceita pra retrocompat, ignorado em criações novas
  name: vine.string().trim().maxLength(200).optional().nullable(),
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
