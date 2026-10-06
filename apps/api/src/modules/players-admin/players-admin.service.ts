import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { and, desc, eq, ilike, inArray, isNull, or } from 'drizzle-orm'
import { DatabaseService } from '../../db/database.service'
import {
  playerBans,
  registrationPlayers,
  registrations,
  teams,
  editions,
  leagues,
} from '../../db/schema'

/** Deja solo dígitos: las cédulas llegan con puntos, espacios o guiones. */
function normalizeDoc(raw: string) {
  return (raw ?? '').replace(/\D/g, '')
}

@Injectable()
export class PlayersAdminService {
  constructor(private readonly database: DatabaseService) {}

  private get db() {
    return this.database.db
  }

  /**
   * Busca personas por cédula o nombre dentro de los torneos de la organización.
   * Una misma persona aparece en varias filas si está en varios equipos: eso es
   * justamente lo que el organizador necesita ver.
   */
  async search(organizationId: string, query: string) {
    const q = (query ?? '').trim()
    if (q.length < 3) {
      throw new BadRequestException('Escribe al menos 3 caracteres para buscar')
    }

    const soloDigitos = normalizeDoc(q)
    const porDoc = soloDigitos.length >= 3

    const rows = await this.db
      .select({
        registrationPlayerId: registrationPlayers.id,
        playerUid: registrationPlayers.playerUid,
        playerName: registrationPlayers.playerName,
        firstName: registrationPlayers.firstName,
        lastName: registrationPlayers.lastName,
        docNumber: registrationPlayers.docNumber,
        email: registrationPlayers.email,
        phone: registrationPlayers.phone,
        jerseyNumber: registrationPlayers.jerseyNumber,
        removedAt: registrationPlayers.removedAt,
        teamId: teams.id,
        teamName: teams.name,
        teamLogoUrl: teams.logoUrl,
        editionId: editions.id,
        editionName: editions.name,
        registrationId: registrations.id,
      })
      .from(registrationPlayers)
      .innerJoin(registrations, eq(registrations.id, registrationPlayers.registrationId))
      .innerJoin(teams, eq(teams.id, registrations.teamId))
      .innerJoin(editions, eq(editions.id, registrations.editionId))
      .innerJoin(leagues, eq(leagues.id, editions.leagueId))
      .where(
        and(
          eq(leagues.organizationId, organizationId),
          porDoc
            ? or(
                ilike(registrationPlayers.docNumber, `%${soloDigitos}%`),
                ilike(registrationPlayers.playerName, `%${q}%`),
              )
            : or(
                ilike(registrationPlayers.playerName, `%${q}%`),
                ilike(registrationPlayers.firstName, `%${q}%`),
                ilike(registrationPlayers.lastName, `%${q}%`),
                ilike(registrationPlayers.email, `%${q}%`),
              ),
        ),
      )
      .orderBy(desc(registrationPlayers.addedAt))
      .limit(80)

    // Vetos vigentes de las cédulas encontradas, para marcarlas en el resultado.
    const docs = [...new Set(rows.map((r) => r.docNumber).filter(Boolean))] as string[]
    const bans = docs.length
      ? await this.db
          .select()
          .from(playerBans)
          .where(
            and(
              eq(playerBans.organizationId, organizationId),
              isNull(playerBans.liftedAt),
              inArray(playerBans.docNumber, docs),
            ),
          )
      : []
    const banByDoc = new Map(bans.map((b) => [b.docNumber, b]))

    return rows.map((r) => ({
      ...r,
      active: r.removedAt === null,
      ban: r.docNumber ? (banByDoc.get(r.docNumber) ?? null) : null,
    }))
  }

  // ── Vetos ──────────────────────────────────────────────

  async listBans(organizationId: string, includeLifted = false) {
    const rows = await this.db
      .select()
      .from(playerBans)
      .where(
        includeLifted
          ? eq(playerBans.organizationId, organizationId)
          : and(eq(playerBans.organizationId, organizationId), isNull(playerBans.liftedAt)),
      )
      .orderBy(desc(playerBans.createdAt))

    if (rows.length === 0) return []

    // ¿Alguno está inscrito hoy en un equipo? Es lo que hace útil la lista:
    // un veto que nadie cruza contra las nóminas no impide que el jugador juegue.
    const docs = rows.map((r) => r.docNumber)
    const enNomina = await this.db
      .select({
        docNumber: registrationPlayers.docNumber,
        teamName: teams.name,
        editionName: editions.name,
      })
      .from(registrationPlayers)
      .innerJoin(registrations, eq(registrations.id, registrationPlayers.registrationId))
      .innerJoin(teams, eq(teams.id, registrations.teamId))
      .innerJoin(editions, eq(editions.id, registrations.editionId))
      .innerJoin(leagues, eq(leagues.id, editions.leagueId))
      .where(
        and(
          eq(leagues.organizationId, organizationId),
          isNull(registrationPlayers.removedAt),
          inArray(registrationPlayers.docNumber, docs),
        ),
      )

    const porDoc = new Map<string, { teamName: string; editionName: string }[]>()
    for (const r of enNomina) {
      if (!r.docNumber) continue
      const lista = porDoc.get(r.docNumber) ?? []
      lista.push({ teamName: r.teamName, editionName: r.editionName })
      porDoc.set(r.docNumber, lista)
    }

    return rows.map((b) => ({ ...b, inRosters: porDoc.get(b.docNumber) ?? [] }))
  }

  async createBan(
    organizationId: string,
    dto: { docNumber: string; fullName: string; reason: string; until?: string | null },
    actorUid: string,
  ) {
    const doc = normalizeDoc(dto.docNumber)
    if (!doc) throw new BadRequestException('La cédula es obligatoria')
    if (!dto.fullName?.trim()) throw new BadRequestException('El nombre es obligatorio')
    if (!dto.reason?.trim()) throw new BadRequestException('La razón del veto es obligatoria')

    try {
      const [row] = await this.db
        .insert(playerBans)
        .values({
          organizationId,
          docNumber: doc,
          fullName: dto.fullName.trim(),
          reason: dto.reason.trim(),
          until: dto.until || null,
          createdBy: actorUid,
        })
        .returning()
      return row
    } catch (err: any) {
      const pg = err?.cause ?? err
      if (pg?.code === '23505') {
        throw new ConflictException('Esa cédula ya tiene un veto vigente en esta organización')
      }
      throw err
    }
  }

  /** Levanta el veto sin borrarlo: el historial de sanciones se conserva. */
  async liftBan(id: string, organizationId: string, reason?: string) {
    const [row] = await this.db
      .update(playerBans)
      .set({ liftedAt: new Date(), liftedReason: reason?.trim() || null, updatedAt: new Date() })
      .where(and(eq(playerBans.id, id), eq(playerBans.organizationId, organizationId)))
      .returning()
    if (!row) throw new NotFoundException('Veto no encontrado')
    return row
  }
}
