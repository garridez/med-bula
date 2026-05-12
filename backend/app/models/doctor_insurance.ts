import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import User from '#models/user'
import Insurance from '#models/insurance'

export default class DoctorInsurance extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare doctorId: number

  @column()
  declare insuranceId: number

  /**
   * Lucid retorna decimais como string. Esse consume converte pra number
   * pra a UI não precisar parsear.
   */
  @column({
    consume: (v: any) => (v == null ? null : Number(v)),
    serialize: (v: any) => (v == null ? null : Number(v)),
  })
  declare price: number

  @column()
  declare isActive: boolean

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @belongsTo(() => User, { foreignKey: 'doctorId' })
  declare doctor: BelongsTo<typeof User>

  @belongsTo(() => Insurance)
  declare insurance: BelongsTo<typeof Insurance>
}
