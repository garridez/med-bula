import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Medication from '#models/medication'

export default class MedicationPosology extends BaseModel {
  static table = 'medication_posologies'

  @column({ isPrimary: true })
  declare id: number

  @column({ columnName: 'medication_id' })
  declare medicationId: string

  @column({ columnName: 'posology_id' })
  declare posologyId: string | null

  @column()
  declare content: string

  @column({ columnName: 'usage_quantity' })
  declare usageQuantity: number | null

  @column()
  declare indication: string | null

  @column()
  declare population: string | null

  @column({ columnName: 'age_range' })
  declare ageRange: string | null

  @column()
  declare type: string | null

  @belongsTo(() => Medication)
  declare medication: BelongsTo<typeof Medication>
}
