import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import Medication from '#models/medication'

/**
 * Drop C — Autocomplete de prescrição.
 *
 * Endpoints:
 *  - GET /api/medications/search?q=...&limit=10
 *  - GET /api/medications/:id
 *  - GET /api/medications/:id/posologies
 *
 * Permissão: bloqueia secretária (não prescreve). Médico, admin de
 * clínica e super_admin podem buscar.
 */
export default class MedicationsController {
  /**
   * Busca trigram em `search_text`. Ranking:
   *   1. similaridade
   *   2. prefere Referência
   *   3. prefere available=true
   *   4. ordem alfabética
   */
  async search({ request }: HttpContext) {
    const q = (request.input('q', '') as string).trim()
    const limit = Math.min(Number(request.input('limit', 10)), 30)
    const prescribableOnly = request.input('prescribable', 'true') === 'true'

    if (q.length < 2) {
      return { data: [] }
    }

    // Normaliza (lower + unaccent) pra bater com a coluna gerada
    const normRows = await db.rawQuery(
      `SELECT lower(immutable_unaccent(?)) AS q`,
      [q]
    )
    const normQ = normRows.rows?.[0]?.q ?? q.toLowerCase()

    let queryBuilder = db
      .from('medications')
      .select(
        'id',
        'title',
        'subtitle',
        'description',
        'laboratory_name',
        'category',
        'prescription_type',
        'list_type',
        'unit_singular',
        'unit_plural',
        'available',
        db.raw('similarity(search_text, ?) AS sim', [normQ])
      )
      .where((b) => {
        b.whereRaw('search_text % ?', [normQ]).orWhereRaw(
          "search_text ILIKE '%' || ? || '%'",
          [normQ]
        )
      })

    // Filtra meds prescritíveis (exclui cosméticos/suplementos sem prescrição_type)
    if (prescribableOnly) {
      queryBuilder = queryBuilder.whereNotNull('prescription_type')
    }

    const rows = await queryBuilder
      .orderByRaw('sim DESC')
      .orderByRaw(`(category = 'Referência') DESC`)
      .orderBy('available', 'desc')
      .orderBy('title', 'asc')
      .limit(limit)

    return {
      data: rows.map((r: any) => ({
        id: r.id,
        title: r.title,
        subtitle: r.subtitle,
        activeIngredient: r.description,
        laboratoryName: r.laboratory_name,
        category: r.category,
        prescriptionType: r.prescription_type,
        listType: r.list_type,
        unitSingular: r.unit_singular,
        unitPlural: r.unit_plural,
        available: r.available,
      })),
    }
  }

  async show({ params, response }: HttpContext) {
    const med = await Medication.find(params.id)
    if (!med) return response.notFound({ error: 'Medicamento não encontrado' })
    return { data: med }
  }

  /**
   * Posologias com fallback automático: se o medicamento alvo não tem
   * posologias diretas (bug conhecido da Cliquerx — só armazena pra UMA
   * apresentação por princípio ativo), busca posologias de OUTRO med com
   * mesmo `description` (princípio ativo), preferindo Referência.
   *
   * Retorna `source: 'direct' | 'fallback'` pra UI poder mostrar aviso.
   */
  async posologies({ params, response }: HttpContext) {
    const med = await Medication.find(params.id)
    if (!med) return response.notFound({ error: 'Medicamento não encontrado' })

    // 1. Tenta diretas
    const direct = await db
      .from('medication_posologies')
      .where('medication_id', med.id)
      .orderBy('id', 'asc')

    if (direct.length > 0) {
      return {
        source: 'direct' as const,
        data: direct.map((p: any) => this.mapPosology(p)),
      }
    }

    // 2. Fallback por princípio ativo (description)
    if (!med.description) {
      return { source: 'direct' as const, data: [] }
    }

    const fallback = await db
      .from('medication_posologies as p')
      .join('medications as m', 'm.id', 'p.medication_id')
      .where('m.description', med.description)
      .whereNot('m.id', med.id)
      .select(
        'p.id',
        'p.medication_id',
        'p.posology_id',
        'p.content',
        'p.usage_quantity',
        'p.indication',
        'p.population',
        'p.age_range',
        'p.type',
        'm.title as source_title',
        'm.category as source_category'
      )
      .orderByRaw(`(m.category = 'Referência') DESC`)
      .orderBy('m.title', 'asc')
      .limit(8)

    return {
      source: 'fallback' as const,
      sourceMedicationTitle: fallback[0]?.source_title ?? null,
      data: fallback.map((p: any) => this.mapPosology(p)),
    }
  }

  private mapPosology(p: any) {
    return {
      id: p.id,
      content: p.content,
      usageQuantity: p.usage_quantity,
      indication: p.indication,
      population: p.population,
      ageRange: p.age_range,
      type: p.type,
    }
  }
}
