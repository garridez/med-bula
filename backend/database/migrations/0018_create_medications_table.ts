import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Catálogo de medicamentos importado do Cliquerx.
 *
 * - id é o UUID original do Cliquerx (reaproveitamos como PK).
 * - search_text é STORED: concatena title+description+laboratory_name,
 *   tudo minusculizado e SEM ACENTOS. Tem índice GIN com trigrama, ideal pra
 *   autocomplete: "paractm" casa com "Paracetamol", "diclofenco" com "Diclofenaco".
 *
 * Catálogo é COMPARTILHADO entre todas as clínicas (não tem clinic_id).
 * É read-only pro usuário final; populado/atualizado pelo scraper.
 */
export default class extends BaseSchema {
  protected tableName = 'medications'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary()
      table.string('title', 300).notNullable()
      table.string('subtitle', 300).nullable()
      table.string('description', 500).nullable()
      table.string('laboratory_name', 200).nullable()
      // Genérico | Similar | Referência | Suplemento | Dermocosmético...
      table.string('category', 50).nullable()
      table.decimal('max_price', 10, 2).nullable()
      table.boolean('available').notNullable().defaultTo(true)
      // N/A | B1 | A1 | A2 | A3 | B2 | C1 | C2 | C3 | C4 | C5 | Antibiótico
      table.string('list_type', 30).nullable()
      // Simples | Azul | Amarela | Branca | "Antibiótico - 2 vias"
      table.string('prescription_type', 50).nullable()
      table.string('ean1', 20).nullable()
      table.boolean('requires_cpf').notNullable().defaultTo(false)
      table.string('unit_singular', 30).nullable()
      table.string('unit_plural', 30).nullable()
      // Campo "campaign" descoberto no probe (q=paracetamol). Estrutura desconhecida,
      // jsonb pra capturar qualquer formato (promoção, desconto, lab parceiro etc.).
      table.jsonb('campaign').nullable()
      table.timestamp('created_at').notNullable().defaultTo(this.now())
      table.timestamp('updated_at').nullable()
    })

    // Generated column de busca normalizada.
    // Usa immutable_unaccent (criada na migration anterior).
    this.schema.raw(`
      ALTER TABLE medications
      ADD COLUMN search_text text
      GENERATED ALWAYS AS (
        lower(immutable_unaccent(
          coalesce(title, '') || ' ' ||
          coalesce(description, '') || ' ' ||
          coalesce(laboratory_name, '')
        ))
      ) STORED
    `)

    // Índice GIN com trigrama — busca aproximada rápida (ILIKE e similarity).
    this.schema.raw(`
      CREATE INDEX medications_search_trgm_idx
      ON medications USING gin (search_text gin_trgm_ops)
    `)

    // Índices secundários
    this.schema.raw(`
      CREATE INDEX medications_ean1_idx
      ON medications (ean1) WHERE ean1 IS NOT NULL
    `)
    this.schema.raw(`
      CREATE INDEX medications_available_idx
      ON medications (available) WHERE available = true
    `)
    this.schema.raw(`
      CREATE INDEX medications_list_type_idx
      ON medications (list_type) WHERE list_type IS NOT NULL AND list_type != 'N/A'
    `)
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
