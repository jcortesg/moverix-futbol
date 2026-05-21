import { Injectable, NotFoundException } from '@nestjs/common'
import { eq, sql, asc } from 'drizzle-orm'
import { DatabaseService } from '../../db/database.service'
import {
  matches,
  matchdays,
  matchEvents,
  registrations,
  registrationPlayers,
  editions,
  leagues,
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
        matchdayName: matchdays.name,
        matchdayNumber: matchdays.number,
        editionId: matchdays.editionId,
        editionName: editions.name,
        leagueName: leagues.name,
        homeTeamId: matches.homeTeamId,
        awayTeamId: matches.awayTeamId,
        homeTeamName: sql<string>`ht.name`,
        homeTeamLogo: sql<string | null>`ht.logo_url`,
        homeTeamColor: sql<string | null>`ht.primary_color`,
        awayTeamName: sql<string>`at.name`,
        awayTeamLogo: sql<string | null>`at.logo_url`,
        awayTeamColor: sql<string | null>`at.primary_color`,
      })
      .from(matches)
      .innerJoin(matchdays, eq(matchdays.id, matches.matchdayId))
      .innerJoin(editions, eq(editions.id, matchdays.editionId))
      .innerJoin(leagues, eq(leagues.id, editions.leagueId))
      .leftJoin(sql`teams ht`, sql`ht.id = ${matches.homeTeamId}`)
      .leftJoin(sql`teams at`, sql`at.id = ${matches.awayTeamId}`)
      .where(eq(matches.id, matchId))

    if (!row) throw new NotFoundException(`Partido no encontrado`)

    // Events
    const events = await this.db
      .select({
        id: matchEvents.id,
        teamId: matchEvents.teamId,
        eventType: matchEvents.eventType,
        minute: matchEvents.minute,
        playerUid: matchEvents.playerUid,
        playerName: matchEvents.playerName,
        assistPlayerUid: matchEvents.assistPlayerUid,
        assistPlayerName: matchEvents.assistPlayerName,
      })
      .from(matchEvents)
      .where(eq(matchEvents.matchId, matchId))
      .orderBy(asc(matchEvents.minute), asc(matchEvents.createdAt))

    // Lineups: players registered for each team in this edition
    let homeLineup: {
      playerUid: string
      playerName: string
      jerseyNumber: number | null
      position: string | null
      isCaptain: boolean
    }[] = []
    let awayLineup: typeof homeLineup = []

    if (row.homeTeamId) {
      homeLineup = await this.getLineup(row.editionId, row.homeTeamId)
    }
    if (row.awayTeamId) {
      awayLineup = await this.getLineup(row.editionId, row.awayTeamId)
    }

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
      matchday: { name: row.matchdayName, number: row.matchdayNumber },
      edition: { id: row.editionId, name: row.editionName },
      league: row.leagueName,
      homeTeam: {
        id: row.homeTeamId,
        name: row.homeTeamName,
        logoUrl: row.homeTeamLogo,
        primaryColor: row.homeTeamColor,
      },
      awayTeam: {
        id: row.awayTeamId,
        name: row.awayTeamName,
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
      })
      .from(registrationPlayers)
      .innerJoin(registrations, eq(registrations.id, registrationPlayers.registrationId))
      .where(
        sql`${registrations.editionId} = ${editionId} AND ${registrations.teamId} = ${teamId}`,
      )
      .orderBy(asc(registrationPlayers.jerseyNumber))

    return rows
  }
}
