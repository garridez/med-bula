import { DateTime } from 'luxon'
import { randomUUID } from 'node:crypto'
import { BaseModel, beforeCreate, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import User from '#models/user'

export type SignatureSessionStatus =
  | 'pending'
  | 'authenticated'
  | 'signing'
  | 'signed'
  | 'failed'
  | 'expired'

export default class SignatureSession extends BaseModel {
  static selfAssignPrimaryKey = true
  static table = 'signature_sessions'

  @beforeCreate()
  static assignUuid(model: SignatureSession) {
    if (!model.id) {
      model.id = randomUUID()
    }
  }

  @column({ isPrimary: true })
  declare id: string

  @column()
  declare userId: number

  @column()
  declare provider: string

  @column({ serializeAs: null })
  declare codeVerifier: string

  @column()
  declare cpf: string | null

  @column({
    prepare: (v) => (v ? JSON.stringify(v) : '[]'),
    consume: (v) => (typeof v === 'string' ? JSON.parse(v) : v),
  })
  declare documentIds: string[]

  @column()
  declare status: SignatureSessionStatus

  @column({ serializeAs: null })
  declare accessToken: string | null

  @column()
  declare error: string | null

  @column({
    prepare: (v) => (v ? JSON.stringify(v) : null),
    consume: (v) => (typeof v === 'string' ? JSON.parse(v) : v),
  })
  declare metadata: Record<string, unknown> | null

  @column.dateTime()
  declare expiresAt: DateTime

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>
}
