import logger from '@adonisjs/core/services/logger'
import env from '#start/env'

export interface WhatsAppMessage {
  to: string // E.164 ou só dígitos BR
  template: 'document_delivery' | 'appointment_reminder' | 'pix_advance'
  variables: Record<string, string>
}

export interface WhatsAppResult {
  messageId: string
  provider: string
  ok: boolean
}

/**
 * Provider mock — só loga no console + retorna ID fake.
 * Drop 6 troca por impl real (Z-API / Twilio / Meta Cloud API).
 */
class WhatsAppMockProvider {
  async send(msg: WhatsAppMessage): Promise<WhatsAppResult> {
    const id = `mock-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const body = this.renderTemplate(msg.template, msg.variables)

    logger.info(
      {
        whatsappMock: true,
        to: msg.to,
        template: msg.template,
        body,
        messageId: id,
      },
      `📱 [whatsapp:mock] -> ${msg.to}`
    )

    // Imprime visivelmente no stdout pra você conseguir copiar o link no terminal.
    console.log('━'.repeat(72))
    console.log(`📱  WHATSAPP MOCK  →  ${msg.to}`)
    console.log(`    template: ${msg.template}`)
    console.log(body.split('\n').map((l) => '    ' + l).join('\n'))
    console.log('━'.repeat(72))

    return { messageId: id, provider: 'mock', ok: true }
  }

  private renderTemplate(
    template: WhatsAppMessage['template'],
    vars: Record<string, string>
  ): string {
    switch (template) {
      case 'document_delivery':
        return [
          `Olá, ${vars.patientName ?? 'paciente'}!`,
          ``,
          `${vars.docTypeLabel ?? 'Seu documento'} do(a) ${vars.doctorName ?? 'seu médico(a)'} está pronto(a).`,
          ``,
          `Acesse aqui: ${vars.url}`,
          ``,
          `Pra abrir, digite os 4 últimos dígitos do seu telefone.`,
          `— med.bula`,
        ].join('\n')
      case 'appointment_reminder':
        return [
          `Olá, ${vars.patientName ?? 'paciente'}!`,
          `Lembrando da sua consulta com ${vars.doctorName} em ${vars.when}.`,
          `Aguardamos você!`,
        ].join('\n')
      case 'pix_advance':
        return [
          `Olá, ${vars.patientName ?? 'paciente'}!`,
          `Que tal garantir sua consulta antecipando o pagamento via PIX e ganhar ${vars.discount}% de desconto?`,
          `${vars.url}`,
        ].join('\n')
      default:
        return JSON.stringify(vars)
    }
  }
}

const mock = new WhatsAppMockProvider()

export const whatsapp = {
  send(msg: WhatsAppMessage): Promise<WhatsAppResult> {
    const provider = env.get('WHATSAPP_PROVIDER', 'mock')
    // No futuro, switch por provider — por hora todos caem no mock
    void provider
    return mock.send(msg)
  },
}
