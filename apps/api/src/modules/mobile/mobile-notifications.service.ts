import { Injectable, Logger } from '@nestjs/common'
import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm'
import * as admin from 'firebase-admin'
import { DatabaseService } from '../../db/database.service'
import {
  notifications,
  pushTokens,
  teamMembers,
  registrations,
  editions,
  leagues,
  organizationMembers,
} from '../../db/schema'
import { ForbiddenException } from '@nestjs/common'

type NotifType = 'match' | 'result' | 'team' | 'edition' | 'social' | 'system'
interface NotifPayload {
  type: NotifType
  title: string
  body: string
  data?: Record<string, string>
}

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'

@Injectable()
export class MobileNotificationsService {
  private readonly logger = new Logger('Notifications')

  constructor(private readonly database: DatabaseService) {}
  private get db() {
    return this.database.db
  }

  // ── Push tokens ──────────────────────────────────────────────
  async registerToken(uid: string, token: string, platform?: string) {
    if (!token) return { ok: false }
    await this.db
      .insert(pushTokens)
      .values({ uid, token, platform: platform ?? null })
      .onConflictDoUpdate({
        target: pushTokens.token,
        set: { uid, platform: platform ?? null, updatedAt: new Date() },
      })
    return { ok: true }
  }

  async removeToken(uid: string, token: string) {
    await this.db
      .delete(pushTokens)
      .where(and(eq(pushTokens.uid, uid), eq(pushTokens.token, token)))
    return { ok: true }
  }

  // ── Feed ─────────────────────────────────────────────────────
  async list(uid: string, limit = 50) {
    return this.db
      .select({
        id: notifications.id,
        type: notifications.type,
        title: notifications.title,
        body: notifications.body,
        data: notifications.data,
        read: sql<boolean>`${notifications.readAt} is not null`,
        createdAt: notifications.createdAt,
      })
      .from(notifications)
      .where(eq(notifications.recipientUid, uid))
      .orderBy(desc(notifications.createdAt))
      .limit(limit)
  }

  async unreadCount(uid: string) {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(notifications)
      .where(and(eq(notifications.recipientUid, uid), isNull(notifications.readAt)))
    return { count: row?.count ?? 0 }
  }

  async markRead(uid: string, id: string) {
    await this.db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(and(eq(notifications.id, id), eq(notifications.recipientUid, uid), isNull(notifications.readAt)))
    return { ok: true }
  }

  async markAllRead(uid: string) {
    await this.db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(and(eq(notifications.recipientUid, uid), isNull(notifications.readAt)))
    return { ok: true }
  }

  // ── Crear notificaciones (persiste + push) ───────────────────
  /** Crea la misma notificación para varios usuarios y les envía push. Best-effort. */
  async createFor(recipientUids: string[], p: NotifPayload) {
    const uids = [...new Set(recipientUids.filter(Boolean))]
    if (uids.length === 0) return
    try {
      await this.db.insert(notifications).values(
        uids.map((uid) => ({
          recipientUid: uid,
          type: p.type,
          title: p.title,
          body: p.body,
          data: p.data ?? null,
        })),
      )
    } catch (err) {
      this.logger.error(`persist notifications: ${(err as Error).message}`)
    }
    // Push en segundo plano; no bloquea la respuesta del request.
    this.sendPush(uids, p).catch((err) =>
      this.logger.error(`sendPush: ${(err as Error).message}`),
    )
  }

  /** Notifica a todos los miembros de un equipo (opcionalmente excluyendo a uno). */
  async notifyTeam(teamId: string, p: NotifPayload, exceptUid?: string) {
    const members = await this.db
      .select({ uid: teamMembers.playerUid })
      .from(teamMembers)
      .where(eq(teamMembers.teamId, teamId))
    const uids = members.map((m) => m.uid).filter((u) => u && u !== exceptUid)
    await this.createFor(uids, p)
  }

  /**
   * Difusión a los jugadores de una edición (o de un grupo específico). Crea la
   * notificación en el feed de cada uno y envía push (iOS+Android). Devuelve conteos.
   */
  /** Verifica que el uid administre la organización dueña de la edición. */
  private async assertEditionAdmin(uid: string, editionId: string) {
    const [row] = await this.db
      .select({ orgId: leagues.organizationId })
      .from(editions)
      .innerJoin(leagues, eq(leagues.id, editions.leagueId))
      .where(eq(editions.id, editionId))
    if (!row) throw new ForbiddenException('Edición no encontrada')
    const [member] = await this.db
      .select({ id: organizationMembers.id })
      .from(organizationMembers)
      .where(and(eq(organizationMembers.organizationId, row.orgId), eq(organizationMembers.uid, uid)))
    if (!member) throw new ForbiddenException('No administras este campeonato')
  }

  async broadcastToEdition(
    actorUid: string,
    editionId: string,
    p: NotifPayload,
    opts?: { groupId?: string },
  ) {
    await this.assertEditionAdmin(actorUid, editionId)
    const conds = [
      eq(registrations.editionId, editionId),
      sql`${registrations.status} not in ('rejected','withdrawn')`,
    ]
    if (opts?.groupId) conds.push(eq(registrations.groupId, opts.groupId))

    const rows = await this.db
      .selectDistinct({ uid: teamMembers.playerUid })
      .from(teamMembers)
      .innerJoin(registrations, eq(registrations.teamId, teamMembers.teamId))
      .where(and(...conds))

    const uids = [...new Set(rows.map((r) => r.uid).filter(Boolean))]
    await this.createFor(uids, p)

    const tokenRows = uids.length
      ? await this.db
          .select({ token: pushTokens.token })
          .from(pushTokens)
          .where(inArray(pushTokens.uid, uids))
      : []
    const ios = tokenRows.filter((t) => t.token.startsWith('ExponentPushToken')).length
    const android = tokenRows.length - ios
    return { recipients: uids.length, pushed: { ios, android } }
  }

  // ── Push (híbrido) ───────────────────────────────────────────
  // iOS → Expo Push (exp.host). Android → FCM nativo vía firebase-admin (ADC, sin claves).
  private async sendPush(uids: string[], p: NotifPayload) {
    const rows = await this.db
      .select({ token: pushTokens.token })
      .from(pushTokens)
      .where(inArray(pushTokens.uid, uids))
    const all = rows.map((r) => r.token).filter(Boolean)
    if (all.length === 0) return

    const expoTokens = all.filter((t) => t.startsWith('ExponentPushToken'))
    const fcmTokens = all.filter((t) => !t.startsWith('ExponentPushToken'))

    if (expoTokens.length) await this.sendExpo(expoTokens, p).catch((e) => this.logger.warn(`expo: ${e}`))
    if (fcmTokens.length) await this.sendFcm(fcmTokens, p).catch((e) => this.logger.warn(`fcm: ${e}`))
  }

  private async sendExpo(tokens: string[], p: NotifPayload) {
    const messages = tokens.map((to) => ({
      to, sound: 'default', title: p.title, body: p.body, data: p.data ?? {}, channelId: 'default',
    }))
    for (let i = 0; i < messages.length; i += 100) {
      const batch = messages.slice(i, i + 100)
      const res = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(batch),
      })
      if (!res.ok) { this.logger.warn(`Expo push HTTP ${res.status}`); continue }
      try {
        const json: any = await res.json()
        const dead = (json?.data ?? [])
          .map((t: any, idx: number) => (t?.details?.error === 'DeviceNotRegistered' ? batch[idx].to : null))
          .filter(Boolean) as string[]
        if (dead.length) await this.db.delete(pushTokens).where(inArray(pushTokens.token, dead))
      } catch { /* no-JSON */ }
    }
  }

  private async sendFcm(tokens: string[], p: NotifPayload) {
    const res = await admin.messaging().sendEachForMulticast({
      tokens,
      notification: { title: p.title, body: p.body },
      // FCM data debe ser Record<string,string>.
      data: p.data ?? {},
      android: { priority: 'high', notification: { channelId: 'default', color: '#7BFF00' } },
    })
    // Limpiar tokens FCM inválidos (UNREGISTERED / invalid-argument).
    const dead: string[] = []
    res.responses.forEach((r, i) => {
      const code = r.error?.code
      if (code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-argument') {
        dead.push(tokens[i])
      }
    })
    if (dead.length) await this.db.delete(pushTokens).where(inArray(pushTokens.token, dead))
  }
}
