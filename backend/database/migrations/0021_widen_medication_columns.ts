import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Aumenta os tamanhos das colunas varchar das tabelas medications e
 * medication_posologies. Os limites originais eram muito apertados pros
 * dados reais da Cliquerx.
 *
 * Casos que estouravam:
 *  - category: "Produto de Terapia Avançada" (27 chars)
 *  - prescription_type: "Branca (Controle Especial)" (26 chars)
 *  - category: "Contraste Radiológico" (21 chars)
 *
 * Estratégia: usar TEXT (sem teto) em todas as colunas de classificação
 * que vêm da API, pra eliminar essa classe de bug pra sempre. Em Postgres
 * TEXT não tem custo extra vs VARCHAR.
 */
export default class extends BaseSchema {
  async up() {
    // medications
    this.schema.alterTable('medications', (table) => {
      table.text('category').alter()
      table.text('list_type').alter()
      table.text('prescription_type').alter()
      table.text('unit_singular').alter()
      table.text('unit_plural').alter()
      table.text('ean1').alter()
    })

    // medication_posologies
    this.schema.alterTable('medication_posologies', (table) => {
      table.text('posology_id').alter()
      table.text('population').alter()
      table.text('age_range').alter()
      table.text('type').alter()
    })
  }

  async down() {
    // não dá pra reduzir sem risco de perder dados, mas mantém a forma
    this.schema.alterTable('medications', (table) => {
      table.string('category', 20).alter()
      table.string('list_type', 20).alter()
      table.string('prescription_type', 20).alter()
      table.string('unit_singular', 20).alter()
      table.string('unit_plural', 20).alter()
      table.string('ean1', 20).alter()
    })
    this.schema.alterTable('medication_posologies', (table) => {
      table.string('posology_id', 50).alter()
      table.string('population', 100).alter()
      table.string('age_range', 100).alter()
      table.string('type', 30).alter()
    })
  }
}
