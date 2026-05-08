import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'documents'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
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
      table
        .integer('medical_record_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('medical_records')
        .onDelete('SET NULL')

      table
        .enum('type', ['prescription', 'exam_request', 'medical_certificate'])
        .notNullable()
        .index()
      table.string('title', 200).nullable()

      // payload estruturado:
      // prescription -> { items: [{ name, dose, route, frequency, duration, notes, controlled? }] }
      // exam_request -> { items: [{ name, tuss?, notes }] }
      // medical_certificate -> { reason, days_off, cid?, notes }
      table.json('payload').notNullable()

      // PDF + assinatura
      table.text('pdf_unsigned_base64').nullable()
      table.string('pdf_unsigned_sha256', 100).nullable()
      table.text('pdf_signed_base64').nullable()
      table.string('signature_provider', 30).nullable() // vidaas | bird-id...
      table.json('signature_metadata').nullable()

      table
        .enum('status', ['draft', 'awaiting_signature', 'signed', 'delivered', 'cancelled'])
        .defaultTo('draft')
        .notNullable()
        .index()

      // entrega ao paciente (OTP = 4 últimos dígitos do telefone)
      table.string('delivery_token', 80).nullable().unique() // link curto
      table.timestamp('delivered_at').nullable()
      table.timestamp('first_viewed_at').nullable()
      table.integer('view_count').defaultTo(0).notNullable()

      // baixa farmacêutica (v2)
      table.string('pharmacy_cnpj', 20).nullable()
      table.timestamp('dispensed_at').nullable()

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
