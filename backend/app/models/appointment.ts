import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Clinic from '#models/clinic'
import User from '#models/user'
import Patient from '#models/patient'
import Insurance from '#models/insurance'

export type AppointmentStatus =
  | 'scheduled'
  | 'confirmed'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'no_show'

export type PaymentStatus = 'none' | 'pending' | 'paid' | 'refunded'

const decimalConsumer = {
  consume: (v: any) => (v == null ? null : Number(v)),
  serialize: (v: any) => (v == null ? null : Number(v)),
}

export default class Appointment extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare clinicId: number

  @column()
  declare doctorId: number

  @column()
  declare patientId: number

  @column()
  declare insuranceId: number | null

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

  /** Valor total acordado pra consulta (snapshot, editável). */
  @column(decimalConsumer)
  declare price: number | null

  /** Suplemento em dinheiro do paciente quando convênio. */
  @column(decimalConsumer)
  declare copayAmount: number | null

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

  @belongsTo(() => Insurance)
  declare insurance: BelongsTo<typeof Insurance>
}
