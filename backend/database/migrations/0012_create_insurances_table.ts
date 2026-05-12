import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Drop 5b — Convênios.
 * Cada clínica tem sua lista de convênios (Unimed, Bradesco Saúde, etc.).
 * Os preços por médico ficam em `doctor_insurances`.
 */
export default class extends BaseSchema {
  protected tableName = 'insurances'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      table
        .integer('clinic_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('clinics')
        .onDelete('CASCADE')
      table.string('name', 100).notNullable()
      table.boolean('is_active').defaultTo(true).notNullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      table.unique(['clinic_id', 'name'])
      table.index(['clinic_id', 'is_active'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
