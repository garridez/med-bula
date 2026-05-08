import { DateTime } from 'luxon'
import { BaseModel, column, hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import User from '#models/user'
import Patient from '#models/patient'

export default class Clinic extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare name: string

  @column()
  declare cnpj: string | null

  @column()
  declare plan: 'consultorio' | 'clinica'

  @column()
  declare phone: string | null

  @column()
  declare address: string | null

  @column()
  declare logoUrl: string | null

  @column()
  declare primaryColor: string

  @column()
  declare isActive: boolean

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @hasMany(() => User)
  declare users: HasMany<typeof User>

  @hasMany(() => Patient)
  declare patients: HasMany<typeof Patient>
}
