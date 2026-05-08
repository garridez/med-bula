import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Drop 5a — Estrutura básica de plano + preço.
 *
 * - clinics.plan: 'consultorio' (1 médico, médico atua como admin) ou
 *   'clinica' (multi-médico, com role admin separado). Default consultorio.
 * - users.address: endereço do médico
 * - users.consultation_price: preço default da consulta (decimal BRL).
 *   Em consultório, o próprio médico configura. Em clínica, o admin configura.
 *
 * appointments.price já existe — vem pré-preenchida do médico no agendamento
 * mas pode ser editada (ex: amigos, particular, etc.).
 */
export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('clinics', (table) => {
      table
        .enum('plan', ['consultorio', 'clinica'])
        .notNullable()
        .defaultTo('consultorio')
    })

    this.schema.alterTable('users', (table) => {
      table.text('address').nullable()
      table.decimal('consultation_price', 10, 2).nullable()
    })
  }

  async down() {
    this.schema.alterTable('clinics', (table) => {
      table.dropColumn('plan')
    })
    this.schema.alterTable('users', (table) => {
      table.dropColumn('address')
      table.dropColumn('consultation_price')
    })
  }
}
