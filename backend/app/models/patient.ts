import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import Clinic from '#models/clinic'
import Appointment from '#models/appointment'
import MedicalRecord from '#models/medical_record'

export default class Patient extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare clinicId: number

  @column()
  declare fullName: string

  @column()
  declare cpf: string | null

  @column()
  declare rg: string | null

  @column.date()
  declare birthDate: DateTime | null

  @column()
  declare gender: 'M' | 'F' | 'O' | null

  @column()
  declare weightKg: number | null

  @column()
  declare heightCm: number | null

  @column()
  declare phone: string | null

  @column()
  declare email: string | null

  @column()
  declare address: string | null

  @column()
  declare city: string | null

  @column()
  declare state: string | null

  @column()
  declare zipcode: string | null

  @column()
  declare notes: string | null

  @column({
    prepare: (v) => (v ? JSON.stringify(v) : null),
    consume: (v) => (typeof v === 'string' ? JSON.parse(v) : v),
  })
  declare extra: Record<string, unknown> | null

  @column()
  declare isActive: boolean

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @belongsTo(() => Clinic)
  declare clinic: BelongsTo<typeof Clinic>

  @hasMany(() => Appointment)
  declare appointments: HasMany<typeof Appointment>

  @hasMany(() => MedicalRecord)
  declare medicalRecords: HasMany<typeof MedicalRecord>

  /** Last 4 digits of phone — used as OTP for the patient delivery flow */
  get phoneOtp(): string | null {
    if (!this.phone) return null
    const digits = this.phone.replace(/\D/g, '')
    return digits.length >= 4 ? digits.slice(-4) : null
  }
}
