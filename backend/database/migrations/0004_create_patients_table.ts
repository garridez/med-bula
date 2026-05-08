import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'patients'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table
        .integer('clinic_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('clinics')
        .onDelete('CASCADE')

      table.string('full_name', 200).notNullable()
      table.string('cpf', 20).nullable().index()
      table.string('rg', 30).nullable()
      table.date('birth_date').nullable()
      table.enum('gender', ['M', 'F', 'O']).nullable()
      table.decimal('weight_kg', 5, 2).nullable()
      table.decimal('height_cm', 5, 2).nullable()

      table.string('phone', 30).nullable().index() // OTP é os 4 últimos dígitos disso
      table.string('email', 254).nullable()

      table.string('address', 300).nullable()
      table.string('city', 120).nullable()
      table.string('state', 5).nullable()
      table.string('zipcode', 15).nullable()

      table.text('notes').nullable() // observações gerais
      table.json('extra').nullable() // alergias, comorbidades etc.

      table.boolean('is_active').defaultTo(true).notNullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      table.unique(['clinic_id', 'cpf'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
