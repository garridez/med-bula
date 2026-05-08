import { DateTime } from 'luxon'
import hash from '@adonisjs/core/services/hash'
import { compose } from '@adonisjs/core/helpers'
import { BaseModel, column, belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import { withAuthFinder } from '@adonisjs/auth/mixins/lucid'
import { DbAccessTokensProvider } from '@adonisjs/auth/access_tokens'
import Clinic from '#models/clinic'
import Appointment from '#models/appointment'

export type UserRole = 'super_admin' | 'admin' | 'doctor' | 'secretary'

const AuthFinder = withAuthFinder(() => hash.use('scrypt'), {
  uids: ['email'],
  passwordColumnName: 'password',
})

export default class User extends compose(BaseModel, AuthFinder) {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare clinicId: number | null

  @column()
  declare fullName: string

  @column()
  declare email: string

  @column({ serializeAs: null })
  declare password: string

  @column()
  declare phone: string | null

  @column()
  declare cpf: string | null

  @column()
  declare role: UserRole

  @column()
  declare crm: string | null

  @column()
  declare crmUf: string | null

  @column()
  declare specialty: string | null

  @column()
  declare signatureProvider: string | null

  @column({
    prepare: (v) => (v ? JSON.stringify(v) : null),
    consume: (v) => (typeof v === 'string' ? JSON.parse(v) : v),
  })
  declare permissions: Record<string, boolean> | null

  @column()
  declare isActive: boolean

  @column.dateTime()
  declare lastLoginAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @belongsTo(() => Clinic)
  declare clinic: BelongsTo<typeof Clinic>

  @hasMany(() => Appointment, { foreignKey: 'doctorId' })
  declare appointments: HasMany<typeof Appointment>

  static accessTokens = DbAccessTokensProvider.forModel(User, {
    expiresIn: '30 days',
    prefix: 'mb_',
    table: 'auth_access_tokens',
    type: 'auth_token',
    tokenSecretLength: 40,
  })

  serializeExtras() {
    return {
      isDoctor: this.role === 'doctor',
      isAdmin: this.role === 'admin' || this.role === 'super_admin',
      isSuperAdmin: this.role === 'super_admin',
    }
  }
}
