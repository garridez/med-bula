import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import type { HttpContext } from '@adonisjs/core/http'
import Clinic from '#models/clinic'
import User from '#models/user'
import {
  createClinicValidator,
  updateClinicValidator,
  impersonateValidator,
} from '#validators/admin'

/**
 * Drop 5e — Painel do super_admin (dono do SaaS).
 *
 * Permissão: TODAS as rotas exigem role=super_admin (gate no router).
 *
 * Features:
 *  - CRUD de clínicas + criar gestor inicial atomicamente
 *  - Personificar qualquer user pra dar suporte/teste
 *  - Métricas globais
 */
export default class AdminController {
  // ============================================================
  // CLÍNICAS
  // ============================================================

  /**
   * GET /api/admin/clinics?q=&status=&plan=
   * Lista todas as clínicas com contagem de usuários e ações.
   */
  async listClinics({ request }: HttpContext) {
    const q = (request.input('q') as string)?.trim()
    const status = request.input('status') as string | undefined
    const plan = request.input('plan') as string | undefined

    const query = Clinic.query().orderBy('created_at', 'desc')
    if (q) {
      query.where((b) =>
        b.whereILike('name', `%${q}%`).orWhereILike('cnpj', `%${q}%`)
      )
    }
    if (status) query.where('subscription_status', status)
    if (plan) query.where('plan', plan)

    const clinics = await query

    // Counts em uma query só pra evitar N+1
    const counts: any[] = await db
      .from('users')
      .select('clinic_id', 'role')
      .count('* as total')
      .whereIn(
        'clinic_id',
        clinics.map((c) => c.id)
      )
      .where('is_active', true)
      .groupBy('clinic_id', 'role')
    const countMap = new Map<number, Record<string, number>>()
    for (const row of counts) {
      const cur = countMap.get(row.clinic_id) ?? {}
      cur[row.role] = Number(row.total)
      countMap.set(row.clinic_id, cur)
    }

    return {
      data: clinics.map((c) => ({
        ...c.serialize(),
        counts: countMap.get(c.id) ?? {},
      })),
    }
  }

  /**
   * GET /api/admin/clinics/:id
   * Detalhes da clínica + lista de usuários.
   */
  async showClinic({ params, response }: HttpContext) {
    const clinic = await Clinic.find(params.id)
    if (!clinic) return response.notFound({ error: 'Clínica não encontrada' })

    const users = await User.query()
      .where('clinic_id', clinic.id)
      .orderBy('role', 'asc')
      .orderBy('full_name', 'asc')

    return { data: { ...clinic.serialize(), users } }
  }

  /**
   * POST /api/admin/clinics
   * Cria clínica + gestor inicial em transação atômica.
   *
   * Se plan='consultorio': gestor = doctor (CRM obrigatório na prática,
   *   mas não forçado no validator pra permitir cadastro provisório)
   * Se plan='clinica': gestor = admin
   */
  async createClinic({ request, response }: HttpContext) {
    const data = await request.validateUsing(createClinicValidator)

    // Email globalmente único
    const dup = await User.findBy('email', data.initialUser.email)
    if (dup) {
      return response.conflict({ error: 'Email já em uso por outro usuário' })
    }

    const trx = await db.transaction()
    try {
      const clinic = await Clinic.create(
        {
          name: data.clinic.name,
          cnpj: data.clinic.cnpj ?? null,
          phone: data.clinic.phone ?? null,
          address: data.clinic.address ?? null,
          plan: data.clinic.plan,
          primaryColor: '#e53935',
          monthlyFee: data.clinic.monthlyFee ?? null,
          subscriptionStatus: data.clinic.subscriptionStatus ?? 'active',
          subscriptionStartedAt: DateTime.now(),
          isActive: true,
        } as any,
        { client: trx }
      )

      const role = data.clinic.plan === 'consultorio' ? 'doctor' : 'admin'
      const user = await User.create(
        {
          clinicId: clinic.id,
          role,
          fullName: data.initialUser.fullName,
          email: data.initialUser.email,
          password: data.initialUser.password,
          phone: data.initialUser.phone ?? null,
          cpf: data.initialUser.cpf ?? null,
          crm: role === 'doctor' ? data.initialUser.crm ?? null : null,
          crmUf: role === 'doctor' ? data.initialUser.crmUf ?? null : null,
          specialty: role === 'doctor' ? data.initialUser.specialty ?? null : null,
          consultationPrice:
            role === 'doctor' ? data.initialUser.consultationPrice ?? null : null,
          signatureProvider: role === 'doctor' ? 'vidaas' : null,
          isActive: true,
        } as any,
        { client: trx }
      )

      await trx.commit()

      return response.created({ data: { clinic, user } })
    } catch (err) {
      await trx.rollback()
      throw err
    }
  }

  /**
   * PATCH /api/admin/clinics/:id
   */
  async updateClinic({ params, request, response }: HttpContext) {
    const clinic = await Clinic.find(params.id)
    if (!clinic) return response.notFound({ error: 'Clínica não encontrada' })

    const data = await request.validateUsing(updateClinicValidator)
    clinic.merge(data as any)
    await clinic.save()

    return { data: clinic }
  }

  /**
   * DELETE /api/admin/clinics/:id
   * Soft delete: marca isActive=false (e subscription cancelled).
   */
  async destroyClinic({ params, response }: HttpContext) {
    const clinic = await Clinic.find(params.id)
    if (!clinic) return response.notFound({ error: 'Clínica não encontrada' })

    clinic.isActive = false
    clinic.subscriptionStatus = 'cancelled'
    clinic.nextBillingAt = null
    await clinic.save()

    // Desativa todos os usuários da clínica também
    await User.query()
      .where('clinic_id', clinic.id)
      .update({ is_active: false } as any)

    return { ok: true }
  }

  // ============================================================
  // PERSONIFICAR
  // ============================================================

  /**
   * POST /api/admin/impersonate
   * Body: { userId }
   *
   * Gera um access token pra agir como aquele user. O super_admin
   * recebe o token e o frontend o usa como se fosse um login normal.
   * Pra "voltar", basta fazer logout + login como super_admin de novo.
   *
   * Audit trail mínimo: log no servidor.
   */
  async impersonate({ request, auth, response }: HttpContext) {
    const me = auth.getUserOrFail()
    const { userId } = await request.validateUsing(impersonateValidator)

    const target = await User.find(userId)
    if (!target) return response.notFound({ error: 'Usuário não encontrado' })
    if (!target.isActive) {
      return response.badRequest({ error: 'Usuário está inativo' })
    }
    if (target.id === me.id) {
      return response.badRequest({ error: 'Não personifique a si mesmo' })
    }
    if (target.clinicId) await target.load('clinic')

    const token = await User.accessTokens.create(target, ['*'], {
      name: `impersonate:${me.id}`,
      expiresIn: '1 day',
    })

    console.log(
      `[IMPERSONATE] super_admin ${me.id} (${me.email}) -> user ${target.id} (${target.email})`
    )

    return response.ok({
      token: token.value!.release(),
      expiresAt: token.expiresAt,
      user: {
        ...target.serialize(),
        clinic: target.clinic ? target.clinic.serialize() : null,
      },
      impersonatedBy: { id: me.id, email: me.email },
    })
  }

  // ============================================================
  // MÉTRICAS
  // ============================================================

  /**
   * GET /api/admin/metrics
   * Dashboard agregado pro super_admin.
   */
  async metrics() {
    const now = DateTime.now()
    const thisMonthStart = now.startOf('month')
    const lastMonthStart = now.minus({ months: 1 }).startOf('month')
    const lastMonthEnd = thisMonthStart.minus({ seconds: 1 })

    const clinics = await Clinic.query().where('is_active', true)
    const totalClinics = clinics.length
    const byStatus = {
      active: 0,
      past_due: 0,
      cancelled: 0,
      trial: 0,
    } as Record<string, number>
    const byPlan = { consultorio: 0, clinica: 0 } as Record<string, number>
    let mrr = 0
    for (const c of clinics) {
      byStatus[c.subscriptionStatus] = (byStatus[c.subscriptionStatus] ?? 0) + 1
      byPlan[c.plan] = (byPlan[c.plan] ?? 0) + 1
      if (c.subscriptionStatus === 'active' && c.monthlyFee) {
        mrr += Number(c.monthlyFee)
      }
    }

    // Novas clínicas este mês e mês passado
    const newThisMonth = await Clinic.query()
      .where('created_at', '>=', thisMonthStart.toJSDate() as any)
      .count('* as total')
      .first()
    const newLastMonth = await Clinic.query()
      .whereBetween('created_at', [
        lastMonthStart.toJSDate() as any,
        lastMonthEnd.toJSDate() as any,
      ])
      .count('* as total')
      .first()

    // Churn — clínicas canceladas no mês
    const churnThisMonth = await Clinic.query()
      .where('subscription_status', 'cancelled')
      .where('updated_at', '>=', thisMonthStart.toJSDate() as any)
      .count('* as total')
      .first()

    return {
      totalClinics,
      byStatus,
      byPlan,
      mrr,
      newThisMonth: Number(newThisMonth?.$extras.total ?? 0),
      newLastMonth: Number(newLastMonth?.$extras.total ?? 0),
      churnThisMonth: Number(churnThisMonth?.$extras.total ?? 0),
    }
  }
}
