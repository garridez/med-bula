import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'clinics'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table.string('name', 200).notNullable()
      table.string('cnpj', 20).nullable()
      table.string('phone', 30).nullable()
      table.string('address', 300).nullable()
      table.string('logo_url', 500).nullable()
      table.string('primary_color', 20).defaultTo('#e53935')
      table.boolean('is_active').defaultTo(true).notNullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
