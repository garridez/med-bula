import env from '#start/env'
import { defineConfig } from '@adonisjs/cors'

// Aceita CSV em FRONTEND_URL (ex: "https://med.bula.com.br,https://staging.med.bula.com.br")
const allowedOrigins = env
  .get('FRONTEND_URL', 'http://localhost:3000')
  .split(',')
  .map((s) => s.trim().replace(/\/+$/, ''))
  .filter(Boolean)

const isDev = env.get('NODE_ENV') !== 'production'

console.log(
  '[CORS] node_env=%s allowed=%j',
  isDev ? 'development' : 'production',
  allowedOrigins
)

const corsConfig = defineConfig({
  enabled: true,
  origin: (origin) => {
    if (!origin) return false
    const normalized = origin.replace(/\/+$/, '')
    if (allowedOrigins.includes(normalized)) return true
    // Em dev libera qualquer localhost/127.0.0.1 — útil pra Postman, IPs alternativos, etc.
    if (isDev && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(normalized)) {
      return true
    }
    return false
  },
  methods: ['GET', 'HEAD', 'POST', 'PUT', 'DELETE', 'PATCH'],
  headers: true,
  exposeHeaders: ['Authorization'],
  credentials: true,
  maxAge: 90,
})

export default corsConfig