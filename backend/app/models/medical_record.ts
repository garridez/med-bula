import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Clinic from '#models/clinic'
import Patient from '#models/patient'
import User from '#models/user'
import Appointment from '#models/appointment'

export default class MedicalRecord extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare clinicId: number

  @column()
  declare patientId: number

  @column()
  declare doctorId: number

  @column()
  declare appointmentId: number | null

  @column()
  declare subjective: string | null

  @column()
  declare objective: string | null

  @column()
  declare assessment: string | null

  @column()
  declare plan: string | null

  @column()
  declare notes: string | null

  @column({
    prepare: (v) => (v ? JSON.stringify(v) : null),
    consume: (v) => (typeof v === 'string' ? JSON.parse(v) : v),
  })
  declare vitals: Record<string, unknown> | null

  @column({
    prepare: (v) => (v ? JSON.stringify(v) : null),
    consume: (v) => (typeof v === 'string' ? JSON.parse(v) : v),
  })
  declare aiSummary: Record<string, unknown> | null

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
}
