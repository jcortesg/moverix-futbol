import { BadRequestException, Injectable } from '@nestjs/common'
import * as admin from 'firebase-admin'
import { and, asc, desc, eq, ilike, or } from 'drizzle-orm'
import { DatabaseService } from '../../db/database.service'
import {
  editions, leagues, matchdays, matches, matchDelegates, playerProfiles, referees,
} from '../../db/schema'

@Injectable()
export class MatchDelegatesService {
  constructor(private readonly database: DatabaseService) {}
  private get db() {
    return this.database.db
  }

  /** Delegados asignados a un partido (con nombre/usuario). */
  async findByMatch(matchId: string) {
    return this.db
      .select({
        id: matchDelegates.id,
        uid: matchDelegates.uid,
        role: matchDelegates.role,
        pendingEmail: matchDelegates.pendingEmail,
        invitedName: matchDelegates.invitedName,
        createdAt: matchDelegates.createdAt,
        fullName: playerProfiles.fullName,
        username: playerProfiles.username,
        avatarUrl: playerProfiles.avatarUrl,
      })
      .from(matchDelegates)
      .leftJoin(playerProfiles, eq(playerProfiles.uid, matchDelegates.uid))
      .where(eq(matchDelegates.matchId, matchId))
      .orderBy(desc(matchDelegates.createdAt))
  }

  /**
   * Asigna un delegado al partido. Dos vías:
   *  - `uid`: la persona ya tiene cuenta.
   *  - `email`: todavía no. La fila queda PENDIENTE y se vincula sola cuando
   *    esa persona se registre con ese correo (ver claimPendingMatchDelegates).
   */
  async assign(
    dto: { matchId: string; uid?: string; email?: string; name?: string; role?: string },
    assignedByUid: string,
  ) {
    const { matchId } = dto
    const role = dto.role ?? 'delegate'
    const email = dto.email?.trim().toLowerCase()

    if (!dto.uid && !email) {
      throw new BadRequestException('Indica el usuario o su correo')
    }

    // Con correo: si ya existe una cuenta con ese email, se asigna directo.
    if (!dto.uid && email) {
      const existingUid = await this.findUidByEmail(email)
      if (existingUid) {
        const [row] = await this.db
          .insert(matchDelegates)
          .values({ matchId, uid: existingUid, role, invitedName: dto.name?.trim() || null, assignedByUid })
          .onConflictDoNothing({ target: [matchDelegates.matchId, matchDelegates.uid] })
          .returning()
        return row ?? { ok: true, alreadyAssigned: true }
      }

      const [row] = await this.db
        .insert(matchDelegates)
        .values({ matchId, pendingEmail: email, invitedName: dto.name?.trim() || null, role, assignedByUid })
        .onConflictDoNothing()
        .returning()
      return row ?? { ok: true, pending: true }
    }

    const [row] = await this.db
      .insert(matchDelegates)
      .values({ matchId, uid: dto.uid!, role, assignedByUid })
      .onConflictDoNothing({ target: [matchDelegates.matchId, matchDelegates.uid] })
      .returning()
    return row ?? { ok: true }
  }

  /**
   * Delegados que este organizador ya ha asignado antes, para reutilizarlos sin
   * volver a buscar ni re-escribir el correo. Ordenados por uso reciente.
   */
  /** Delegados de la organización DUEÑA de este partido (match → ... → org). */
  async staffForMatch(matchId: string) {
    const [row] = await this.db
      .select({ organizationId: leagues.organizationId })
      .from(matches)
      .innerJoin(matchdays, eq(matchdays.id, matches.matchdayId))
      .innerJoin(editions, eq(editions.id, matchdays.editionId))
      .innerJoin(leagues, eq(leagues.id, editions.leagueId))
      .where(eq(matches.id, matchId))
    if (!row) return []
    return this.staffDirectory(row.organizationId)
  }

  async staffDirectory(organizationId: string) {
    const rows = await this.db
      .select({
        id: referees.id,
        fullName: referees.fullName,
        email: referees.email,
        phone: referees.phone,
        role: referees.role,
        photoUrl: referees.photoUrl,
      })
      .from(referees)
      .where(
        and(
          eq(referees.organizationId, organizationId),
          or(eq(referees.role, 'delegate'), eq(referees.role, 'both')),
        ),
      )
      .orderBy(asc(referees.fullName))
    return rows
  }

  async myDelegates(assignedByUid: string) {
    const rows = await this.db
      .select({
        uid: matchDelegates.uid,
        role: matchDelegates.role,
        pendingEmail: matchDelegates.pendingEmail,
        invitedName: matchDelegates.invitedName,
        fullName: playerProfiles.fullName,
        username: playerProfiles.username,
        avatarUrl: playerProfiles.avatarUrl,
        createdAt: matchDelegates.createdAt,
      })
      .from(matchDelegates)
      .leftJoin(playerProfiles, eq(playerProfiles.uid, matchDelegates.uid))
      .where(eq(matchDelegates.assignedByUid, assignedByUid))
      .orderBy(desc(matchDelegates.createdAt))
      .limit(60)

    // Una persona puede estar en muchos partidos: se deja una sola entrada.
    const seen = new Set<string>()
    const out: {
      uid: string | null
      email: string | null
      name: string
      avatarUrl: string | null
      pending: boolean
    }[] = []
    for (const r of rows) {
      const key = r.uid ?? `email:${(r.pendingEmail ?? '').toLowerCase()}`
      if (!key || seen.has(key)) continue
      seen.add(key)
      out.push({
        uid: r.uid,
        email: r.pendingEmail,
        name: r.fullName ?? r.invitedName ?? r.pendingEmail ?? 'Delegado',
        avatarUrl: r.avatarUrl ?? null,
        pending: !r.uid,
      })
      if (out.length >= 20) break
    }
    return out
  }

  /** Busca en Firebase si ese correo ya tiene cuenta. */
  private async findUidByEmail(email: string): Promise<string | null> {
    try {
      const user = await admin.auth().getUserByEmail(email)
      return user.uid
    } catch {
      return null
    }
  }

  async remove(id: string) {
    await this.db.delete(matchDelegates).where(eq(matchDelegates.id, id))
    return { ok: true }
  }

  /** Busca usuarios por username o nombre para asignarlos como delegados. */
  async searchUsers(q: string) {
    const term = q.trim()
    if (term.length < 2) return []
    const pattern = `%${term}%`
    return this.db
      .select({
        uid: playerProfiles.uid,
        username: playerProfiles.username,
        fullName: playerProfiles.fullName,
        avatarUrl: playerProfiles.avatarUrl,
      })
      .from(playerProfiles)
      .where(or(ilike(playerProfiles.username, pattern), ilike(playerProfiles.fullName, pattern)))
      .orderBy(playerProfiles.fullName)
      .limit(15)
  }

  /** matchId de un delegate row (para verificar ownership al borrar). */
  async matchIdOf(id: string) {
    const [row] = await this.db
      .select({ matchId: matchDelegates.matchId })
      .from(matchDelegates)
      .where(eq(matchDelegates.id, id))
    return row?.matchId ?? null
  }
}
