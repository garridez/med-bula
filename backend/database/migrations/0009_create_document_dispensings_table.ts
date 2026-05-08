import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'document_dispensings'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table
        .uuid('document_id')
        .notNullable()
        .references('id')
        .inTable('documents')
        .onDelete('CASCADE')
      table.string('cnpj', 14).notNullable() // sempre só dígitos
      table.string('name', 200).nullable() // nome livre, opcional
      table.string('actor_type', 30).notNullable() // pharmacy | lab | employer
      table.string('ip_address', 45).nullable()
      table.timestamp('dispensed_at').notNullable()
      table.timestamp('created_at').notNullable()

      table.index('document_id')
      table.index('cnpj')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
