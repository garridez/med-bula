import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Converte os campos de texto livre da tabela medications de varchar(N) pra TEXT.
 *
 * COMPLICADOR: a coluna `search_text` é GENERATED ALWAYS AS dependendo de
 * title/description/laboratory_name. Postgres bloqueia ALTER nessas colunas
 * ("cannot alter type of a column used by a generated column").
 *
 * Sequência segura:
 *   1. Drop índice GIN trigram em search_text
 *   2. Drop coluna search_text
 *   3. Alter colunas-base pra TEXT
 *   4. Recria search_text com a mesma expressão (lower + immutable_unaccent)
 *   5. Recria o índice GIN
 */
export default class extends BaseSchema {
  async up() {
    // 1. drop índice (se existir — defensivo)
    this.schema.raw('DROP INDEX IF EXISTS medications_search_text_index')

    // 2. drop coluna gerada
    this.schema.alterTable('medications', (table) => {
      table.dropColumn('search_text')
    })

    // 3. alter colunas-base pra TEXT
    this.schema.alterTable('medications', (table) => {
      table.text('title').alter()
      table.text('subtitle').alter()
      table.text('description').alter()
      table.text('laboratory_name').alter()
    })

    // 4. recria search_text com a mesma expressão da migration 0018
    //    (usa a função immutable_unaccent criada na 0017)
    this.schema.raw(`
      ALTER TABLE medications
      ADD COLUMN search_text TEXT
      GENERATED ALWAYS AS (
        lower(immutable_unaccent(
          COALESCE(title, '') || ' ' ||
          COALESCE(description, '') || ' ' ||
          COALESCE(laboratory_name, '')
        ))
      ) STORED
    `)

    // 5. recria índice GIN trigram
    this.schema.raw(`
      CREATE INDEX medications_search_text_index
      ON medications
      USING gin (search_text gin_trgm_ops)
    `)

    // medication_posologies: indication pra TEXT
    this.schema.alterTable('medication_posologies', (table) => {
      table.text('indication').alter()
    })
  }

  async down() {
    this.schema.raw('DROP INDEX IF EXISTS medications_search_text_index')
    this.schema.alterTable('medications', (table) => {
      table.dropColumn('search_text')
    })
    this.schema.alterTable('medications', (table) => {
      table.string('title', 500).alter()
      table.string('subtitle', 500).alter()
      table.string('description', 500).alter()
      table.string('laboratory_name', 500).alter()
    })
    this.schema.raw(`
      ALTER TABLE medications
      ADD COLUMN search_text TEXT
      GENERATED ALWAYS AS (
        lower(immutable_unaccent(
          COALESCE(title, '') || ' ' ||
          COALESCE(description, '') || ' ' ||
          COALESCE(laboratory_name, '')
        ))
      ) STORED
    `)
    this.schema.raw(`
      CREATE INDEX medications_search_text_index
      ON medications
      USING gin (search_text gin_trgm_ops)
    `)
    this.schema.alterTable('medication_posologies', (table) => {
      table.string('indication', 500).alter()
    })
  }
}
