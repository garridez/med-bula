import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Drop 5b — Pricing por agendamento.
 *
 * - insurance_id: NULL = particular; senão FK pro convênio escolhido.
 * - copay_amount: suplemento em dinheiro do paciente quando convênio.
 *   Pra particular, igual ao price (paciente paga tudo). Pra convênio,
 *   default 0 ou valor que o paciente complementa.
 *
 * NOTA: appointments.price já existe desde a 0005 — não precisa adicionar.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('appointments', (table) => {
      table
        .integer('insurance_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('insurances')
        .onDelete('SET NULL')
      table.decimal('copay_amount', 10, 2).nullable()
    })
  }

  async down() {
    this.schema.alterTable('appointments', (table) => {
      table.dropColumn('insurance_id')
      table.dropColumn('copay_amount')
    })
  }
}
