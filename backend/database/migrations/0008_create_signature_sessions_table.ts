import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'signature_sessions'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table
        .integer('user_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')
      table.string('provider', 30).notNullable() // 'vidaas' | 'birdid' | ...
      table.string('code_verifier', 200).notNullable()
      table.string('cpf', 20).nullable()
      table.text('document_ids').notNullable() // JSON array de uuids
      table
        .enum('status', [
          'pending', // criada, esperando médico autenticar
          'authenticated', // callback recebido, token armazenado
          'signing', // assinatura em curso
          'signed', // todos os docs assinados
          'failed', // erro
          'expired', // passou do prazo (5 min)
        ])
        .defaultTo('pending')
        .notNullable()
      table.text('access_token').nullable() // token bruto do provider (transient)
      table.text('error').nullable()
      table.json('metadata').nullable() // payloads de retorno do provider
      table.timestamp('expires_at').notNullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      table.index(['user_id', 'status'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
