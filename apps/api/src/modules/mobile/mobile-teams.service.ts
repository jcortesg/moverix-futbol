import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { eq, or, sql, desc, asc, and, inArray } from 'drizzle-orm'
import { DatabaseService } from '../../db/database.service'
import {
  teams,
  teamMembers,
  playerProfiles,
  matches,
  matchdays,
  matchEvents,
  registrations,
  registrationPlayers,
  editions,
  leagues,
  organizations,
  groups,
  fines,
  payments,
  venues,
  referees,
} from '../../db/schema'

function generateSlug(name: string): string {
  const base = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 18)
  const suffix = Math.random().toString(36).slice(2, 8)
  return `${base}_${suffix}`
}

function generateAccessCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}

@Injectable()
export class MobileTeamsService {
  constructor(private readonly database: DatabaseService) {}

  private get db() {
    return this.database.db
  }

  // ── My teams ────────────────────────────────────────────────

  async myTeams(uid: string) {
    const rows = await this.db
      .select({
        id: teams.id,
        name: teams.name,
        shortName: teams.shortName,
        logoUrl: teams.logoUrl,
        primaryColor: teams.primaryColor,
        city: teams.city,
        directorUid: teams.directorUid,
        role: teamMembers.role,
        memberCount: sql<number>`(SELECT count(*) FROM team_members WHERE team_id = ${teams.id})::int`,
      })
      .from(teamMembers)
      .innerJoin(teams, eq(teams.id, teamMembers.teamId))
      .where(eq(teamMembers.playerUid, uid))
      .orderBy(desc(teamMembers.joinedAt))

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      shortName: r.shortName,
      logoUrl: r.logoUrl,
      primaryColor: r.primaryColor,
      city: r.city,
      role: r.role,
      isDirector: r.directorUid === uid,
      memberCount: r.memberCount,
    }))
  }

  // ── Create team ────────────────────────────────────────────

  async createTeam(
    uid: string,
    displayName: string,
    dto: { name: string; shortName?: string; city?: string },
  ) {
    if (!dto.name || dto.name.trim().length < 2) {
      throw new BadRequestException('El nombre del equipo debe tener al menos 2 caracteres')
    }

    const slug = generateSlug(dto.name)
    const accessCode = generateAccessCode()

    const [team] = await this.db
      .insert(teams)
      .values({
        directorUid: uid,
        name: dto.name.trim(),
        shortName: dto.shortName?.trim() || null,
        slug,
        accessCode,
        city: dto.city?.trim() || null,
      })
      .returning()

    // Resolve player name from profile if possible
    const [profile] = await this.db
      .select({ fullName: playerProfiles.fullName })
      .from(playerProfiles)
      .where(eq(playerProfiles.uid, uid))

    const playerName = profile?.fullName ?? displayName

    // Director auto-joins as member
    await this.db.insert(teamMembers).values({
      teamId: team.id,
      playerUid: uid,
      playerName,
      role: 'director',
    })

    return { ...team, memberCount: 1 }
  }

  // ── Join team ──────────────────────────────────────────────

  async joinTeam(uid: string, displayName: string, slug: string, accessCode: string) {
    const [team] = await this.db
      .select()
      .from(teams)
      .where(eq(teams.slug, slug.toLowerCase().trim()))

    if (!team) throw new NotFoundException('Equipo no encontrado')
    if (team.accessCode !== accessCode.toUpperCase().trim()) {
      throw new BadRequestException('Código de acceso incorrecto')
    }

    // Check if already a member
    const [existing] = await this.db
      .select({ id: teamMembers.id })
      .from(teamMembers)
      .where(and(eq(teamMembers.teamId, team.id), eq(teamMembers.playerUid, uid)))

    if (existing) throw new ConflictException('Ya eres miembro de este equipo')

    // Resolve player name
    const [profile] = await this.db
      .select({ fullName: playerProfiles.fullName })
      .from(playerProfiles)
      .where(eq(playerProfiles.uid, uid))

    const playerName = profile?.fullName ?? displayName

    await this.db.insert(teamMembers).values({
      teamId: team.id,
      playerUid: uid,
      playerName,
      role: 'player',
    })

    return { teamId: team.id, teamName: team.name, logoUrl: team.logoUrl }
  }

  // ── Invite info ────────────────────────────────────────────

  async getInviteInfo(teamId: string, uid: string) {
    const [team] = await this.db
      .select({
        id: teams.id,
        name: teams.name,
        slug: teams.slug,
        accessCode: teams.accessCode,
        directorUid: teams.directorUid,
      })
      .from(teams)
      .where(eq(teams.id, teamId))

    if (!team) throw new NotFoundException('Equipo no encontrado')
    if (team.directorUid !== uid) throw new ForbiddenException('Solo el director puede compartir invitaciones')

    return {
      teamName: team.name,
      slug: team.slug,
      accessCode: team.accessCode,
      shareText: [
        `⚽ Moverix Invitation ⚽`,
        ``,
        `Te invito a unirte al equipo: ${team.name}`,
        ``,
        `Para unirte necesitas estos datos:`,
        ``,
        `📋 ID del equipo: ${team.slug}`,
        `🔑 Código de acceso: ${team.accessCode}`,
        ``,
        `Descarga la app Moverix y únete con estos datos.`,
        ``,
        `¡Nos vemos en la cancha! ⚽`,
      ].join('\n'),
    }
  }

  // ── Regenerate code ────────────────────────────────────────

  async regenerateCode(teamId: string, uid: string) {
    const [team] = await this.db
      .select({ directorUid: teams.directorUid })
      .from(teams)
      .where(eq(teams.id, teamId))

    if (!team) throw new NotFoundException('Equipo no encontrado')
    if (team.directorUid !== uid) throw new ForbiddenException('Solo el director puede regenerar el código')

    const newCode = generateAccessCode()
    await this.db
      .update(teams)
      .set({ accessCode: newCode, updatedAt: new Date() })
      .where(eq(teams.id, teamId))

    return { accessCode: newCode }
  }

  // ── Members ────────────────────────────────────────────────

  async getMembers(teamId: string) {
    const members = await this.db
      .select({
        id: teamMembers.id,
        playerUid: teamMembers.playerUid,
        playerName: teamMembers.playerName,
        role: teamMembers.role,
        joinedAt: teamMembers.joinedAt,
        avatarUrl: playerProfiles.avatarUrl,
        username: playerProfiles.username,
        position: playerProfiles.position,
      })
      .from(teamMembers)
      .leftJoin(playerProfiles, eq(playerProfiles.uid, teamMembers.playerUid))
      .where(eq(teamMembers.teamId, teamId))
      .orderBy(desc(teamMembers.role), asc(teamMembers.joinedAt))

    return members
  }

  async removeMember(teamId: string, memberUid: string, actorUid: string) {
    const [team] = await this.db
      .select({ directorUid: teams.directorUid })
      .from(teams)
      .where(eq(teams.id, teamId))

    if (!team) throw new NotFoundException('Equipo no encontrado')
    if (team.directorUid !== actorUid) throw new ForbiddenException('Solo el director puede remover miembros')
    if (memberUid === actorUid) throw new BadRequestException('No puedes removerte a ti mismo')

    await this.db
      .delete(teamMembers)
      .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.playerUid, memberUid)))

    return { removed: memberUid }
  }

  async leaveTeam(teamId: string, uid: string) {
    const [team] = await this.db
      .select({ directorUid: teams.directorUid })
      .from(teams)
      .where(eq(teams.id, teamId))

    if (!team) throw new NotFoundException('Equipo no encontrado')
    if (team.directorUid === uid) throw new BadRequestException('El director no puede abandonar el equipo')

    await this.db
      .delete(teamMembers)
      .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.playerUid, uid)))

    return { left: teamId }
  }

  // ── Dashboard (existing) ───────────────────────────────────

  async dashboard(teamId: string) {
    const [recentMatches, upcomingMatches, championships] = await Promise.all([
      this.getRecentMatches(teamId),
      this.getUpcomingMatches(teamId),
      this.getChampionships(teamId),
    ])

    const stats = { wins: 0, draws: 0, losses: 0, played: 0 }
    for (const m of recentMatches) {
      stats.played++
      if (m.result === 'win') stats.wins++
      else if (m.result === 'draw') stats.draws++
      else if (m.result === 'loss') stats.losses++
    }

    return { recentMatches, upcomingMatches, championships, stats }
  }

  private async getRecentMatches(teamId: string) {
    const rows = await this.db
      .select({
        id: matches.id,
        status: matches.status,
        homeScore: matches.homeScore,
        awayScore: matches.awayScore,
        scheduledAt: matches.scheduledAt,
        finishedAt: matches.finishedAt,
        matchdayNumber: matchdays.number,
        matchdayName: matchdays.name,
        editionId: matchdays.editionId,
        homeTeam: {
          id: matches.homeTeamId,
          name: sql<string>`ht.name`,
          shortName: sql<string | null>`ht.short_name`,
          logoUrl: sql<string | null>`ht.logo_url`,
        },
        awayTeam: {
          id: matches.awayTeamId,
          name: sql<string>`at.name`,
          shortName: sql<string | null>`at.short_name`,
          logoUrl: sql<string | null>`at.logo_url`,
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
      .leftJoin(sql`teams ht`, sql`ht.id = ${matches.homeTeamId}`)
      .leftJoin(sql`teams at`, sql`at.id = ${matches.awayTeamId}`)
      .leftJoin(venues, eq(venues.id, matches.venueId))
      .leftJoin(referees, eq(referees.id, matches.refereeId))
      .where(
        and(
          eq(matches.status, 'finished'),
          or(eq(matches.homeTeamId, teamId), eq(matches.awayTeamId, teamId)),
        ),
      )
      .orderBy(desc(matches.finishedAt))
      .limit(30)

    if (rows.length === 0) return []

    const matchIds = rows.map((r) => r.id)
    const events = await this.db
      .select({
        matchId: matchEvents.matchId,
        teamId: matchEvents.teamId,
        eventType: matchEvents.eventType,
        minute: matchEvents.minute,
        playerName: matchEvents.playerName,
      })
      .from(matchEvents)
      .where(inArray(matchEvents.matchId, matchIds))
      .orderBy(asc(matchEvents.minute))

    const eventsByMatch = new Map<string, typeof events>()
    for (const ev of events) {
      const list = eventsByMatch.get(ev.matchId) ?? []
      list.push(ev)
      eventsByMatch.set(ev.matchId, list)
    }

    return rows.map((r) => {
      const isHome = r.homeTeam.id === teamId
      const result =
        r.homeScore != null && r.awayScore != null
          ? isHome
            ? r.homeScore > r.awayScore ? 'win' : r.homeScore < r.awayScore ? 'loss' : 'draw'
            : r.awayScore > r.homeScore ? 'win' : r.awayScore < r.homeScore ? 'loss' : 'draw'
          : null

      return { ...r, result, events: eventsByMatch.get(r.id) ?? [] }
    })
  }

  private async getUpcomingMatches(teamId: string) {
    return this.db
      .select({
        id: matches.id,
        status: matches.status,
        scheduledAt: matches.scheduledAt,
        matchdayNumber: matchdays.number,
        matchdayName: matchdays.name,
        editionId: matchdays.editionId,
        homeTeam: {
          id: matches.homeTeamId,
          name: sql<string>`ht.name`,
          shortName: sql<string | null>`ht.short_name`,
          logoUrl: sql<string | null>`ht.logo_url`,
        },
        awayTeam: {
          id: matches.awayTeamId,
          name: sql<string>`at.name`,
          shortName: sql<string | null>`at.short_name`,
          logoUrl: sql<string | null>`at.logo_url`,
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
      .leftJoin(sql`teams ht`, sql`ht.id = ${matches.homeTeamId}`)
      .leftJoin(sql`teams at`, sql`at.id = ${matches.awayTeamId}`)
      .leftJoin(venues, eq(venues.id, matches.venueId))
      .leftJoin(referees, eq(referees.id, matches.refereeId))
      .where(
        and(
          eq(matches.status, 'scheduled'),
          or(eq(matches.homeTeamId, teamId), eq(matches.awayTeamId, teamId)),
        ),
      )
      .orderBy(asc(matches.scheduledAt))
      .limit(20)
  }

  private async getChampionships(teamId: string) {
    return this.db
      .select({
        registrationId: registrations.id,
        status: registrations.status,
        edition: {
          id: editions.id,
          name: editions.name,
          season: editions.season,
          status: editions.status,
          logoUrl: editions.logoUrl,
        },
        league: {
          id: leagues.id,
          name: leagues.name,
          sportFormat: leagues.sportFormat,
        },
        organization: {
          id: organizations.id,
          name: organizations.name,
        },
      })
      .from(registrations)
      .innerJoin(editions, eq(editions.id, registrations.editionId))
      .innerJoin(leagues, eq(leagues.id, editions.leagueId))
      .innerJoin(organizations, eq(organizations.id, leagues.organizationId))
      .where(eq(registrations.teamId, teamId))
      .orderBy(desc(editions.startDate))
  }

  // ── Registration detail ────────────────────────────────

  async getRegistrationDetail(registrationId: string) {
    const [row] = await this.db
      .select({
        id: registrations.id,
        status: registrations.status,
        paidAt: registrations.paidAt,
        approvedAt: registrations.approvedAt,
        edition: {
          id: editions.id,
          name: editions.name,
          season: editions.season,
          status: editions.status,
          logoUrl: editions.logoUrl,
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
        },
        team: {
          id: teams.id,
          name: teams.name,
          shortName: teams.shortName,
          logoUrl: teams.logoUrl,
        },
        group: {
          id: groups.id,
          name: groups.name,
        },
      })
      .from(registrations)
      .innerJoin(editions, eq(editions.id, registrations.editionId))
      .innerJoin(leagues, eq(leagues.id, editions.leagueId))
      .innerJoin(organizations, eq(organizations.id, leagues.organizationId))
      .innerJoin(teams, eq(teams.id, registrations.teamId))
      .leftJoin(groups, eq(groups.id, registrations.groupId))
      .where(eq(registrations.id, registrationId))

    if (!row) throw new NotFoundException('Inscripcion no encontrada')

    return {
      ...row,
      group: row.group?.id ? row.group : null,
    }
  }

  // ── Register team to edition ───────────────────────────

  async registerTeam(teamId: string, editionId: string, uid: string) {
    // Verify director
    const [team] = await this.db
      .select({ directorUid: teams.directorUid, name: teams.name })
      .from(teams)
      .where(eq(teams.id, teamId))

    if (!team) throw new NotFoundException('Equipo no encontrado')
    if (team.directorUid !== uid) throw new ForbiddenException('Solo el director puede inscribir el equipo')

    // Verify edition exists and is open for registration
    const [edition] = await this.db
      .select({ id: editions.id, status: editions.status, name: editions.name })
      .from(editions)
      .where(eq(editions.id, editionId))

    if (!edition) throw new NotFoundException('Campeonato no encontrado')
    if (edition.status !== 'registration' && edition.status !== 'active') {
      throw new BadRequestException('Este campeonato no acepta inscripciones')
    }

    // Check if already registered
    const [existing] = await this.db
      .select({ id: registrations.id })
      .from(registrations)
      .where(and(eq(registrations.editionId, editionId), eq(registrations.teamId, teamId)))

    if (existing) throw new ConflictException('Este equipo ya esta inscrito en este campeonato')

    const [registration] = await this.db
      .insert(registrations)
      .values({
        editionId,
        teamId,
        registeredByUid: uid,
      })
      .returning()

    return {
      registrationId: registration.id,
      teamName: team.name,
      editionName: edition.name,
    }
  }

  // ── Add players from global roster to tournament ───────

  async addPlayersToRegistration(
    registrationId: string,
    playerUids: string[],
    uid: string,
  ) {
    // Get registration + verify director
    const [reg] = await this.db
      .select({
        id: registrations.id,
        teamId: registrations.teamId,
      })
      .from(registrations)
      .where(eq(registrations.id, registrationId))

    if (!reg) throw new NotFoundException('Inscripcion no encontrada')

    const [team] = await this.db
      .select({ directorUid: teams.directorUid })
      .from(teams)
      .where(eq(teams.id, reg.teamId))

    if (!team) throw new NotFoundException('Equipo no encontrado')
    if (team.directorUid !== uid) throw new ForbiddenException('Solo el director puede agregar jugadores')

    if (!playerUids.length) throw new BadRequestException('Selecciona al menos un jugador')

    // Get members from global roster
    const members = await this.db
      .select({
        playerUid: teamMembers.playerUid,
        playerName: teamMembers.playerName,
        position: playerProfiles.position,
      })
      .from(teamMembers)
      .leftJoin(playerProfiles, eq(playerProfiles.uid, teamMembers.playerUid))
      .where(
        and(
          eq(teamMembers.teamId, reg.teamId),
          inArray(teamMembers.playerUid, playerUids),
        ),
      )

    if (members.length === 0) throw new BadRequestException('Ningun jugador encontrado en la nomina del equipo')

    // Check which are already in registration
    const existing = await this.db
      .select({ playerUid: registrationPlayers.playerUid })
      .from(registrationPlayers)
      .where(
        and(
          eq(registrationPlayers.registrationId, registrationId),
          inArray(registrationPlayers.playerUid, playerUids),
        ),
      )

    const existingUids = new Set(existing.map((e) => e.playerUid))
    const toInsert = members.filter((m) => !existingUids.has(m.playerUid))

    if (toInsert.length === 0) {
      return { added: 0, message: 'Todos los jugadores ya estan inscritos' }
    }

    await this.db.insert(registrationPlayers).values(
      toInsert.map((m) => ({
        registrationId,
        playerUid: m.playerUid,
        playerName: m.playerName,
        position: m.position,
      })),
    )

    return { added: toInsert.length }
  }

  // ── Remove player from tournament roster ───────────────

  async removePlayerFromRegistration(
    registrationId: string,
    playerUid: string,
    uid: string,
  ) {
    const [reg] = await this.db
      .select({ teamId: registrations.teamId })
      .from(registrations)
      .where(eq(registrations.id, registrationId))

    if (!reg) throw new NotFoundException('Inscripcion no encontrada')

    const [team] = await this.db
      .select({ directorUid: teams.directorUid })
      .from(teams)
      .where(eq(teams.id, reg.teamId))

    if (team?.directorUid !== uid) throw new ForbiddenException('Solo el director puede remover jugadores')

    await this.db
      .delete(registrationPlayers)
      .where(
        and(
          eq(registrationPlayers.registrationId, registrationId),
          eq(registrationPlayers.playerUid, playerUid),
        ),
      )

    return { removed: playerUid }
  }

  // ── Financials for a registration ──────────────────────

  async getFinancials(registrationId: string) {
    const [reg] = await this.db
      .select({
        teamId: registrations.teamId,
        editionId: registrations.editionId,
        paidAt: registrations.paidAt,
      })
      .from(registrations)
      .where(eq(registrations.id, registrationId))

    if (!reg) throw new NotFoundException('Inscripcion no encontrada')

    // Get registration fee from edition
    const [edition] = await this.db
      .select({
        registrationFee: editions.registrationFee,
        currency: editions.currency,
      })
      .from(editions)
      .where(eq(editions.id, reg.editionId))

    // Fines for this team in this edition
    const teamFines = await this.db
      .select({
        id: fines.id,
        concept: fines.concept,
        reason: fines.reason,
        amount: fines.amount,
        currency: fines.currency,
        status: fines.status,
        playerName: fines.playerName,
        sanction: fines.sanction,
        matchesBanned: fines.matchesBanned,
        createdAt: fines.createdAt,
      })
      .from(fines)
      .where(and(eq(fines.editionId, reg.editionId), eq(fines.teamId, reg.teamId)))
      .orderBy(desc(fines.createdAt))

    // Payments for this team in this edition
    const teamPayments = await this.db
      .select({
        id: payments.id,
        type: payments.type,
        amount: payments.amount,
        currency: payments.currency,
        status: payments.status,
        notes: payments.notes,
        createdAt: payments.createdAt,
        verifiedAt: payments.verifiedAt,
      })
      .from(payments)
      .where(and(eq(payments.editionId, reg.editionId), eq(payments.teamId, reg.teamId)))
      .orderBy(desc(payments.createdAt))

    // Summary
    const totalFines = teamFines.reduce((sum, f) => sum + f.amount, 0)
    const pendingFines = teamFines.filter((f) => f.status === 'pending').reduce((sum, f) => sum + f.amount, 0)
    const totalPaid = teamPayments.filter((p) => p.status === 'verified').reduce((sum, p) => sum + p.amount, 0)
    const pendingPayments = teamPayments.filter((p) => p.status === 'pending').reduce((sum, p) => sum + p.amount, 0)

    return {
      registrationFee: edition?.registrationFee ?? 0,
      registrationPaid: !!reg.paidAt,
      currency: edition?.currency ?? 'COP',
      summary: {
        totalFines,
        pendingFines,
        totalPaid,
        pendingPayments,
        balance: (edition?.registrationFee ?? 0) + totalFines - totalPaid,
      },
      fines: teamFines,
      payments: teamPayments,
    }
  }
}
