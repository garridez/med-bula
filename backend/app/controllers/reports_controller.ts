import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import type { HttpContext } from '@adonisjs/core/http'
import Appointment from '#models/appointment'

/**
 * Drop 5c — Relatórios financeiros.
 *
 * Lógica de "receita":
 *  - Total faturado: soma de `price` de consultas com paymentStatus = 'paid'.
 *    Esse é o valor cheio (particular ou convênio).
 *  - Recebido em mãos: soma de `copay_amount` de paid. Pra particular é o
 *    valor cheio; pra convênio é só o suplemento que o paciente pagou ali.
 *
 * Médico só vê os próprios números. Admin vê tudo da clínica e pode filtrar
 * por médico via query string `doctorId=`.
 */
export default class ReportsController {
  async financial({ request, auth, response }: HttpContext) {
    const user = auth.getUserOrFail()
    if (!user.clinicId) {
      return response.badRequest({ error: 'Usuário sem clínica' })
    }

    // Médico em plano clínica não acessa o financeiro — admin que cuida.
    if (user.role === 'doctor') {
      const clinic = await user.related('clinic').query().first()
      if (clinic?.plan !== 'consultorio') {
        return response.forbidden({
          error: 'Financeiro restrito ao gestor da clínica',
        })
      }
    }

    const fromStr = request.input('from')
    const toStr = request.input('to')
    const doctorIdParam = request.input('doctorId')

    const from = fromStr
      ? DateTime.fromISO(fromStr)
      : DateTime.now().startOf('month')
    const to = toStr
      ? DateTime.fromISO(toStr)
      : DateTime.now().endOf('month')

    if (!from.isValid || !to.isValid) {
      return response.badRequest({ error: 'Período inválido' })
    }

    // Período anterior do mesmo tamanho — comparação delta
    const days = Math.max(1, Math.round(to.diff(from, 'days').days))
    const prevTo = from.minus({ seconds: 1 })
    const prevFrom = prevTo.minus({ days })

    // Doctor scope
    let doctorId: number | null = null
    if (doctorIdParam) doctorId = Number(doctorIdParam)
    // Médico vê SÓ ele mesmo, ignorando query string
    if (user.role === 'doctor') doctorId = user.id

    // ---------- Pega todos os appointments do período ----------
    const baseQuery = db
      .from('appointments')
      .where('clinic_id', user.clinicId)
      .whereBetween('scheduled_at', [from.toJSDate(), to.toJSDate()])
    if (doctorId) baseQuery.where('doctor_id', doctorId)

    const rows: any[] = await baseQuery.select(
      'id',
      'scheduled_at',
      'status',
      'price',
      'copay_amount',
      'payment_status',
      'payment_method',
      'insurance_id'
    )

    // ---------- Summary ----------
    const summary = {
      totalRevenue: 0,
      totalCopay: 0,
      completedCount: 0,
      paidCount: 0,
      pendingCount: 0,
      noShowCount: 0,
    }
    for (const a of rows) {
      const price = Number(a.price ?? 0)
      const copay = Number(a.copay_amount ?? 0)

      if (a.payment_status === 'paid') {
        summary.totalRevenue += price
        summary.totalCopay += copay
        summary.paidCount++
      }
      if (a.status === 'completed') summary.completedCount++
      if (
        a.payment_status === 'pending' ||
        (a.status === 'completed' && a.payment_status === 'none')
      ) {
        summary.pendingCount++
      }
      if (a.status === 'no_show') summary.noShowCount++
    }

    // ---------- Período anterior (só revenue pra comparação) ----------
    const prevQ = db
      .from('appointments')
      .where('clinic_id', user.clinicId)
      .whereBetween('scheduled_at', [prevFrom.toJSDate(), prevTo.toJSDate()])
      .where('payment_status', 'paid')
    if (doctorId) prevQ.where('doctor_id', doctorId)
    const prevRows: any[] = await prevQ.select('price')
    let prevRevenue = 0
    for (const p of prevRows) prevRevenue += Number(p.price ?? 0)

    // ---------- Por método de pagamento ----------
    type MethodAgg = { count: number; total: number }
    const byMethodMap = new Map<string, MethodAgg>()
    for (const a of rows) {
      if (a.payment_status !== 'paid') continue
      const m = a.payment_method ?? 'unknown'
      const cur = byMethodMap.get(m) ?? { count: 0, total: 0 }
      cur.count++
      // Pra "recebido em mãos" usamos o copay; mas se for null (legacy)
      // usamos o price como fallback.
      cur.total += Number(a.copay_amount ?? a.price ?? 0)
      byMethodMap.set(m, cur)
    }
    const byMethod = Array.from(byMethodMap, ([method, v]) => ({
      method,
      count: v.count,
      total: v.total,
    })).sort((a, b) => b.total - a.total)

    // ---------- Por dia ----------
    const byDayMap = new Map<string, number>()
    for (const a of rows) {
      if (a.payment_status !== 'paid') continue
      const d = DateTime.fromJSDate(new Date(a.scheduled_at)).toISODate()
      if (!d) continue
      byDayMap.set(d, (byDayMap.get(d) ?? 0) + Number(a.price ?? 0))
    }
    const byDay = Array.from(byDayMap, ([date, total]) => ({ date, total })).sort(
      (a, b) => a.date.localeCompare(b.date)
    )

    // ---------- Lista de pagamentos (com preloads pra front) ----------
    const apptQ = Appointment.query()
      .where('clinic_id', user.clinicId)
      .whereBetween('scheduled_at', [from.toJSDate(), to.toJSDate()])
      .preload('patient')
      .preload('doctor')
      .preload('insurance')
      .orderBy('scheduled_at', 'desc')
      .limit(500)
    if (doctorId) apptQ.where('doctor_id', doctorId)
    const payments = await apptQ

    return {
      summary,
      previousPeriod: { totalRevenue: prevRevenue },
      byMethod,
      byDay,
      payments,
      range: { from: from.toISO(), to: to.toISO() },
    }
  }
}
