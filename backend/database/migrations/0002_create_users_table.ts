import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'users'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table
        .integer('clinic_id')
        .unsigned()
        .references('id')
        .inTable('clinics')
        .onDelete('SET NULL')
        .nullable()
      table.string('full_name', 200).notNullable()
      table.string('email', 254).notNullable().unique()
      table.string('password', 180).notNullable()
      table.string('phone', 30).nullable()
      table.string('cpf', 20).nullable()
      table
        .enum('role', ['super_admin', 'admin', 'doctor', 'secretary'])
        .notNullable()
        .defaultTo('doctor')

      // doctor-specific
      table.string('crm', 30).nullable()
      table.string('crm_uf', 5).nullable()
      table.string('specialty', 120).nullable()
      table.string('signature_provider', 30).nullable() // vidaas | bird-id | etc.

      // secretary-specific permissions (json blob; configurable from doctor)
      table.json('permissions').nullable()

      table.boolean('is_active').defaultTo(true).notNullable()
      table.timestamp('last_login_at').nullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
