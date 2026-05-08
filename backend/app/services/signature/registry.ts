import type { SignatureProvider } from '#services/signature/signature_provider'
import VidaasProvider from '#services/signature/vidaas_provider'

/**
 * Registry de provedores de assinatura. Adicionar novo provider depois é só:
 *   1. Implementar SignatureProvider em app/services/signature/<nome>_provider.ts
 *   2. registry.register(new <Nome>Provider()) abaixo
 *
 * O ID interno do provider (vidaas, birdid, etc) é o que vai no campo
 * users.signature_provider e documents.signature_provider.
 */
class SignatureProviderRegistry {
  private providers = new Map<string, SignatureProvider>()

  register(provider: SignatureProvider) {
    this.providers.set(provider.info.id, provider)
  }

  get(id: string): SignatureProvider | null {
    return this.providers.get(id) ?? null
  }

  getOrThrow(id: string): SignatureProvider {
    const p = this.get(id)
    if (!p) throw new Error(`Provider de assinatura não encontrado: ${id}`)
    return p
  }

  list(): SignatureProvider[] {
    return Array.from(this.providers.values())
  }

  listAvailable(): SignatureProvider[] {
    return this.list().filter((p) => p.info.available)
  }
}

const registry = new SignatureProviderRegistry()

// Registra Vidaas. Adicionar Bird-ID etc. aqui no futuro.
registry.register(new VidaasProvider())

export default registry
