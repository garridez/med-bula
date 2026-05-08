import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'medical_records'

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
        .integer('patient_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('patients')
        .onDelete('CASCADE')
      table
        .integer('doctor_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')
      table
        .integer('appointment_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('appointments')
        .onDelete('SET NULL')

      // SOAP-ish
      table.text('subjective').nullable() // queixa
      table.text('objective').nullable() // exame físico
      table.text('assessment').nullable() // diagnóstico
      table.text('plan').nullable() // conduta
      table.text('notes').nullable() // bloco livre

      table.json('vitals').nullable() // PA, FC, FR, Temp, SpO2 etc.
      table.json('ai_summary').nullable() // v2 — resumo IA

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      table.index(['patient_id', 'created_at'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
