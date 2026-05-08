import { DateTime } from 'luxon'
import { randomUUID } from 'node:crypto'
import { BaseModel, beforeCreate, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Document from '#models/document'

export type DispensingActorType = 'pharmacy' | 'lab' | 'employer'

export default class DocumentDispensing extends BaseModel {
  static selfAssignPrimaryKey = true
  static table = 'document_dispensings'

  @beforeCreate()
  static assignUuid(model: DocumentDispensing) {
    if (!model.id) {
      model.id = randomUUID()
    }
  }

  @column({ isPrimary: true })
  declare id: string

  @column()
  declare documentId: string

  @column()
  declare cnpj: string

  @column()
  declare name: string | null

  @column()
  declare actorType: DispensingActorType

  @column()
  declare ipAddress: string | null

  @column.dateTime()
  declare dispensedAt: DateTime

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @belongsTo(() => Document)
  declare document: BelongsTo<typeof Document>

  /** Formata "12.345.678/0001-90" pra display */
  get cnpjFormatted(): string {
    const d = this.cnpj
    if (d.length !== 14) return d
    return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
  }
}
