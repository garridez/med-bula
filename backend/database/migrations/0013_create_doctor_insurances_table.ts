import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Drop 5b — Junção médico × convênio com o preço acordado.
 * Cada médico cadastra seus próprios convênios e valores. Em consultório
 * o próprio médico cadastra; em clínica, o admin cadastra para cada médico.
 */
export default class extends BaseSchema {
  protected tableName = 'doctor_insurances'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      table
        .integer('doctor_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')
      table
        .integer('insurance_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('insurances')
        .onDelete('CASCADE')
      table.decimal('price', 10, 2).notNullable()
      table.boolean('is_active').defaultTo(true).notNullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      table.unique(['doctor_id', 'insurance_id'])
      table.index(['doctor_id', 'is_active'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
