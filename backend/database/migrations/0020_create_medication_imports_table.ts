import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Rastreia importações do catálogo de medicamentos. O ace command
 * `medications:import` consulta a última linha pra ver se os hashes dos
 * arquivos JSON bateram — se sim, pula a importação.
 *
 * Idempotência sem custo de truncate+copy a cada boot.
 */
export default class extends BaseSchema {
  protected tableName = 'medication_imports'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      // SHA256 hex (64 chars)
      table.string('medications_hash', 64).notNullable()
      table.string('posologies_hash', 64).notNullable()
      table.integer('medications_count').notNullable()
      table.integer('posologies_count').notNullable()
      // 'auto' = entrypoint, 'manual' = node ace medications:import
      table.string('imported_by', 50).notNullable().defaultTo('auto')
      // ms gastos no COPY
      table.integer('duration_ms').nullable()
      table.timestamp('imported_at').notNullable().defaultTo(this.now())
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
