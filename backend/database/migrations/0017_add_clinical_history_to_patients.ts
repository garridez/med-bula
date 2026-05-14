import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Drop P — Dados clínicos do paciente independentes de consulta.
 *
 * Cards editáveis na página do paciente:
 *  - clinical_history     Antec. clínicos (HAS, DM2, asma, ...)
 *  - surgical_history     Antec. cirúrgicos (apendicectomia 2010, ...)
 *  - family_history       Antec. familiares (mãe com HAS, ...)
 *  - habits               Hábitos (tabagista 10 maços/ano, etilismo social)
 *  - allergies            Alergias (penicilina, dipirona, ...)
 *  - medications_in_use   Medicamentos em uso (losartana 50mg 1x/dia, ...)
 *
 * Tudo TEXT free-form. Estrutura semelhante ao notes do SOAP — o médico
 * digita livremente, sem rigidez de schema.
 *
 * - diagnoses (JSONB): lista de CID-10 registrados ao longo do tempo.
 *   Schema do array: [{ code, description, recordedAt, recordedBy }]
 *   Útil pra ter um histórico de hipóteses e diagnósticos confirmados.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('patients', (table) => {
      table.text('clinical_history').nullable()
      table.text('surgical_history').nullable()
      table.text('family_history').nullable()
      table.text('habits').nullable()
      table.text('allergies').nullable()
      table.text('medications_in_use').nullable()
      table.jsonb('diagnoses').nullable()
    })
  }

  async down() {
    this.schema.alterTable('patients', (table) => {
      table.dropColumn('clinical_history')
      table.dropColumn('surgical_history')
      table.dropColumn('family_history')
      table.dropColumn('habits')
      table.dropColumn('allergies')
      table.dropColumn('medications_in_use')
      table.dropColumn('diagnoses')
    })
  }
}
