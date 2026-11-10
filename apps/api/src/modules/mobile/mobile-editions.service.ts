import { Injectable, NotFoundException } from '@nestjs/common'
import { eq, ne, sql, or, and, inArray, desc, asc } from 'drizzle-orm'
import { DatabaseService } from '../../db/database.service'
import {
  editions,
  leagues,
  organizations,
  registrations,
  registrationPlayers,
  teams,
  teamMembers,
  groups,
  matches,
  matchdays,
  playerStats,
  venues,
  referees,
} from '../../db/schema'
import { BracketsService, cupLabels } from '../brackets/brackets.service'

/**
 * Orden de ediciones en la app: primero las que tienen inscripciones abiertas,
 * luego las que están en juego y al final las finalizadas. Dentro de cada
 * grupo, las más recientes primero.
 */
const editionListOrder = [
  sql`case
    when ${editions.status} = 'registration' and ${editions.registrationsOpen} then 0
    when ${editions.status} in ('registration', 'active') then 1
    else 2
  end`,
  sql`${editions.startDate} desc nulls last`,
  desc(editions.createdAt),
]

@Injectable()
export class MobileEditionsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly brackets: BracketsService,
  ) {}

  private get db() {
    return this.database.db
  }

  /**
   * All editions visible to players, with league + org info.
   * Optionally filtered by status (active, registration, draft, finished).
   */
  async browse(status?: string, isIos = false) {
    const filters = [
      // Los torneos en borrador (draft) no se publican: nunca se listan en la app,
      // aunque se pida status=draft explícitamente.
      ne(editions.status, 'draft'),
      status && status !== 'draft' ? eq(editions.status, status as any) : undefined,
      // Platform restriction: hide flagged tournaments from iOS clients
      isIos ? eq(editions.hiddenOnIos, false) : undefined,
    ].filter(Boolean)
    const conditions = filters.length ? and(...(filters as any[])) : undefined

    const rows = await this.db
      .select({
        id: editions.id,
        name: editions.name,
        season: editions.season,
        status: editions.status,
        registrationsOpen: editions.registrationsOpen,
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
            AND r.status NOT IN ('rejected', 'withdrawn')
        )`,
      })
      .from(editions)
      .innerJoin(leagues, eq(leagues.id, editions.leagueId))
      .innerJoin(organizations, eq(organizations.id, leagues.organizationId))
      .where(conditions)
      .orderBy(...editionListOrder)

    return rows
  }

  /**
   * Editions where the authenticated user participates:
   * - As team director (teams.directorUid)
   * - As registered player (registration_players.playerUid)
   */
  async mine(uid: string, isIos = false) {
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
          registrationsOpen: editions.registrationsOpen,
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
            AND r.status NOT IN ('rejected', 'withdrawn')
        )`,
      })
      .from(registrations)
      .innerJoin(editions, eq(editions.id, registrations.editionId))
      .innerJoin(leagues, eq(leagues.id, editions.leagueId))
      .innerJoin(organizations, eq(organizations.id, leagues.organizationId))
      .innerJoin(teams, eq(teams.id, registrations.teamId))
      .leftJoin(groups, eq(groups.id, registrations.groupId))
      .where(
        isIos
          ? and(inArray(registrations.id, regIds), eq(editions.hiddenOnIos, false))
          : inArray(registrations.id, regIds),
      )
      .orderBy(...editionListOrder)

    // Deduplicate by edition: keep the entry where user is director, or the first one
    const byEdition = new Map<string, typeof rows[number]>()
    for (const r of rows) {
      const existing = byEdition.get(r.edition.id)
      if (!existing || (r.team.directorUid === uid && existing.team.directorUid !== uid)) {
        byEdition.set(r.edition.id, r)
      }
    }

    return [...byEdition.values()].map((r) => ({
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
  async detail(id: string, uid: string, isIos = false) {
    // Edition + league + org
    const [edition] = await this.db
      .select({
        id: editions.id,
        name: editions.name,
        season: editions.season,
        status: editions.status,
        registrationsOpen: editions.registrationsOpen,
        hiddenOnIos: editions.hiddenOnIos,
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

    // Platform restriction: tournament hidden from iOS clients
    if (isIos && edition.hiddenOnIos) {
      throw new NotFoundException(`Edición ${id} no encontrada`)
    }

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

    // Real number of registered teams (always the true total)
    const totalTeamsCount = regs.length

    // Privacy during sign-up: before the championship is under way (draft /
    // registration), a team must not see the other registered teams. We only
    // expose the requesting user's own team(s); everyone else is hidden until
    // the edition becomes active/finished.
    let visibleRegs = regs
    if (edition.status === 'draft' || edition.status === 'registration') {
      const myTeamRows = await this.db
        .select({ teamId: teamMembers.teamId })
        .from(teamMembers)
        .where(eq(teamMembers.playerUid, uid))
      const myTeamIds = new Set(myTeamRows.map((r) => r.teamId))
      visibleRegs = regs.filter((r) => myTeamIds.has(r.team.id))
    }

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
      // Todos los partidos de la edición, ordenados por jornada (para la vista de
      // Partidos por jornada y las tablas). Cap alto como guardarraíl.
      .orderBy(asc(matchdays.number), sql`${matches.scheduledAt} asc nulls last`)
      .limit(500)

    // Top scorers (with team name)
    const scorers = await this.db
      .select({
        id: playerStats.id,
        editionId: playerStats.editionId,
        teamId: playerStats.teamId,
        playerUid: playerStats.playerUid,
        playerName: playerStats.playerName,
        matchesPlayed: playerStats.matchesPlayed,
        goals: playerStats.goals,
        assists: playerStats.assists,
        yellowCards: playerStats.yellowCards,
        redCards: playerStats.redCards,
        minutesPlayed: playerStats.minutesPlayed,
        teamName: teams.name,
        teamLogoUrl: teams.logoUrl,
      })
      .from(playerStats)
      .innerJoin(teams, eq(teams.id, playerStats.teamId))
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

    // Pestañas del torneo: las decide el backend para no recompilar la app al
    // agregar o quitar una. Llaves solo con cuadro sorteado. La app ignora las
    // claves que no conoce.
    const live = edition.status === 'active' || edition.status === 'finished'
    const hasBracket = live && (await this.brackets.getCups(id)).length > 0
    const tabs = live
      ? [
          { key: 'resumen', label: 'Resumen', icon: 'view-dashboard-outline' },
          { key: 'partidos', label: 'Partidos', icon: 'soccer' },
          ...(hasBracket ? [{ key: 'llaves', label: 'Llaves', icon: 'tournament' }] : []),
          { key: 'tabla', label: 'Tabla', icon: 'table' },
          { key: 'info', label: 'Info', icon: 'information-outline' },
        ]
      : []

    return {
      ...edition,
      tabs,
      teamsCount: totalTeamsCount,
      groups: editionGroups,
      registrations: visibleRegs,
      matches: editionMatches,
      topScorers: scorers,
      matchdays: {
        total: totalMatchdays,
        played: finishedMatchdays[0]?.count ?? 0,
      },
    }
  }

  /**
   * Cuadro de llaves de la fase eliminatoria, para dibujarlo en la app.
   *
   * Reusa el mismo servicio que el panel del organizador; lo que cambia es el
   * permiso: aqui lo ve cualquiera que pueda ver la edicion, no solo su dueno.
   * Sin llaves generadas devuelve slots vacio (la app oculta la pestana).
   */
  async bracket(id: string, cupName = 'main', isIos = false) {
    const [edition] = await this.db
      .select({ id: editions.id, hiddenOnIos: editions.hiddenOnIos })
      .from(editions)
      .where(eq(editions.id, id))

    if (!edition || (isIos && edition.hiddenOnIos)) {
      throw new NotFoundException(`Edicion ${id} no encontrada`)
    }

    const [slots, cups] = await Promise.all([
      this.brackets.getByEdition(id, cupName),
      this.brackets.getCups(id),
    ])

    return {
      cup: cupName,
      cups,
      cupLabels: cupLabels(cups),
      totalRounds: slots.reduce((max, s) => Math.max(max, s.round), 0),
      slots: slots.map((s) => ({
        id: s.id,
        round: s.round,
        slot: s.slot,
        nextSlotId: s.nextSlotId,
        matchId: s.matchId,
        matchStatus: s.matchStatus ?? null,
        scheduledAt: s.scheduledAt ?? null,
        venueName: s.venueName ?? null,
        winnerId: s.winnerId,
        homeTeamId: s.homeTeamId,
        homeTeamName: s.homeTeamName ?? null,
        homeTeamLogoUrl: s.homeTeamLogoUrl ?? null,
        homeScore: s.homeScore ?? null,
        homePenalties: s.homePenalties ?? null,
        awayTeamId: s.awayTeamId,
        awayTeamName: s.awayTeamName ?? null,
        awayTeamLogoUrl: s.awayTeamLogoUrl ?? null,
        awayScore: s.awayScore ?? null,
        awayPenalties: s.awayPenalties ?? null,
      })),
    }
  }
}
