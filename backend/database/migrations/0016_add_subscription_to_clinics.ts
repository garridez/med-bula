import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Drop 5e — Estado de assinatura (cobrança da plataforma).
 *
 * - subscription_status: ciclo de vida da assinatura.
 * - monthly_fee: quanto a clínica paga pra plataforma POR MÊS. Esse valor
 *   é o que o super_admin define no cadastro. Não confundir com o preço
 *   da consulta (que é do médico).
 * - subscription_started_at: quando começou.
 * - next_billing_at: próxima cobrança (NULL se cancelada).
 * - trial_ends_at: fim do trial se estiver em trial (NULL caso contrário).
 *
 * O Drop 7 vai conectar isso com Efí pra cobrar automaticamente.
 * Aqui é só o schema + CRUD manual pelo super_admin.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('clinics', (table) => {
      table
        .enum('subscription_status', ['active', 'past_due', 'cancelled', 'trial'])
        .notNullable()
        .defaultTo('active')
      table.decimal('monthly_fee', 10, 2).nullable()
      table.timestamp('subscription_started_at').nullable()
      table.timestamp('next_billing_at').nullable()
      table.timestamp('trial_ends_at').nullable()
    })
  }

  async down() {
    this.schema.alterTable('clinics', (table) => {
      table.dropColumn('subscription_status')
      table.dropColumn('monthly_fee')
      table.dropColumn('subscription_started_at')
      table.dropColumn('next_billing_at')
      table.dropColumn('trial_ends_at')
    })
  }
}
