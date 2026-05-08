import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'appointments'

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
      table
        .integer('doctor_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')
      table
        .integer('patient_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('patients')
        .onDelete('CASCADE')

      table.timestamp('scheduled_at').notNullable().index()
      table.integer('duration_minutes').defaultTo(30).notNullable()
      table
        .enum('status', [
          'scheduled',
          'confirmed',
          'in_progress',
          'completed',
          'cancelled',
          'no_show',
        ])
        .defaultTo('scheduled')
        .notNullable()
      table.string('reason', 300).nullable()
      table.text('notes').nullable()

      // cobrança (v2 expande)
      table.decimal('price', 10, 2).nullable()
      table
        .enum('payment_status', ['none', 'pending', 'paid', 'refunded'])
        .defaultTo('none')
        .notNullable()
      table.string('payment_method', 30).nullable() // pix | card | cash | machine
      table.string('pix_txid', 60).nullable()

      // lembretes WhatsApp (v2)
      table.boolean('reminder_sent').defaultTo(false).notNullable()
      table.timestamp('reminder_sent_at').nullable()

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
