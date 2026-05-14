import vine from '@vinejs/vine'

const diagnosisSchema = vine.object({
  code: vine.string().trim().maxLength(20),
  description: vine.string().trim().maxLength(200),
  recordedAt: vine.string().trim().optional(),
  recordedBy: vine.number().optional(),
})

const baseSchema = {
  fullName: vine.string().trim().minLength(2).maxLength(200),
  cpf: vine.string().trim().maxLength(20).optional().nullable(),
  rg: vine.string().trim().maxLength(30).optional().nullable(),
  birthDate: vine.date({ formats: ['YYYY-MM-DD'] }).optional().nullable(),
  gender: vine.enum(['M', 'F', 'O']).optional().nullable(),
  weightKg: vine.number().min(0).max(500).optional().nullable(),
  heightCm: vine.number().min(0).max(300).optional().nullable(),
  phone: vine.string().trim().maxLength(30).optional().nullable(),
  email: vine.string().trim().email().optional().nullable(),
  address: vine.string().trim().maxLength(300).optional().nullable(),
  city: vine.string().trim().maxLength(120).optional().nullable(),
  state: vine.string().trim().maxLength(5).optional().nullable(),
  zipcode: vine.string().trim().maxLength(15).optional().nullable(),
  notes: vine.string().trim().optional().nullable(),
  extra: vine.record(vine.any()).optional().nullable(),

  // Drop P — Dados clínicos independentes de consulta
  clinicalHistory: vine.string().trim().maxLength(5000).optional().nullable(),
  surgicalHistory: vine.string().trim().maxLength(5000).optional().nullable(),
  familyHistory: vine.string().trim().maxLength(5000).optional().nullable(),
  habits: vine.string().trim().maxLength(5000).optional().nullable(),
  allergies: vine.string().trim().maxLength(5000).optional().nullable(),
  medicationsInUse: vine.string().trim().maxLength(5000).optional().nullable(),
  diagnoses: vine.array(diagnosisSchema).optional().nullable(),
}

export const createPatientValidator = vine.compile(vine.object(baseSchema))
export const updatePatientValidator = vine.compile(vine.object(baseSchema))
