import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import Clinic from '#models/clinic'
import DoctorInsurance from '#models/doctor_insurance'

export default class Insurance extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare clinicId: number

  @column()
  declare name: string

  @column()
  declare isActive: boolean

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @belongsTo(() => Clinic)
  declare clinic: BelongsTo<typeof Clinic>

  @hasMany(() => DoctorInsurance)
  declare doctorInsurances: HasMany<typeof DoctorInsurance>
}
