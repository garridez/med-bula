import { BaseModel, column, hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import MedicationPosology from '#models/medication_posology'

/**
 * Catálogo Cliquerx (23.834 medicamentos). Tabela criada/populada
 * fora do AdonisJS. Aqui só leitura.
 *
 * NOTA: `description` na Cliquerx é o PRINCÍPIO ATIVO, não uma descrição
 * humana. Usar pra agrupar apresentações comerciais do mesmo fármaco.
 */
export default class Medication extends BaseModel {
  static table = 'medications'
  static selfAssignPrimaryKey = true

  @column({ isPrimary: true })
  declare id: string

  @column()
  declare title: string | null

  @column()
  declare subtitle: string | null

  @column()
  declare description: string | null // princípio ativo

  @column({ columnName: 'laboratory_name' })
  declare laboratoryName: string | null

  @column()
  declare category: string | null

  @column({
    columnName: 'max_price',
    consume: (v) => (v == null ? null : Number(v)),
  })
  declare maxPrice: number | null

  @column()
  declare available: boolean

  @column({ columnName: 'list_type' })
  declare listType: string | null

  @column({ columnName: 'prescription_type' })
  declare prescriptionType: string | null

  @column()
  declare ean1: string | null

  @column({ columnName: 'requires_cpf' })
  declare requiresCpf: boolean

  @column({ columnName: 'unit_singular' })
  declare unitSingular: string | null

  @column({ columnName: 'unit_plural' })
  declare unitPlural: string | null

  @column()
  declare campaign: object | null

  @hasMany(() => MedicationPosology)
  declare posologies: HasMany<typeof MedicationPosology>
}
