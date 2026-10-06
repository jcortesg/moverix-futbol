import { Injectable, NotFoundException } from '@nestjs/common'
import { eq, sql, asc, and, or, desc } from 'drizzle-orm'
import { DatabaseService } from '../../db/database.service'
import {
  matches,
  matchdays,
  matchEvents,
  registrations,
  registrationPlayers,
  editions,
  leagues,
  playerProfiles,
  venues,
  referees,
  groups,
} from '../../db/schema'

@Injectable()
export class MobileMatchesService {
  constructor(private readonly database: DatabaseService) {}

  private get db() {
    return this.database.db
  }

  /**
   * Full match detail: teams, score, events, lineups.
   */
  async detail(matchId: string) {
    // Match + teams + edition info
    const [row] = await this.db
      .select({
        id: matches.id,
        status: matches.status,
        homeScore: matches.homeScore,
        awayScore: matches.awayScore,
        homePenalties: matches.homePenalties,
        awayPenalties: matches.awayPenalties,
        scheduledAt: matches.scheduledAt,
        startedAt: matches.startedAt,
        finishedAt: matches.finishedAt,
        round: matches.round,
        groupId: matches.groupId,
        groupName: groups.name,
        venueName: venues.name,
        venueAddress: venues.address,
        venueCity: venues.city,
        venueLat: venues.lat,
        venueLng: venues.lng,
        refereeName: referees.fullName,
        matchdayName: matchdays.name,
        matchdayNumber: matchdays.number,
        editionId: matchdays.editionId,
        editionName: editions.name,
        leagueName: leagues.name,
        homeTeamId: matches.homeTeamId,
        awayTeamId: matches.awayTeamId,
        homeTeamName: sql<string>`ht.name`,
        homeTeamShort: sql<string | null>`ht.short_name`,
        homeTeamLogo: sql<string | null>`ht.logo_url`,
        homeTeamColor: sql<string | null>`ht.primary_color`,
        awayTeamName: sql<string>`at.name`,
        awayTeamShort: sql<string | null>`at.short_name`,
        awayTeamLogo: sql<string | null>`at.logo_url`,
        awayTeamColor: sql<string | null>`at.primary_color`,
      })
      .from(matches)
      .innerJoin(matchdays, eq(matchdays.id, matches.matchdayId))
      .innerJoin(editions, eq(editions.id, matchdays.editionId))
      .innerJoin(leagues, eq(leagues.id, editions.leagueId))
      .leftJoin(groups, eq(groups.id, matches.groupId))
      .leftJoin(venues, eq(venues.id, matches.venueId))
      .leftJoin(referees, eq(referees.id, matches.refereeId))
      .leftJoin(sql`teams ht`, sql`ht.id = ${matches.homeTeamId}`)
      .leftJoin(sql`teams at`, sql`at.id = ${matches.awayTeamId}`)
      .where(eq(matches.id, matchId))

    if (!row) throw new NotFoundException(`Partido no encontrado`)

    // Events (with player avatars)
    const events = await this.db
      .select({
        id: matchEvents.id,
        teamId: matchEvents.teamId,
        eventType: matchEvents.eventType,
        minute: matchEvents.minute,
        playerUid: matchEvents.playerUid,
        playerName: matchEvents.playerName,
        playerAvatarUrl: sql<string | null>`pp.avatar_url`,
        assistPlayerUid: matchEvents.assistPlayerUid,
        assistPlayerName: matchEvents.assistPlayerName,
      })
      .from(matchEvents)
      .leftJoin(sql`player_profiles pp`, sql`pp.uid = ${matchEvents.playerUid}`)
      .where(eq(matchEvents.matchId, matchId))
      .orderBy(asc(matchEvents.minute), asc(matchEvents.createdAt))

    // Lineups: players registered for each team in this edition
    let homeLineup: {
      playerUid: string
      playerName: string
      jerseyNumber: number | null
      position: string | null
      isCaptain: boolean
      avatarUrl: string | null
    }[] = []
    let awayLineup: typeof homeLineup = []

    if (row.homeTeamId) {
      homeLineup = await this.getLineup(row.editionId, row.homeTeamId)
    }
    if (row.awayTeamId) {
      awayLineup = await this.getLineup(row.editionId, row.awayTeamId)
    }

    // Forma reciente (últimos 3 finalizados) + predicción básica. Se calcula
    // para la vista previa de un partido aún no jugado (scheduled/live).
    const homeForm = row.homeTeamId ? await this.getRecentForm(row.editionId, row.homeTeamId) : []
    const awayForm = row.awayTeamId ? await this.getRecentForm(row.editionId, row.awayTeamId) : []
    const prediction = this.predict(homeForm, awayForm)

    return {
      id: row.id,
      status: row.status,
      homeScore: row.homeScore,
      awayScore: row.awayScore,
      homePenalties: row.homePenalties,
      awayPenalties: row.awayPenalties,
      scheduledAt: row.scheduledAt,
      startedAt: row.startedAt,
      finishedAt: row.finishedAt,
      round: row.round,
      group: row.groupName ? { name: row.groupName } : null,
      venue: row.venueName
        ? {
            name: row.venueName,
            address: row.venueAddress,
            city: row.venueCity,
            lat: row.venueLat,
            lng: row.venueLng,
          }
        : null,
      referee: row.refereeName ? { fullName: row.refereeName } : null,
      matchday: { name: row.matchdayName, number: row.matchdayNumber },
      edition: { id: row.editionId, name: row.editionName },
      league: row.leagueName,
      homeForm,
      awayForm,
      prediction,
      homeTeam: {
        id: row.homeTeamId,
        name: row.homeTeamName,
        shortName: row.homeTeamShort,
        logoUrl: row.homeTeamLogo,
        primaryColor: row.homeTeamColor,
      },
      awayTeam: {
        id: row.awayTeamId,
        name: row.awayTeamName,
        shortName: row.awayTeamShort,
        logoUrl: row.awayTeamLogo,
        primaryColor: row.awayTeamColor,
      },
      events,
      homeLineup,
      awayLineup,
    }
  }

  private async getLineup(editionId: string, teamId: string) {
    const rows = await this.db
      .select({
        playerUid: registrationPlayers.playerUid,
        playerName: registrationPlayers.playerName,
        jerseyNumber: registrationPlayers.jerseyNumber,
        position: registrationPlayers.position,
        isCaptain: registrationPlayers.isCaptain,
        avatarUrl: playerProfiles.avatarUrl,
      })
      .from(registrationPlayers)
      .innerJoin(registrations, eq(registrations.id, registrationPlayers.registrationId))
      .leftJoin(playerProfiles, eq(playerProfiles.uid, registrationPlayers.playerUid))
      .where(
        sql`${registrations.editionId} = ${editionId} AND ${registrations.teamId} = ${teamId}`,
      )
      .orderBy(asc(registrationPlayers.jerseyNumber))

    return rows
  }

  /** Últimos 3 partidos finalizados del equipo en la edición (forma reciente). */
  private async getRecentForm(editionId: string, teamId: string) {
    const rows = await this.db
      .select({
        homeTeamId: matches.homeTeamId,
        awayTeamId: matches.awayTeamId,
        homeScore: matches.homeScore,
        awayScore: matches.awayScore,
        finishedAt: matches.finishedAt,
        rivalHome: sql<string>`ht.name`,
        rivalAway: sql<string>`at.name`,
      })
      .from(matches)
      .innerJoin(matchdays, eq(matchdays.id, matches.matchdayId))
      .leftJoin(sql`teams ht`, sql`ht.id = ${matches.homeTeamId}`)
      .leftJoin(sql`teams at`, sql`at.id = ${matches.awayTeamId}`)
      .where(and(
        eq(matchdays.editionId, editionId),
        eq(matches.status, 'finished'),
        or(eq(matches.homeTeamId, teamId), eq(matches.awayTeamId, teamId)),
      ))
      .orderBy(desc(matches.finishedAt))
      .limit(3)

    return rows.map((m) => {
      const isHome = m.homeTeamId === teamId
      const gf = (isHome ? m.homeScore : m.awayScore) ?? 0
      const ga = (isHome ? m.awayScore : m.homeScore) ?? 0
      const result: 'W' | 'D' | 'L' = gf > ga ? 'W' : gf < ga ? 'L' : 'D'
      return {
        result,
        goalsFor: gf,
        goalsAgainst: ga,
        rival: isHome ? m.rivalAway : m.rivalHome,
      }
    })
  }

  /**
   * Predicción básica (heurística) a partir de la forma reciente. Combina:
   *  - puntos por partido (resultados)
   *  - diferencia de goles promedio (ataque/defensa)
   *  - ventaja de localía
   * Devuelve % (suman 100) + los promedios de goles a favor/en contra de cada equipo.
   */
  private predict(
    homeForm: { result: 'W' | 'D' | 'L'; goalsFor: number; goalsAgainst: number }[],
    awayForm: { result: 'W' | 'D' | 'L'; goalsFor: number; goalsAgainst: number }[],
  ) {
    const avg = (form: typeof homeForm) => {
      if (form.length === 0) return { ppg: 1.0, gf: 0, ga: 0 } // sin datos: neutral
      const pts = form.reduce((s, m) => s + (m.result === 'W' ? 3 : m.result === 'D' ? 1 : 0), 0)
      const gf = form.reduce((s, m) => s + m.goalsFor, 0)
      const ga = form.reduce((s, m) => s + m.goalsAgainst, 0)
      return { ppg: pts / form.length, gf: gf / form.length, ga: ga / form.length }
    }
    const h = avg(homeForm)
    const a = avg(awayForm)

    // Fuerza = PPG + diferencia de goles/partido (peso 0.25) + localía. Piso 0.1.
    const sH = Math.max(0.1, h.ppg + (h.gf - h.ga) * 0.25 + 0.5)
    const sA = Math.max(0.1, a.ppg + (a.gf - a.ga) * 0.25)
    const drawBase = 1.1
    const total = sH + sA + drawBase
    const homeWin = Math.round((sH / total) * 100)
    const awayWin = Math.round((sA / total) * 100)
    const draw = 100 - homeWin - awayWin
    return {
      homeWin, draw, awayWin,
      homeAvgGoals: Math.round(h.gf * 10) / 10,
      awayAvgGoals: Math.round(a.gf * 10) / 10,
    }
  }
}
