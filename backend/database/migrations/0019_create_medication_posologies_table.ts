import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Posologias (instruções de uso) do Cliquerx.
 *
 * Cada medicamento pode ter VÁRIAS posologias — uma por população (Adultos,
 * Crianças, Idosos) e/ou por indicação (Dor, Febre, etc.). Por isso é 1:N.
 *
 * Quando o médico for prescrever, o autocomplete sugere as posologias
 * disponíveis e — se o paciente tiver peso/idade — a gente pode filtrar
 * a mais adequada (V2: regra de match por idade/peso).
 */
export default class extends BaseSchema {
  protected tableName = 'medication_posologies'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      table
        .uuid('medication_id')
        .notNullable()
        .references('id')
        .inTable('medications')
        .onDelete('CASCADE')

      // ID da posologia original no Cliquerx (útil pra rastrear/atualizar)
      table.string('posology_id', 50).nullable()

      // "Tomar 1 comprimido, via oral, duas vezes ao dia, durante 3 dias."
      table.text('content').notNullable()

      table.integer('usage_quantity').nullable()

      // "Dor, Febre, Inflamação..."
      table.text('indication').nullable()

      // "Adultos" | "Crianças" | "Idosos" | "Adultos, Crianças, Adolescentes"...
      table.string('population', 100).nullable()

      // "Acima de 12 anos" | "0-2 anos" | etc. — descoberto via probe.
      // Útil V2 pra match automático com idade do paciente.
      table.string('age_range', 100).nullable()

      // "leaflet" (bula), "custom" (futuro), etc.
      table.string('type', 30).nullable()

      table.timestamp('created_at').notNullable().defaultTo(this.now())
      table.timestamp('updated_at').nullable()

      table.index(['medication_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
