import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Clinic from '#models/clinic'
import User from '#models/user'
import Patient from '#models/patient'

export type AppointmentStatus =
  | 'scheduled'
  | 'confirmed'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'no_show'

export type PaymentStatus = 'none' | 'pending' | 'paid' | 'refunded'

export default class Appointment extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare clinicId: number

  @column()
  declare doctorId: number

  @column()
  declare patientId: number

  @column.dateTime()
  declare scheduledAt: DateTime

  @column()
  declare durationMinutes: number

  @column()
  declare status: AppointmentStatus

  @column()
  declare reason: string | null

  @column()
  declare notes: string | null

  @column()
  declare price: number | null

  @column()
  declare paymentStatus: PaymentStatus

  @column()
  declare paymentMethod: string | null

  @column()
  declare pixTxid: string | null

  @column()
  declare reminderSent: boolean

  @column.dateTime()
  declare reminderSentAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @belongsTo(() => Clinic)
  declare clinic: BelongsTo<typeof Clinic>

  @belongsTo(() => User, { foreignKey: 'doctorId' })
  declare doctor: BelongsTo<typeof User>

  @belongsTo(() => Patient)
  declare patient: BelongsTo<typeof Patient>
}
