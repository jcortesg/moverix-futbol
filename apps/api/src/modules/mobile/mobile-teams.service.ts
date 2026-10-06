import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { eq, or, sql, desc, asc, and, inArray, isNull, ne } from 'drizzle-orm'
import { DatabaseService } from '../../db/database.service'
import { StorageService } from '../../common/services/storage.service'
import { SocialPostsService } from '../social/social-posts.service'
import {
  resolveRequiredFields,
  isFieldFilled,
  fieldLabel,
  ROSTER_PLAYER_FIELDS,
} from './roster-fields'
import { MobileNotificationsService } from './mobile-notifications.service'

const ALLOWED_DOC_MIME = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic']
const ALLOWED_IMAGE_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/heic']

// Links para el mensaje de invitación (landing web + tiendas). Configurables por env.
const INVITE_BASE_URL = process.env.INVITE_BASE_URL ?? 'https://futbol.moverix.co'
const IOS_STORE_URL =
  process.env.IOS_STORE_URL ?? 'https://apps.apple.com/es/app/moverix-futbol/id6774387262'
const ANDROID_STORE_URL =
  process.env.ANDROID_STORE_URL ?? 'https://play.google.com/store/apps/details?id=com.moverixfutbol'

// Tipos de archivo adjuntables a un jugador de la inscripción y su columna en BD.
const PLAYER_FILE_KINDS = {
  document: { column: 'docFileUrl', label: 'doc', mimes: ALLOWED_DOC_MIME },
  photo: { column: 'photoFileUrl', label: 'photo', mimes: ALLOWED_IMAGE_MIME },
} as const
type PlayerFileKind = keyof typeof PLAYER_FILE_KINDS
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

function splitName(full: string): { firstName: string | null; lastName: string | null } {
  const parts = (full ?? '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return { firstName: null, lastName: null }
  if (parts.length === 1) return { firstName: parts[0], lastName: null }
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') }
}

function generateAccessCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 7; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}

@Injectable()
export class MobileTeamsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly storage: StorageService,
    private readonly socialPosts: SocialPostsService,
    private readonly notifications: MobileNotificationsService,
  ) {}

  private get db() {
    return this.database.db
  }

  /** Genera un código de acceso único en toda la plataforma. */
  private async generateUniqueAccessCode(): Promise<string> {
    for (let attempt = 0; attempt < 10; attempt++) {
      const code = generateAccessCode()
      const [exists] = await this.db
        .select({ id: teams.id })
        .from(teams)
        .where(eq(teams.accessCode, code))
      if (!exists) return code
    }
    throw new ConflictException('No se pudo generar un código único, intenta de nuevo')
  }

  // Código de invitación de inscripción: mismo formato que el de equipo (7 chars).
  // Se valida contra AMBAS tablas para que un código nunca choque con uno de equipo.
  private async generateUniqueRegistrationCode(): Promise<string> {
    for (let attempt = 0; attempt < 10; attempt++) {
      const code = generateAccessCode()
      const [regExists] = await this.db
        .select({ id: registrations.id })
        .from(registrations)
        .where(eq(registrations.inviteCode, code))
      const [teamExists] = await this.db
        .select({ id: teams.id })
        .from(teams)
        .where(eq(teams.accessCode, code))
      if (!regExists && !teamExists) return code
    }
    throw new ConflictException('No se pudo generar un código único, intenta de nuevo')
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
    const accessCode = await this.generateUniqueAccessCode()

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

  async joinTeam(uid: string, displayName: string, code: string) {
    const accessCode = code?.toUpperCase().trim()
    if (!accessCode) throw new BadRequestException('Ingresa el código de invitación')

    // 1) ¿Es un código de invitación de inscripción? El invitado entra directo a
    // la nómina de ese campeonato (además de al club). Códigos de 8 chars.
    const [regInvite] = await this.db
      .select({
        registrationId: registrations.id,
        teamId: registrations.teamId,
        editionId: registrations.editionId,
        editionName: editions.name,
        registrationsOpen: editions.registrationsOpen,
        teamName: teams.name,
        logoUrl: teams.logoUrl,
      })
      .from(registrations)
      .innerJoin(teams, eq(teams.id, registrations.teamId))
      .innerJoin(editions, eq(editions.id, registrations.editionId))
      .where(eq(registrations.inviteCode, accessCode))

    if (regInvite) {
      return this.joinViaRegistration(uid, displayName, regInvite)
    }

    // 2) Código de equipo (club). El código de acceso es único → resuelve el equipo.
    const [team] = await this.db
      .select()
      .from(teams)
      .where(eq(teams.accessCode, accessCode))

    if (!team) throw new NotFoundException('Código de invitación inválido')

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

  /** Unirse vía código de inscripción: club + nómina de ese campeonato. Idempotente. */
  private async joinViaRegistration(
    uid: string,
    displayName: string,
    reg: {
      registrationId: string
      teamId: string
      editionName: string
      registrationsOpen: boolean
      teamName: string
      logoUrl: string | null
    },
  ) {
    const [profile] = await this.db
      .select({
        fullName: playerProfiles.fullName,
        position: playerProfiles.position,
        docNumber: playerProfiles.docNumber,
      })
      .from(playerProfiles)
      .where(eq(playerProfiles.uid, uid))

    const playerName = profile?.fullName ?? displayName

    // 1. Asegurar miembro del club (idempotente).
    await this.db
      .insert(teamMembers)
      .values({ teamId: reg.teamId, playerUid: uid, playerName, role: 'player', isPlayer: true })
      .onConflictDoNothing({ target: [teamMembers.teamId, teamMembers.playerUid] })

    // 2. Agregar a la nómina del campeonato si las inscripciones están abiertas.
    let addedToRegistration = false
    if (reg.registrationsOpen) {
      const { firstName, lastName } = splitName(profile?.fullName ?? playerName)
      const inserted = await this.db
        .insert(registrationPlayers)
        .values({
          registrationId: reg.registrationId,
          playerUid: uid,
          playerName,
          position: profile?.position ?? null,
          docNumber: profile?.docNumber ?? null,
          firstName,
          lastName,
        })
        .onConflictDoNothing({
          target: [registrationPlayers.registrationId, registrationPlayers.playerUid],
        })
        .returning({ id: registrationPlayers.id })
      addedToRegistration = inserted.length > 0
    }

    const message = !reg.registrationsOpen
      ? `Te uniste a ${reg.teamName}, pero las inscripciones de ${reg.editionName} están cerradas.`
      : addedToRegistration
        ? `¡Listo! Entraste a la nómina de ${reg.teamName} en ${reg.editionName}.`
        : `Ya estabas en la nómina de ${reg.editionName}.`

    return {
      teamId: reg.teamId,
      teamName: reg.teamName,
      logoUrl: reg.logoUrl,
      registrationId: reg.registrationId,
      editionName: reg.editionName,
      addedToRegistration,
      registrationsOpen: reg.registrationsOpen,
      message,
    }
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
        `⚽ Te invito a unirte a ${team.name} en Moverix`,
        ``,
        `🔑 Código de invitación: ${team.accessCode}`,
        `👉 ${INVITE_BASE_URL}/i/${team.accessCode}`,
        ``,
        `Descarga la app:`,
        `📱 iOS: ${IOS_STORE_URL}`,
        `🤖 Android: ${ANDROID_STORE_URL}`,
        ``,
        `¡Nos vemos en la cancha! ⚽`,
      ].join('\n'),
    }
  }

  /**
   * Invitación a una inscripción concreta. El invitado que ingrese este código
   * entra directo a la nómina de ESTE campeonato (además de al club). Solo el
   * director; genera el código la primera vez.
   */
  async getRegistrationInvite(registrationId: string, uid: string) {
    const [reg] = await this.db
      .select({
        id: registrations.id,
        teamId: registrations.teamId,
        inviteCode: registrations.inviteCode,
        teamName: teams.name,
        directorUid: teams.directorUid,
        editionName: editions.name,
      })
      .from(registrations)
      .innerJoin(teams, eq(teams.id, registrations.teamId))
      .innerJoin(editions, eq(editions.id, registrations.editionId))
      .where(eq(registrations.id, registrationId))

    if (!reg) throw new NotFoundException('Inscripción no encontrada')
    if (reg.directorUid !== uid) throw new ForbiddenException('Solo el director puede compartir invitaciones')

    let code = reg.inviteCode
    if (!code) {
      code = await this.generateUniqueRegistrationCode()
      await this.db
        .update(registrations)
        .set({ inviteCode: code, updatedAt: new Date() })
        .where(eq(registrations.id, registrationId))
    }

    return {
      code,
      editionName: reg.editionName,
      teamName: reg.teamName,
      shareText: [
        `⚽ Te invito a inscribirte con ${reg.teamName} en ${reg.editionName} (Moverix)`,
        ``,
        `🔑 Código de invitación: ${code}`,
        `👉 ${INVITE_BASE_URL}/i/${code}`,
        ``,
        `Descarga la app:`,
        `📱 iOS: ${IOS_STORE_URL}`,
        `🤖 Android: ${ANDROID_STORE_URL}`,
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

    const newCode = await this.generateUniqueAccessCode()
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
        isPlayer: teamMembers.isPlayer,
        joinedAt: teamMembers.joinedAt,
        avatarUrl: playerProfiles.avatarUrl,
        username: playerProfiles.username,
        position: playerProfiles.position,
      })
      .from(teamMembers)
      .leftJoin(playerProfiles, eq(playerProfiles.uid, teamMembers.playerUid))
      .where(eq(teamMembers.teamId, teamId))
      .orderBy(desc(teamMembers.role), asc(teamMembers.joinedAt))

    if (members.length === 0) return members

    // Estar en el CLUB no es estar inscrito en el torneo: son dos listas. Se
    // devuelve en qué torneos activos está cada quien y en cuáles falta, para
    // que la app pueda avisar en vez de dejar el hueco invisible.
    const regs = await this.db
      .select({
        registrationId: registrations.id,
        editionId: editions.id,
        editionName: editions.name,
      })
      .from(registrations)
      .innerJoin(editions, eq(editions.id, registrations.editionId))
      .where(
        and(
          eq(registrations.teamId, teamId),
          ne(registrations.status, 'withdrawn'),
          inArray(editions.status, ['registration', 'active']),
        ),
      )

    if (regs.length === 0) {
      return members.map((m) => ({ ...m, tournaments: [], missingIn: [] }))
    }

    const rows = await this.db
      .select({
        registrationId: registrationPlayers.registrationId,
        playerUid: registrationPlayers.playerUid,
      })
      .from(registrationPlayers)
      .where(
        and(
          inArray(registrationPlayers.registrationId, regs.map((r) => r.registrationId)),
          isNull(registrationPlayers.removedAt),
        ),
      )

    const enrolled = new Map<string, Set<string>>()
    for (const r of rows) {
      if (!enrolled.has(r.playerUid)) enrolled.set(r.playerUid, new Set())
      enrolled.get(r.playerUid)!.add(r.registrationId)
    }

    return members.map((m) => {
      const mine = enrolled.get(m.playerUid) ?? new Set<string>()
      return {
        ...m,
        tournaments: regs
          .filter((r) => mine.has(r.registrationId))
          .map((r) => ({ editionId: r.editionId, name: r.editionName })),
        missingIn: regs
          .filter((r) => !mine.has(r.registrationId))
          .map((r) => ({
            editionId: r.editionId,
            registrationId: r.registrationId,
            name: r.editionName,
          })),
      }
    })
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

  /** Public team profile — basic info + members + championships + stats */
  async profile(teamId: string) {
    const [team] = await this.db
      .select({
        id: teams.id,
        name: teams.name,
        shortName: teams.shortName,
        logoUrl: teams.logoUrl,
        primaryColor: teams.primaryColor,
        secondaryColor: teams.secondaryColor,
        city: teams.city,
        createdAt: teams.createdAt,
      })
      .from(teams)
      .where(eq(teams.id, teamId))

    if (!team) throw new NotFoundException('Equipo no encontrado')

    const [members, championships, dashData] = await Promise.all([
      this.getMembers(teamId),
      this.getChampionships(teamId),
      this.dashboard(teamId),
    ])

    return {
      ...team,
      memberCount: members.length,
      members,
      championships,
      stats: dashData.stats,
      recentMatches: dashData.recentMatches.slice(0, 10),
    }
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
          registrationsOpen: editions.registrationsOpen,
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
          registrationsOpen: editions.registrationsOpen,
          logoUrl: editions.logoUrl,
          startDate: editions.startDate,
          endDate: editions.endDate,
          minPlayersPerTeam: editions.minPlayersPerTeam,
          maxPlayersPerTeam: editions.maxPlayersPerTeam,
          requiredPlayerFields: editions.requiredPlayerFields,
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

    const requiredFields = resolveRequiredFields(row.edition.requiredPlayerFields)
    const requiredSet = new Set(requiredFields)

    return {
      ...row,
      group: row.group?.id ? row.group : null,
      rosterConfig: {
        minPlayersPerTeam: row.edition.minPlayersPerTeam,
        maxPlayersPerTeam: row.edition.maxPlayersPerTeam,
        // Solo los requeridos (para validación / indicador "faltan")
        requiredPlayerFields: requiredFields.map((key) => ({ key, label: fieldLabel(key) })),
        // Catálogo completo de campos del jugador, con flag de requerido, para
        // que el formulario muestre TODOS (requeridos y opcionales).
        playerFields: ROSTER_PLAYER_FIELDS.map((f) => ({
          key: f.key,
          label: f.label,
          required: requiredSet.has(f.key),
        })),
      },
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

    // Verify edition exists and registrations are open (flag independiente del status).
    const [edition] = await this.db
      .select({ id: editions.id, registrationsOpen: editions.registrationsOpen, name: editions.name })
      .from(editions)
      .where(eq(editions.id, editionId))

    if (!edition) throw new NotFoundException('Campeonato no encontrado')
    if (!edition.registrationsOpen) {
      throw new BadRequestException('Las inscripciones de este campeonato están cerradas.')
    }

    // Check if already registered
    const [existing] = await this.db
      .select({ id: registrations.id })
      .from(registrations)
      .where(and(eq(registrations.editionId, editionId), eq(registrations.teamId, teamId)))

    if (existing) throw new ConflictException('Este equipo ya esta inscrito en este campeonato')

    // Nace en 'draft': aún no tiene una plantilla válida. Pasa a 'pending'
    // cuando el director envía la inscripción (submitRegistration) y supera
    // la validación de mín/máx jugadores y campos requeridos.
    const [registration] = await this.db
      .insert(registrations)
      .values({
        editionId,
        teamId,
        registeredByUid: uid,
        status: 'draft',
      })
      .returning()

    return {
      registrationId: registration.id,
      teamName: team.name,
      editionName: edition.name,
    }
  }

  // ── Add players from global roster to tournament ───────


  /**
   * Nómina cerrada = no se puede tocar la plantilla.
   * El candado del equipo tiene prioridad y admite tres estados: si no define
   * nada hereda el cierre general, pero puede forzar abierto o cerrado. Así el
   * organizador puede abrirle la nómina a un solo equipo con todo cerrado.
   */
  private async assertRosterOpen(registrationId: string) {
    const [row] = await this.db
      .select({
        teamLocked: registrations.rosterLocked,
        editionLocked: editions.rostersLocked,
      })
      .from(registrations)
      .innerJoin(editions, eq(editions.id, registrations.editionId))
      .where(eq(registrations.id, registrationId))

    if (!row) return

    // El equipo puede tener una excepción explícita (abierto o cerrado); si no
    // define nada (null), hereda el cierre general de la edición.
    const locked = row.teamLocked ?? row.editionLocked
    if (!locked) return

    throw new BadRequestException(
      row.teamLocked === true
        ? 'La nómina de tu equipo fue cerrada por el organizador.'
        : 'Las nóminas del campeonato están cerradas. Contacta al organizador.',
    )
  }

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
        editionId: registrations.editionId,
        editionName: editions.name,
      })
      .from(registrations)
      .innerJoin(editions, eq(editions.id, registrations.editionId))
      .where(eq(registrations.id, registrationId))

    if (!reg) throw new NotFoundException('Inscripcion no encontrada')

    const [team] = await this.db
      .select({ directorUid: teams.directorUid, name: teams.name, logoUrl: teams.logoUrl })
      .from(teams)
      .where(eq(teams.id, reg.teamId))

    if (!team) throw new NotFoundException('Equipo no encontrado')
    if (team.directorUid !== uid) throw new ForbiddenException('Solo el director puede agregar jugadores')

    if (!playerUids.length) throw new BadRequestException('Selecciona al menos un jugador')

    await this.assertRosterOpen(registrationId)

    // Get members from global roster (prefill con datos del perfil global)
    const members = await this.db
      .select({
        playerUid: teamMembers.playerUid,
        playerName: teamMembers.playerName,
        position: playerProfiles.position,
        docNumber: playerProfiles.docNumber,
        phone: playerProfiles.phone,
        fullName: playerProfiles.fullName,
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
      .select({
        playerUid: registrationPlayers.playerUid,
        removedAt: registrationPlayers.removedAt,
      })
      .from(registrationPlayers)
      .where(
        and(
          eq(registrationPlayers.registrationId, registrationId),
          inArray(registrationPlayers.playerUid, playerUids),
        ),
      )

    // Solo cuentan como "ya inscritos" los ACTIVOS: una fila dada de baja debe
    // poder revivir. El filtro es orientativo (hay carrera entre este SELECT y
    // el INSERT), por eso el insert lleva ademas ON CONFLICT.
    const existingUids = new Set(existing.filter((e) => !e.removedAt).map((e) => e.playerUid))
    const toInsert = members.filter((m) => !existingUids.has(m.playerUid))

    if (toInsert.length === 0) {
      return { added: 0, message: 'Todos los jugadores ya estan inscritos' }
    }

    await this.db
      .insert(registrationPlayers)
      .values(
        toInsert.map((m) => {
          const { firstName, lastName } = splitName(m.fullName ?? m.playerName)
          return {
            registrationId,
            playerUid: m.playerUid,
            playerName: m.playerName,
            position: m.position,
            docNumber: m.docNumber,
            // El teléfono del perfil prefila la inscripción: es uno de los
            // campos obligatorios que más faltaba.
            phone: m.phone,
            firstName,
            lastName,
          }
        }),
      )
      // Si el jugador ya tenia fila (activa o dada de baja) se REVIVE y se
      // conservan sus datos previos: documento, foto, dorsal, EPS.
      .onConflictDoUpdate({
        target: [registrationPlayers.registrationId, registrationPlayers.playerUid],
        set: { removedAt: null, removedBy: null },
      })

    // Evento en el feed de cada jugador inscrito (incluido el DT si se agrega
    // a sí mismo: queda como registro de su entrada a la plantilla). Best-effort.
    for (const m of toInsert) {
      try {
        await this.socialPosts.onPlayerAddedToRegistration({
          registrationId,
          playerUid: m.playerUid,
          team: { id: reg.teamId, name: team.name, logoUrl: team.logoUrl },
          edition: { id: reg.editionId, name: reg.editionName },
        })
      } catch (err) {
        // No bloquear la inscripción si falla el evento
      }
    }

    // Notificación "te agregaron a la nómina" (menos al DT que se agrega solo).
    await this.notifications.createFor(
      toInsert.map((m) => m.playerUid).filter((u) => u !== uid),
      {
        type: 'team',
        title: `Te agregaron a ${team.name}`,
        body: `Estás en la nómina para ${reg.editionName}`,
        data: { kind: 'registration', teamId: reg.teamId, editionId: reg.editionId, registrationId },
      },
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

    await this.assertRosterOpen(registrationId)

    // Baja LOGICA: nunca se borra la fila. Asi se conservan documento, foto y
    // dorsal, y el jugador sigue ligado a los goles que ya anoto en el torneo
    // (sus estadisticas se mantienen). El organizador puede restaurarlo.
    await this.db
      .update(registrationPlayers)
      .set({ removedAt: new Date(), removedBy: uid })
      .where(
        and(
          eq(registrationPlayers.registrationId, registrationId),
          eq(registrationPlayers.playerUid, playerUid),
          isNull(registrationPlayers.removedAt),
        ),
      )

    return { removed: playerUid }
  }

  // ── Update a registration player's detail fields ───────

  /**
   * Permite completar/editar los campos de un jugador de la plantilla.
   * Autorizado: el director del equipo o el propio jugador.
   */
  async updateRegistrationPlayer(
    registrationId: string,
    playerUid: string,
    dto: Record<string, unknown>,
    actorUid: string,
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

    if (!team) throw new NotFoundException('Equipo no encontrado')
    if (team.directorUid !== actorUid && playerUid !== actorUid) {
      throw new ForbiddenException('Solo el director o el propio jugador pueden editar estos datos')
    }

    const [player] = await this.db
      .select({ id: registrationPlayers.id })
      .from(registrationPlayers)
      .where(
        and(
          eq(registrationPlayers.registrationId, registrationId),
          eq(registrationPlayers.playerUid, playerUid),
        ),
      )

    if (!player) throw new NotFoundException('Jugador no encontrado en esta plantilla')

    // Cerrar la nómina define QUIÉNES juegan, no impide que cada quien complete
    // sus propios datos: el organizador justamente necesita que los completen.
    // El dorsal y la posición sí son decisión deportiva y siguen bloqueados.
    const SPORTING_FIELDS = ['jerseyNumber', 'position']
    const editaSusDatos = playerUid === actorUid
    const tocaCampoDeportivo = SPORTING_FIELDS.some((k) => k in dto)
    if (!editaSusDatos || tocaCampoDeportivo) {
      await this.assertRosterOpen(registrationId)
    }

    // Solo campos del formulario; nunca uid/nombre/archivos (esos tienen su flujo).
    const EDITABLE = [
      'firstName', 'lastName', 'docNumber', 'birthDate', 'employer', 'phone',
      'email', 'healthProvider', 'jerseyNumber', 'position',
      'emergencyContactName', 'emergencyContactPhone',
    ] as const

    const patch: Record<string, unknown> = {}
    for (const key of EDITABLE) {
      if (key in dto) patch[key] = dto[key]
    }
    if (Object.keys(patch).length === 0) {
      throw new BadRequestException('No hay campos para actualizar')
    }

    try {
      const [updated] = await this.db
        .update(registrationPlayers)
        .set(patch)
        .where(eq(registrationPlayers.id, player.id))
        .returning()
      return updated
    } catch (err: any) {
      // drizzle-orm 0.45 envuelve el error de Postgres en err.cause; el code/constraint
      // reales viven ahí. Revisamos ambos para mapear la violación única a un 409 claro.
      const pg = err?.cause ?? err
      if (pg?.code === '23505') {
        const constraint = pg?.constraint ?? ''
        if (constraint.includes('email')) throw new ConflictException('Ese email ya está usado por otro jugador del equipo')
        if (constraint.includes('doc')) throw new ConflictException('Ese documento ya está usado por otro jugador del equipo')
        if (constraint.includes('uid')) throw new ConflictException('Este jugador ya está en la plantilla')
        throw new ConflictException('Dato duplicado en la plantilla')
      }
      throw err
    }
  }

  // ── Plantilla de la inscripción (lectura móvil) ────────
  // Autorizado: DT del equipo o cualquier miembro del equipo (para que el
  // jugador pueda ver su plantilla). El endpoint admin /registration-players
  // exige ser dueño de la ORG, por eso el móvil usa este.
  async getRegistrationPlayers(registrationId: string, actorUid: string) {
    const [reg] = await this.db
      .select({ teamId: registrations.teamId })
      .from(registrations)
      .where(eq(registrations.id, registrationId))
    if (!reg) throw new NotFoundException('Inscripcion no encontrada')

    const [team] = await this.db
      .select({ directorUid: teams.directorUid })
      .from(teams)
      .where(eq(teams.id, reg.teamId))
    if (!team) throw new NotFoundException('Equipo no encontrado')

    if (team.directorUid !== actorUid) {
      const [member] = await this.db
        .select({ id: teamMembers.id })
        .from(teamMembers)
        .where(and(eq(teamMembers.teamId, reg.teamId), eq(teamMembers.playerUid, actorUid)))
      if (!member) throw new ForbiddenException('No tienes acceso a esta plantilla')
    }

    // Los jugadores dados de baja no se listan, salvo para el propio jugador
    // (que debe poder ver su fila marcada). El organizador los ve en el admin.
    return this.db
      .select()
      .from(registrationPlayers)
      .where(
        and(
          eq(registrationPlayers.registrationId, registrationId),
          or(
            isNull(registrationPlayers.removedAt),
            eq(registrationPlayers.playerUid, actorUid),
          ),
        ),
      )
      .orderBy(asc(registrationPlayers.jerseyNumber), asc(registrationPlayers.playerName))
  }

  // ── Archivos del jugador (cédula, foto) desde el móvil ──
  // Autorización: director del equipo o el propio jugador (igual que el PATCH).

  private async getEditablePlayer(registrationId: string, playerUid: string, actorUid: string) {
    const [reg] = await this.db
      .select({ teamId: registrations.teamId })
      .from(registrations)
      .where(eq(registrations.id, registrationId))
    if (!reg) throw new NotFoundException('Inscripcion no encontrada')

    const [team] = await this.db
      .select({ directorUid: teams.directorUid })
      .from(teams)
      .where(eq(teams.id, reg.teamId))
    if (!team) throw new NotFoundException('Equipo no encontrado')
    if (team.directorUid !== actorUid && playerUid !== actorUid) {
      throw new ForbiddenException('Solo el director o el propio jugador pueden editar estos datos')
    }

    const [player] = await this.db
      .select()
      .from(registrationPlayers)
      .where(
        and(
          eq(registrationPlayers.registrationId, registrationId),
          eq(registrationPlayers.playerUid, playerUid),
        ),
      )
    if (!player) throw new NotFoundException('Jugador no encontrado en esta plantilla')
    // Mismo criterio que en la edición: subir el propio documento o foto no
    // cambia quién está en la nómina.
    if (playerUid !== actorUid) {
      await this.assertRosterOpen(registrationId)
    }
    return player
  }

  async uploadPlayerFile(
    registrationId: string,
    playerUid: string,
    kind: PlayerFileKind,
    file: Express.Multer.File,
    actorUid: string,
  ) {
    if (!file) throw new BadRequestException('Archivo requerido')
    const spec = PLAYER_FILE_KINDS[kind]
    if (!spec.mimes.includes(file.mimetype)) {
      throw new BadRequestException(
        kind === 'photo'
          ? 'Formato no permitido. Usa JPG, PNG, WEBP o HEIC.'
          : 'Formato no permitido. Usa PDF, JPG, PNG, WEBP o HEIC.',
      )
    }
    const player = await this.getEditablePlayer(registrationId, playerUid, actorUid)
    const previous = (player as Record<string, unknown>)[spec.column] as string | null

    const key = await this.storage.uploadPrivateDocument(`registration-players/${player.id}`, file, spec.label)
    if (previous && previous !== key) await this.storage.deletePrivate(previous)

    await this.db
      .update(registrationPlayers)
      .set({ [spec.column]: key })
      .where(eq(registrationPlayers.id, player.id))
    return { id: player.id, kind, saved: true }
  }

  async getPlayerFile(
    registrationId: string,
    playerUid: string,
    kind: PlayerFileKind,
    actorUid: string,
  ): Promise<{ buffer: Buffer; contentType: string }> {
    const player = await this.getEditablePlayer(registrationId, playerUid, actorUid)
    const key = (player as Record<string, unknown>)[PLAYER_FILE_KINDS[kind].column] as string | null
    if (!key) throw new NotFoundException('Este jugador no tiene el archivo adjunto')
    return this.storage.streamPrivate(key)
  }

  async removePlayerFile(
    registrationId: string,
    playerUid: string,
    kind: PlayerFileKind,
    actorUid: string,
  ) {
    const spec = PLAYER_FILE_KINDS[kind]
    const player = await this.getEditablePlayer(registrationId, playerUid, actorUid)
    const key = (player as Record<string, unknown>)[spec.column] as string | null
    if (key) await this.storage.deletePrivate(key)
    await this.db
      .update(registrationPlayers)
      .set({ [spec.column]: null })
      .where(eq(registrationPlayers.id, player.id))
    return { id: player.id, kind, removed: true }
  }

  // ── Roster status ──────────────────────────────────────

  /**
   * Estado de la plantilla de una inscripción: cuántos jugadores hay, si
   * cumple el mínimo/máximo y a quiénes les faltan campos requeridos.
   * Es la misma validación que corre `submitRegistration`, pero sin efectos:
   * la app la usa para pintar las alertas de "completa la plantilla".
   */
  async getRosterStatus(registrationId: string) {
    const [reg] = await this.db
      .select({
        id: registrations.id,
        status: registrations.status,
        editionId: registrations.editionId,
      })
      .from(registrations)
      .where(eq(registrations.id, registrationId))

    if (!reg) throw new NotFoundException('Inscripcion no encontrada')

    const [edition] = await this.db
      .select({
        minPlayersPerTeam: editions.minPlayersPerTeam,
        maxPlayersPerTeam: editions.maxPlayersPerTeam,
        requiredPlayerFields: editions.requiredPlayerFields,
      })
      .from(editions)
      .where(eq(editions.id, reg.editionId))

    const requiredFields = resolveRequiredFields(edition?.requiredPlayerFields)

    // Solo los ACTIVOS cuentan: los retirados quedan en la tabla con removedAt.
    const players = await this.db
      .select()
      .from(registrationPlayers)
      .where(
        and(
          eq(registrationPlayers.registrationId, registrationId),
          isNull(registrationPlayers.removedAt),
        ),
      )

    const min = edition?.minPlayersPerTeam ?? null
    const max = edition?.maxPlayersPerTeam ?? null

    let countIssue: string | null = null
    if (players.length === 0) {
      countIssue = 'Debes inscribir al menos un jugador'
    } else if (min != null && players.length < min) {
      countIssue = `Debes inscribir al menos ${min} jugador${min === 1 ? '' : 'es'} (tienes ${players.length})`
    } else if (max != null && players.length > max) {
      countIssue = `El máximo permitido es ${max} jugador${max === 1 ? '' : 'es'} (tienes ${players.length})`
    }

    const missingByPlayer = players
      .map((p) => {
        const missing = requiredFields.filter((key) => !isFieldFilled(p as Record<string, unknown>, key))
        return missing.length
          ? { playerName: p.playerName, fields: missing.map((k) => fieldLabel(k)) }
          : null
      })
      .filter((x): x is { playerName: string; fields: string[] } => x !== null)

    return {
      registrationId,
      status: reg.status,
      playersCount: players.length,
      minPlayers: min,
      maxPlayers: max,
      countIssue,
      missingByPlayer,
      isComplete: !countIssue && missingByPlayer.length === 0,
    }
  }

  // ── Submit registration (draft → pending) ──────────────

  /**
   * El director envía la inscripción. Valida mín/máx de jugadores y campos
   * requeridos (config del organizador o defaults). Si pasa, draft → pending.
   * Si falla, lanza 400 con el detalle de lo que falta para pintar la alerta.
   */
  async submitRegistration(registrationId: string, uid: string) {
    const [reg] = await this.db
      .select({
        id: registrations.id,
        teamId: registrations.teamId,
        editionId: registrations.editionId,
        status: registrations.status,
      })
      .from(registrations)
      .where(eq(registrations.id, registrationId))

    if (!reg) throw new NotFoundException('Inscripcion no encontrada')

    const [team] = await this.db
      .select({ directorUid: teams.directorUid })
      .from(teams)
      .where(eq(teams.id, reg.teamId))

    if (!team) throw new NotFoundException('Equipo no encontrado')
    if (team.directorUid !== uid) throw new ForbiddenException('Solo el director puede enviar la inscripción')
    if (reg.status !== 'draft') {
      throw new BadRequestException('Esta inscripción ya fue enviada')
    }

    const [edition] = await this.db
      .select({ registrationsOpen: editions.registrationsOpen })
      .from(editions)
      .where(eq(editions.id, reg.editionId))

    if (edition && !edition.registrationsOpen) {
      throw new BadRequestException('Las inscripciones de este campeonato están cerradas.')
    }

    // Misma validación que ve la app en el indicador de plantilla.
    const { countIssue, missingByPlayer } = await this.getRosterStatus(registrationId)

    if (countIssue || missingByPlayer.length) {
      throw new BadRequestException({
        message: 'La plantilla no cumple los requisitos de inscripción',
        reason: 'roster_invalid',
        countIssue,
        missingByPlayer,
      })
    }

    const [updated] = await this.db
      .update(registrations)
      .set({ status: 'pending', updatedAt: new Date() })
      .where(eq(registrations.id, registrationId))
      .returning({ id: registrations.id, status: registrations.status })

    return updated
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
