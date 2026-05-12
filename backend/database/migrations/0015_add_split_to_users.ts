import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Drop 5d — Retenção/repasse por médico.
 *
 * - split_type: 'percentual' (% que fica com a clínica) ou
 *   'absoluto' (R$ fixo que fica com a clínica). Null = sem split
 *   (médico fica com 100%, típico de consultório).
 * - split_value: o valor associado. Pra percentual, 0-100. Pra
 *   absoluto, valor em reais.
 *
 * O cálculo do repasse é derivado em runtime no relatório financeiro
 * (Drop 5d futuro: relatório de repasses). Aqui só guardamos a config.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('users', (table) => {
      table.enum('split_type', ['percentual', 'absoluto']).nullable()
      table.decimal('split_value', 10, 2).nullable()
    })
  }

  async down() {
    this.schema.alterTable('users', (table) => {
      table.dropColumn('split_type')
      table.dropColumn('split_value')
    })
  }
}
