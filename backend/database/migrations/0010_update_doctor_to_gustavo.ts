import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Atualiza o médico de teste do seeder pra Gustavo Felipe.
 * Usado pro fluxo Vidaas funcionar (login_hint = CPF do certificado).
 *
 * Roda em ambientes que já tinham o médico cadastrado como "Dra. Ana Silva".
 * Em deploys novos, o seeder já cria com os dados certos.
 */
export default class extends BaseSchema {
  async up() {
    this.defer(async (db) => {
      await db
        .from('users')
        .where('email', 'medico@clinica.com.br')
        .update({
          full_name: 'Gustavo Felipe',
          cpf: '064.131.076-50',
          updated_at: new Date(),
        })
    })
  }

  async down() {
    // Reverter pra valores antigos pro caso de rollback
    this.defer(async (db) => {
      await db
        .from('users')
        .where('email', 'medico@clinica.com.br')
        .update({
          full_name: 'Dra. Ana Silva',
          cpf: '111.222.333-44',
          updated_at: new Date(),
        })
    })
  }
}
