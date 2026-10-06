import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm'
import { DatabaseService } from '../../db/database.service'
import {
  matchDelegates,
  matchAttendance,
  matches,
  matchdays,
  editions,
  venues,
  registrations,
  registrationPlayers,
  playerProfiles,
  teams,
} from '../../db/schema'

@Injectable()
export class MobileRefereeService {
  constructor(private readonly database: DatabaseService) {}
  private get db() {
    return this.database.db
  }

  /** Verifica que el uid sea delegado del partido; devuelve datos base del match. */
  private async assertDelegate(uid: string, matchId: string) {
    const [row] = await this.db
      .select({
        id: matches.id,
        status: matches.status,
        homeTeamId: matches.homeTeamId,
        awayTeamId: matches.awayTeamId,
        homeScore: matches.homeScore,
        awayScore: matches.awayScore,
        scheduledAt: matches.scheduledAt,
        // La app usa `round` para saber si es llave: si empata, pide penales.
        round: matches.round,
        editionId: matchdays.editionId,
      })
      .from(matches)
      .innerJoin(matchdays, eq(matchdays.id, matches.matchdayId))
      .where(eq(matches.id, matchId))
    if (!row) throw new NotFoundException('Partido no encontrado')

    const [del] = await this.db
      .select({ id: matchDelegates.id })
      .from(matchDelegates)
      .where(and(eq(matchDelegates.matchId, matchId), eq(matchDelegates.uid, uid)))
    if (!del) throw new ForbiddenException('No eres delegado de este partido')
    return row
  }

  /** Partidos asignados al delegado (uid). */
  async myMatches(uid: string) {
    return this.db
      .select({
        matchId: matches.id,
        status: matches.status,
        homeScore: matches.homeScore,
        awayScore: matches.awayScore,
        scheduledAt: matches.scheduledAt,
        round: matches.round,
        editionName: editions.name,
        venueName: venues.name,
        homeTeamId: matches.homeTeamId,
        awayTeamId: matches.awayTeamId,
        homeTeam: sql<string>`ht.name`,
        homeTeamLogo: sql<string | null>`ht.logo_url`,
        awayTeam: sql<string>`at.name`,
        awayTeamLogo: sql<string | null>`at.logo_url`,
      })
      .from(matchDelegates)
      .innerJoin(matches, eq(matches.id, matchDelegates.matchId))
      .innerJoin(matchdays, eq(matchdays.id, matches.matchdayId))
      .innerJoin(editions, eq(editions.id, matchdays.editionId))
      .leftJoin(venues, eq(venues.id, matches.venueId))
      .leftJoin(sql`teams ht`, sql`ht.id = ${matches.homeTeamId}`)
      .leftJoin(sql`teams at`, sql`at.id = ${matches.awayTeamId}`)
      .where(eq(matchDelegates.uid, uid))
      .orderBy(sql`${matches.scheduledAt} asc nulls last`)
  }

  /** Detalle para dirigir: equipos, nóminas de ambos con asistencia, eventos, estado. */
  async matchDetail(uid: string, matchId: string) {
    const base = await this.assertDelegate(uid, matchId)

    const teamIds = [base.homeTeamId, base.awayTeamId].filter(Boolean) as string[]
    // Nombres de los equipos. Se usa el query builder y no SQL crudo: drizzle
    // interpola un array de JS como TUPLA ($1, $2), que Postgres rechaza en
    // `= ANY(...)`. Ese era el 500 al abrir el partido como delegado.
    const teamRows = teamIds.length
      ? await this.db
          .select({ id: teams.id, name: teams.name })
          .from(teams)
          .where(inArray(teams.id, teamIds))
      : []
    const nameById = new Map(teamRows.map((r) => [r.id, r.name]))
    // Nóminas de cada equipo (registration_players de su inscripción en la edición)
    const roster = teamIds.length
      ? await this.db
          .select({
            teamId: registrations.teamId,
            playerUid: registrationPlayers.playerUid,
            playerName: registrationPlayers.playerName,
            jerseyNumber: registrationPlayers.jerseyNumber,
            position: registrationPlayers.position,
            docNumber: registrationPlayers.docNumber,
            avatarUrl: playerProfiles.avatarUrl,
          })
          .from(registrationPlayers)
          .innerJoin(registrations, eq(registrations.id, registrationPlayers.registrationId))
          .leftJoin(playerProfiles, eq(playerProfiles.uid, registrationPlayers.playerUid))
          .where(
            and(
              eq(registrations.editionId, base.editionId),
              inArray(registrations.teamId, teamIds),
              // Un jugador dado de baja no puede recibir NUEVOS goles/tarjetas;
              // los eventos que ya tenga se conservan intactos.
              isNull(registrationPlayers.removedAt),
            ),
          )
          .orderBy(asc(registrationPlayers.jerseyNumber))
      : []

    // Asistencia registrada para este partido
    const att = await this.db
      .select({ playerUid: matchAttendance.playerUid, present: matchAttendance.present })
      .from(matchAttendance)
      .where(eq(matchAttendance.matchId, matchId))
    const presentMap = new Map(att.map((a) => [a.playerUid, a.present]))

    const withAttendance = roster.map((p) => ({
      ...p,
      present: presentMap.get(p.playerUid) ?? false,
    }))

    return {
      matchId: base.id,
      status: base.status,
      round: base.round,
      homeScore: base.homeScore,
      awayScore: base.awayScore,
      scheduledAt: base.scheduledAt,
      homeTeamId: base.homeTeamId,
      awayTeamId: base.awayTeamId,
      homeTeamName: base.homeTeamId ? nameById.get(base.homeTeamId) ?? 'Local' : 'Local',
      awayTeamName: base.awayTeamId ? nameById.get(base.awayTeamId) ?? 'Visitante' : 'Visitante',
      homeRoster: withAttendance.filter((p) => p.teamId === base.homeTeamId),
      awayRoster: withAttendance.filter((p) => p.teamId === base.awayTeamId),
    }
  }

  /** Marca la asistencia (check-in) de un jugador en el partido. */
  async setAttendance(
    uid: string,
    matchId: string,
    dto: { playerUid: string; teamId: string; present: boolean },
  ) {
    const base = await this.assertDelegate(uid, matchId)
    // Con el partido cerrado la planilla es un documento del juego: corregirla
    // es cosa del organizador, no del delegado.
    if (base.status === 'finished') {
      throw new ForbiddenException(
        'El partido ya está finalizado. Solo el organizador puede modificarlo.',
      )
    }
    await this.db
      .insert(matchAttendance)
      .values({
        matchId,
        teamId: dto.teamId,
        playerUid: dto.playerUid,
        present: dto.present,
        checkedByUid: uid,
      })
      .onConflictDoUpdate({
        target: [matchAttendance.matchId, matchAttendance.playerUid],
        set: { present: dto.present, checkedByUid: uid, updatedAt: new Date() },
      })
    return { ok: true }
  }
}
