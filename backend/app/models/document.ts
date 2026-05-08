import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Clinic from '#models/clinic'
import Patient from '#models/patient'
import User from '#models/user'
import Appointment from '#models/appointment'
import MedicalRecord from '#models/medical_record'

export type DocumentType = 'prescription' | 'exam_request' | 'medical_certificate'
export type DocumentStatus =
  | 'draft'
  | 'awaiting_signature'
  | 'signed'
  | 'delivered'
  | 'cancelled'

export interface PrescriptionItem {
  name: string
  dose?: string
  route?: string
  frequency?: string
  duration?: string
  notes?: string
  controlled?: boolean
}

export interface ExamItem {
  name: string
  tuss?: string
  notes?: string
}

export interface CertificatePayload {
  reason: string
  daysOff: number
  cid?: string
  notes?: string
}

export type DocumentPayload =
  | { items: PrescriptionItem[] }
  | { items: ExamItem[] }
  | CertificatePayload

export default class Document extends BaseModel {
  static selfAssignPrimaryKey = true
  static table = 'documents'

  @column({ isPrimary: true })
  declare id: string

  @column()
  declare clinicId: number

  @column()
  declare patientId: number

  @column()
  declare doctorId: number

  @column()
  declare appointmentId: number | null

  @column()
  declare medicalRecordId: number | null

  @column()
  declare type: DocumentType

  @column()
  declare title: string | null

  @column({
    prepare: (v) => (v ? JSON.stringify(v) : null),
    consume: (v) => (typeof v === 'string' ? JSON.parse(v) : v),
  })
  declare payload: DocumentPayload

  @column({ serializeAs: null })
  declare pdfUnsignedBase64: string | null

  @column()
  declare pdfUnsignedSha256: string | null

  @column({ serializeAs: null })
  declare pdfSignedBase64: string | null

  @column()
  declare signatureProvider: string | null

  @column({
    prepare: (v) => (v ? JSON.stringify(v) : null),
    consume: (v) => (typeof v === 'string' ? JSON.parse(v) : v),
  })
  declare signatureMetadata: Record<string, unknown> | null

  @column()
  declare status: DocumentStatus

  @column()
  declare deliveryToken: string | null

  @column.dateTime()
  declare deliveredAt: DateTime | null

  @column.dateTime()
  declare firstViewedAt: DateTime | null

  @column()
  declare viewCount: number

  @column()
  declare pharmacyCnpj: string | null

  @column.dateTime()
  declare dispensedAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @belongsTo(() => Clinic)
  declare clinic: BelongsTo<typeof Clinic>

  @belongsTo(() => Patient)
  declare patient: BelongsTo<typeof Patient>

  @belongsTo(() => User, { foreignKey: 'doctorId' })
  declare doctor: BelongsTo<typeof User>

  @belongsTo(() => Appointment)
  declare appointment: BelongsTo<typeof Appointment>

  @belongsTo(() => MedicalRecord)
  declare medicalRecord: BelongsTo<typeof MedicalRecord>
}
