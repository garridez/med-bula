import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Drop pré-Medicamentos — habilita extensões e cria função IMMUTABLE de unaccent.
 *
 * Por que precisamos disso?
 *   - `unaccent()` nativo do Postgres é STABLE, não IMMUTABLE.
 *   - Índices funcionais e generated columns precisam de IMMUTABLE.
 *   - Solução padrão: criar wrapper IMMUTABLE.
 *
 * pg_trgm: pra busca por similaridade ("paractm" → "Paracetamol") com índice GIN.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.raw('CREATE EXTENSION IF NOT EXISTS unaccent')
    this.schema.raw('CREATE EXTENSION IF NOT EXISTS pg_trgm')

    this.schema.raw(`
      CREATE OR REPLACE FUNCTION immutable_unaccent(text)
      RETURNS text
      LANGUAGE sql
      IMMUTABLE PARALLEL SAFE STRICT
      AS $$
        SELECT public.unaccent('public.unaccent'::regdictionary, $1)
      $$
    `)
  }

  async down() {
    this.schema.raw('DROP FUNCTION IF EXISTS immutable_unaccent(text)')
    // não dropamos as extensões — podem estar em uso por outras coisas
  }
}
