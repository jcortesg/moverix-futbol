import { Injectable, NotFoundException } from '@nestjs/common'
import { eq, sql, or, inArray, desc, asc } from 'drizzle-orm'
import { DatabaseService } from '../../db/database.service'
import {
  editions,
  leagues,
  organizations,
  registrations,
  registrationPlayers,
  teams,
  groups,
  matches,
  matchdays,
  playerStats,
  venues,
  referees,
} from '../../db/schema'

@Injectable()
export class MobileEditionsService {
  constructor(private readonly database: DatabaseService) {}

  private get db() {
    return this.database.db
  }

  /**
   * All editions visible to players, with league + org info.
   * Optionally filtered by status (active, registration, draft, finished).
   */
  async browse(status?: string) {
    const conditions = status ? eq(editions.status, status as any) : undefined

    const rows = await this.db
      .select({
        id: editions.id,
        name: editions.name,
        season: editions.season,
        status: editions.status,
        maxTeams: editions.maxTeams,
        registrationFee: editions.registrationFee,
        prizePool: editions.prizePool,
        currency: editions.currency,
        logoUrl: editions.logoUrl,
        bannerUrl: editions.bannerUrl,
        startDate: editions.startDate,
        endDate: editions.endDate,
        league: {
          id: leagues.id,
          name: leagues.name,
          sportFormat: leagues.sportFormat,
          gender: leagues.gender,
          logoUrl: leagues.logoUrl,
        },
        organization: {
          id: organizations.id,
          name: organizations.name,
          city: organizations.city,
          logoUrl: organizations.logoUrl,
        },
        teamsCount: sql<number>`(
          SELECT count(*)::int FROM registrations r
          WHERE r.edition_id = ${editions.id}
            AND r.status IN ('approved', 'pending')
        )`,
      })
      .from(editions)
      .innerJoin(leagues, eq(leagues.id, editions.leagueId))
      .innerJoin(organizations, eq(organizations.id, leagues.organizationId))
      .where(conditions)
      .orderBy(editions.startDate)

    return rows
  }

  /**
   * Editions where the authenticated user participates:
   * - As team director (teams.directorUid)
   * - As registered player (registration_players.playerUid)
   */
  async mine(uid: string) {
    // 1. Find registrationIds where user is director or player
    const asDirector = this.db
      .select({ registrationId: registrations.id })
      .from(registrations)
      .innerJoin(teams, eq(teams.id, registrations.teamId))
      .where(eq(teams.directorUid, uid))

    const asPlayer = this.db
      .select({ registrationId: registrationPlayers.registrationId })
      .from(registrationPlayers)
      .where(eq(registrationPlayers.playerUid, uid))

    const myRegistrationIds = await this.db
      .selectDistinct({ id: registrations.id })
      .from(registrations)
      .where(
        or(
          inArray(registrations.id, asDirector),
          inArray(registrations.id, asPlayer),
        ),
      )

    if (myRegistrationIds.length === 0) return []

    const regIds = myRegistrationIds.map((r) => r.id)

    // 2. Full data for those registrations
    const rows = await this.db
      .select({
        registration: {
          id: registrations.id,
          status: registrations.status,
          groupId: registrations.groupId,
        },
        edition: {
          id: editions.id,
          name: editions.name,
          season: editions.season,
          status: editions.status,
          maxTeams: editions.maxTeams,
          registrationFee: editions.registrationFee,
          prizePool: editions.prizePool,
          currency: editions.currency,
          logoUrl: editions.logoUrl,
          bannerUrl: editions.bannerUrl,
          startDate: editions.startDate,
          endDate: editions.endDate,
        },
        league: {
          id: leagues.id,
          name: leagues.name,
          sportFormat: leagues.sportFormat,
        },
        organization: {
          id: organizations.id,
          name: organizations.name,
          city: organizations.city,
        },
        team: {
          id: teams.id,
          name: teams.name,
          shortName: teams.shortName,
          logoUrl: teams.logoUrl,
          directorUid: teams.directorUid,
        },
        group: {
          id: groups.id,
          name: groups.name,
          phase: groups.phase,
        },
        teamsCount: sql<number>`(
          SELECT count(*)::int FROM registrations r
          WHERE r.edition_id = ${editions.id}
            AND r.status IN ('approved', 'pending')
        )`,
      })
      .from(registrations)
      .innerJoin(editions, eq(editions.id, registrations.editionId))
      .innerJoin(leagues, eq(leagues.id, editions.leagueId))
      .innerJoin(organizations, eq(organizations.id, leagues.organizationId))
      .innerJoin(teams, eq(teams.id, registrations.teamId))
      .leftJoin(groups, eq(groups.id, registrations.groupId))
      .where(inArray(registrations.id, regIds))
      .orderBy(editions.startDate)

    return rows.map((r) => ({
      ...r.edition,
      league: r.league,
      organization: r.organization,
      team: r.team,
      group: r.group && r.group.id ? r.group : null,
      registration: r.registration,
      teamsCount: r.teamsCount,
      isDirector: r.team.directorUid === uid,
    }))
  }

  /**
   * Full edition detail for mobile: edition info + registered teams + upcoming matches + top scorers.
   */
  async detail(id: string) {
    // Edition + league + org
    const [edition] = await this.db
      .select({
        id: editions.id,
        name: editions.name,
        season: editions.season,
        status: editions.status,
        maxTeams: editions.maxTeams,
        registrationFee: editions.registrationFee,
        prizePool: editions.prizePool,
        currency: editions.currency,
        logoUrl: editions.logoUrl,
        bannerUrl: editions.bannerUrl,
        startDate: editions.startDate,
        endDate: editions.endDate,
        formatConfig: editions.formatConfig,
        league: {
          id: leagues.id,
          name: leagues.name,
          sportFormat: leagues.sportFormat,
          gender: leagues.gender,
        },
        organization: {
          id: organizations.id,
          name: organizations.name,
          city: organizations.city,
        },
      })
      .from(editions)
      .innerJoin(leagues, eq(leagues.id, editions.leagueId))
      .innerJoin(organizations, eq(organizations.id, leagues.organizationId))
      .where(eq(editions.id, id))

    if (!edition) throw new NotFoundException(`Edición ${id} no encontrada`)

    // Groups
    const editionGroups = await this.db
      .select()
      .from(groups)
      .where(eq(groups.editionId, id))
      .orderBy(asc(groups.order))

    // Registered teams
    const regs = await this.db
      .select({
        id: registrations.id,
        status: registrations.status,
        groupId: registrations.groupId,
        team: {
          id: teams.id,
          name: teams.name,
          shortName: teams.shortName,
          logoUrl: teams.logoUrl,
          primaryColor: teams.primaryColor,
        },
      })
      .from(registrations)
      .innerJoin(teams, eq(teams.id, registrations.teamId))
      .where(eq(registrations.editionId, id))

    // Upcoming + recent matches (last 5 finished + next 5 scheduled)
    const editionMatches = await this.db
      .select({
        id: matches.id,
        groupId: matches.groupId,
        status: matches.status,
        homeScore: matches.homeScore,
        awayScore: matches.awayScore,
        scheduledAt: matches.scheduledAt,
        round: matches.round,
        matchdayNumber: matchdays.number,
        homeTeam: {
          id: matches.homeTeamId,
          name: sql<string>`ht.name`,
          shortName: sql<string>`ht.short_name`,
          logoUrl: sql<string>`ht.logo_url`,
          primaryColor: sql<string>`ht.primary_color`,
        },
        awayTeam: {
          id: matches.awayTeamId,
          name: sql<string>`at.name`,
          shortName: sql<string>`at.short_name`,
          logoUrl: sql<string>`at.logo_url`,
          primaryColor: sql<string>`at.primary_color`,
        },
        venue: {
          name: venues.name,
          address: venues.address,
        },
        referee: {
          fullName: referees.fullName,
        },
      })
      .from(matches)
      .innerJoin(matchdays, eq(matchdays.id, matches.matchdayId))
      .leftJoin(
        sql`teams ht`,
        sql`ht.id = ${matches.homeTeamId}`,
      )
      .leftJoin(
        sql`teams at`,
        sql`at.id = ${matches.awayTeamId}`,
      )
      .leftJoin(venues, eq(venues.id, matches.venueId))
      .leftJoin(referees, eq(referees.id, matches.refereeId))
      .where(eq(matchdays.editionId, id))
      .orderBy(desc(matches.scheduledAt))
      .limit(20)

    // Top scorers
    const scorers = await this.db
      .select()
      .from(playerStats)
      .where(eq(playerStats.editionId, id))
      .orderBy(desc(playerStats.goals), desc(playerStats.assists))
      .limit(10)

    // Matchday info
    const editionMatchdays = await this.db
      .select({
        id: matchdays.id,
        number: matchdays.number,
        name: matchdays.name,
        scheduledDate: matchdays.scheduledDate,
      })
      .from(matchdays)
      .where(eq(matchdays.editionId, id))
      .orderBy(asc(matchdays.number))

    const totalMatchdays = editionMatchdays.length
    const finishedMatchdays = await this.db
      .select({ count: sql<number>`count(DISTINCT ${matchdays.id})::int` })
      .from(matchdays)
      .innerJoin(matches, eq(matches.matchdayId, matchdays.id))
      .where(sql`${matchdays.editionId} = ${id} AND ${matches.status} = 'finished'`)

    return {
      ...edition,
      teamsCount: regs.length,
      groups: editionGroups,
      registrations: regs,
      matches: editionMatches,
      topScorers: scorers,
      matchdays: {
        total: totalMatchdays,
        played: finishedMatchdays[0]?.count ?? 0,
      },
    }
  }
}
