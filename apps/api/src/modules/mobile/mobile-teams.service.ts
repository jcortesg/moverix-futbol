import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { eq, or, sql, desc, asc, and, inArray, isNull, ne, like } from 'drizzle-orm'
import { randomUUID } from 'crypto'
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
import { computeFinalPosition, type FinalPosition } from './team-final-position'
import { isTeamDelegate } from '../../common/utils/team-delegates'
import { reactivateFormerMember, retireTeamMember } from '../../common/utils/team-former-members'

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
type RegistrationPlayerPosition = (typeof registrationPlayers.$inferSelect)['position']
type PlayerHistory = {
  playerUid: string
  firstName: string | null
  lastName: string | null
  docNumber: string | null
  birthDate: string | null
  employer: string | null
  phone: string | null
  email: string | null
  healthProvider: string | null
  docFileUrl: string | null
  photoFileUrl: string | null
  emergencyContactName: string | null
  emergencyContactPhone: string | null
  position: RegistrationPlayerPosition
  jerseyNumber: number | null
  sameTeam: boolean
}
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
  bracketSlots,
  teamFormerMembers,
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
      if (!(await this.codeTaken(code))) return code
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
      isDirector: r.directorUid === uid || r.role === 'director',
      isPrincipal: r.directorUid === uid,
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

    // 0) ¿Es un código PERSONAL (ficha creada por el delegado con nombre y
    // celular)? Liga esa ficha a la cuenta de quien lo ingresa.
    const [personal] = await this.db
      .select({ id: registrationPlayers.id })
      .from(registrationPlayers)
      .where(and(eq(registrationPlayers.inviteCode, accessCode), isNull(registrationPlayers.removedAt)))
    if (personal) {
      return this.claimPersonalInvite(uid, displayName, personal.id)
    }

    // 1) ¿Es un código de invitación de inscripción? El invitado entra directo a
    // la nómina de ese campeonato (además de al club). Códigos de 8 chars.
    const [regInvite] = await this.db
      .select({
        registrationId: registrations.id,
        teamId: registrations.teamId,
        editionId: registrations.editionId,
        editionName: editions.name,
        registrationsOpen: editions.registrationsOpen,
        rosterLocked: registrations.rosterLocked,
        rostersLocked: editions.rostersLocked,
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
    await reactivateFormerMember(this.db, team.id, uid)

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
      rosterLocked: boolean | null
      rostersLocked: boolean
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
    await reactivateFormerMember(this.db, reg.teamId, uid)

    // 2. Agregar a la nómina del campeonato si la nómina está abierta (mismo
    // criterio que agregar desde la app: el candado de nómina del organizador).
    const rosterOpen = isRosterOpen(reg.rosterLocked, reg.rostersLocked)
    let addedToRegistration = false

    // Si el delegado ya lo había agregado a la lista (ficha sin cuenta), se une
    // con esa ficha en vez de crear otra: se reconoce por cédula o celular.
    const manualMatch = await this.findManualRowFor(reg.registrationId, uid, profile?.docNumber ?? null)
    if (manualMatch) {
      await this.claimManualRow(uid, playerName, manualMatch.id)
      return {
        teamId: reg.teamId,
        teamName: reg.teamName,
        logoUrl: reg.logoUrl,
        registrationId: reg.registrationId,
        editionName: reg.editionName,
        addedToRegistration: true,
        registrationsOpen: reg.registrationsOpen,
        rosterOpen,
        message: `¡Listo! Ya estás en la nómina de ${reg.teamName} en ${reg.editionName}.`,
      }
    }

    if (rosterOpen) {
      const history = await this.loadPlayerHistory([uid], reg.teamId)
      const dedupe = await this.rosterUniqueGuard(reg.registrationId)
      const row = this.buildRosterRow(
        reg.registrationId,
        uid,
        playerName,
        { fullName: profile?.fullName ?? null, position: profile?.position ?? null, docNumber: profile?.docNumber ?? null, phone: null },
        history.get(uid),
        dedupe,
      )
      const inserted = await this.db
        .insert(registrationPlayers)
        .values(row)
        .onConflictDoNothing({
          target: [registrationPlayers.registrationId, registrationPlayers.playerUid],
        })
        .returning({ id: registrationPlayers.id, playerUid: registrationPlayers.playerUid, isNew: sql<boolean>`true` })
      addedToRegistration = inserted.length > 0
      await this.copyHistoryFiles(inserted, history)
    }

    const message = !rosterOpen
      ? `Te uniste a ${reg.teamName}, pero la nómina de ${reg.editionName} está cerrada.`
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
      rosterOpen,
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
    if (!(await isTeamDelegate(this.db, teamId, uid, team.directorUid))) throw new ForbiddenException('Solo un delegado puede compartir invitaciones')

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
    if (!(await isTeamDelegate(this.db, reg.teamId, uid, reg.directorUid))) throw new ForbiddenException('Solo un delegado puede compartir invitaciones')

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
    if (!(await isTeamDelegate(this.db, teamId, uid, team.directorUid))) throw new ForbiddenException('Solo un delegado puede regenerar el código')

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
        isPrincipal: sql<boolean>`(${teams.directorUid} = ${teamMembers.playerUid})`,
        isPlayer: teamMembers.isPlayer,
        joinedAt: teamMembers.joinedAt,
        avatarUrl: playerProfiles.avatarUrl,
        username: playerProfiles.username,
        position: playerProfiles.position,
        // Dorsal de su ficha de nómina más reciente con este equipo (si tiene).
        jerseyNumber: sql<number | null>`(
          SELECT rp.jersey_number
          FROM registration_players rp
          JOIN registrations r ON r.id = rp.registration_id
          WHERE r.team_id = ${teamMembers.teamId}
            AND rp.player_uid = ${teamMembers.playerUid}
            AND rp.removed_at IS NULL
            AND rp.jersey_number IS NOT NULL
          ORDER BY rp.added_at DESC
          LIMIT 1
        )`,
      })
      .from(teamMembers)
      .innerJoin(teams, eq(teams.id, teamMembers.teamId))
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
    if (!(await isTeamDelegate(this.db, teamId, actorUid, team.directorUid))) throw new ForbiddenException('Solo un delegado puede remover miembros')
    if (memberUid === team.directorUid) throw new ForbiddenException('No se puede remover al delegado principal')
    if (memberUid === actorUid) throw new BadRequestException('No puedes removerte a ti mismo')

    // Borra de team_members y lo deja como exjugador, en una transacción.
    await retireTeamMember(this.db, teamId, memberUid, 'removed', actorUid)

    return { removed: memberUid }
  }

  async leaveTeam(teamId: string, uid: string) {
    const [team] = await this.db
      .select({ directorUid: teams.directorUid })
      .from(teams)
      .where(eq(teams.id, teamId))

    if (!team) throw new NotFoundException('Equipo no encontrado')
    if (team.directorUid === uid) throw new BadRequestException('El director no puede abandonar el equipo')

    await retireTeamMember(this.db, teamId, uid, 'left', null)

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

    const [members, rawChampionships, dashData, formerPlayers, recordAndForm, topScorers] = await Promise.all([
      this.getMembers(teamId),
      this.getChampionships(teamId),
      this.dashboard(teamId),
      this.getFormerPlayers(teamId),
      this.getRecordAndForm(teamId),
      this.getTopScorers(teamId),
    ])

    const championships = await this.withFinalPositions(teamId, rawChampionships)
    const honours = { champion: 0, runnerUp: 0, third: 0 }
    for (const c of championships) {
      if (c.finalPosition === 'champion') honours.champion++
      else if (c.finalPosition === 'runner_up') honours.runnerUp++
      else if (c.finalPosition === 'third') honours.third++
    }

    return {
      ...team,
      memberCount: members.length,
      members,
      championships,
      stats: dashData.stats,
      recentMatches: dashData.recentMatches.slice(0, 10),
      formerPlayers,
      form: recordAndForm.form,
      record: recordAndForm.record,
      topScorers,
      honours,
    }
  }

  /** Exjugadores (team_former_members), el más reciente primero. */
  private async getFormerPlayers(teamId: string) {
    const rows = await this.db
      .select({
        uid: teamFormerMembers.playerUid,
        storedName: teamFormerMembers.playerName,
        fullName: playerProfiles.fullName,
        avatarUrl: playerProfiles.avatarUrl,
        leftAt: teamFormerMembers.leftAt,
        reason: teamFormerMembers.reason,
      })
      .from(teamFormerMembers)
      // Las fichas 'manual:' no tienen perfil: se listan, pero sin buscar avatar.
      .leftJoin(
        playerProfiles,
        and(eq(playerProfiles.uid, teamFormerMembers.playerUid), sql`${teamFormerMembers.playerUid} NOT LIKE 'manual:%'`),
      )
      .where(and(eq(teamFormerMembers.teamId, teamId), isNull(playerProfiles.deactivatedAt)))
      .orderBy(desc(teamFormerMembers.leftAt))

    return rows.map((r) => ({
      uid: r.uid,
      name: r.fullName ?? r.storedName,
      avatarUrl: r.avatarUrl ?? null,
      leftAt: new Date(r.leftAt).toISOString(),
      reason: r.reason,
    }))
  }

  /**
   * Balance (PJ/G/E/P/GF/GC) y racha de los últimos 5, agregados en SQL.
   * Cuentan los partidos terminados con marcador ('finished' y 'walkover', igual
   * que las tablas). Una llave definida por penales cuenta como empate.
   */
  private async getRecordAndForm(teamId: string) {
    const isMine = or(eq(matches.homeTeamId, teamId), eq(matches.awayTeamId, teamId))
    const played = and(
      inArray(matches.status, ['finished', 'walkover']),
      sql`${matches.homeScore} IS NOT NULL AND ${matches.awayScore} IS NOT NULL`,
      isMine,
    )
    const gf = sql`CASE WHEN ${matches.homeTeamId} = ${teamId} THEN ${matches.homeScore} ELSE ${matches.awayScore} END`
    const ga = sql`CASE WHEN ${matches.homeTeamId} = ${teamId} THEN ${matches.awayScore} ELSE ${matches.homeScore} END`

    const [[agg], last5] = await Promise.all([
      this.db
        .select({
          played: sql<number>`count(*)::int`,
          won: sql<number>`count(*) FILTER (WHERE ${gf} > ${ga})::int`,
          drawn: sql<number>`count(*) FILTER (WHERE ${gf} = ${ga})::int`,
          lost: sql<number>`count(*) FILTER (WHERE ${gf} < ${ga})::int`,
          goalsFor: sql<number>`COALESCE(sum(${gf}), 0)::int`,
          goalsAgainst: sql<number>`COALESCE(sum(${ga}), 0)::int`,
        })
        .from(matches)
        .where(played),
      this.db
        .select({
          result: sql<'W' | 'D' | 'L'>`CASE WHEN ${gf} > ${ga} THEN 'W' WHEN ${gf} = ${ga} THEN 'D' ELSE 'L' END`,
        })
        .from(matches)
        .where(played)
        .orderBy(desc(sql`COALESCE(${matches.finishedAt}, ${matches.scheduledAt}, ${matches.createdAt})`))
        .limit(5),
    ])

    return {
      record: {
        played: agg?.played ?? 0,
        won: agg?.won ?? 0,
        drawn: agg?.drawn ?? 0,
        lost: agg?.lost ?? 0,
        goalsFor: agg?.goalsFor ?? 0,
        goalsAgainst: agg?.goalsAgainst ?? 0,
      },
      // Más antiguo primero: el más reciente queda a la derecha.
      form: last5.map((r) => r.result).reverse(),
    }
  }

  /** Top 5 goleadores históricos del equipo (gol + penal; sin autogoles). */
  private async getTopScorers(teamId: string) {
    const goals = sql<number>`count(*)::int`
    const rows = await this.db
      .select({
        uid: sql<string>`${matchEvents.playerUid}`,
        lastName: sql<string | null>`(array_agg(${matchEvents.playerName} ORDER BY ${matchEvents.createdAt} DESC) FILTER (WHERE ${matchEvents.playerName} IS NOT NULL))[1]`,
        fullName: sql<string | null>`max(${playerProfiles.fullName})`,
        avatarUrl: sql<string | null>`max(${playerProfiles.avatarUrl})`,
        goals,
        isCurrent: sql<boolean>`EXISTS (
          SELECT 1 FROM team_members tm
          WHERE tm.team_id = ${teamId} AND tm.player_uid = ${matchEvents.playerUid}
        )`,
      })
      .from(matchEvents)
      .innerJoin(matches, eq(matches.id, matchEvents.matchId))
      .leftJoin(
        playerProfiles,
        and(eq(playerProfiles.uid, matchEvents.playerUid), sql`${matchEvents.playerUid} NOT LIKE 'manual:%'`),
      )
      .where(
        and(
          eq(matchEvents.teamId, teamId),
          inArray(matchEvents.eventType, ['goal', 'penalty_scored']),
          sql`${matchEvents.playerUid} IS NOT NULL`,
          inArray(matches.status, ['finished', 'live', 'walkover']),
        ),
      )
      .groupBy(matchEvents.playerUid)
      .orderBy(desc(goals), asc(sql`min(${matchEvents.createdAt})`))
      .limit(5)

    return rows.map((r) => ({
      uid: r.uid,
      name: r.fullName ?? r.lastName ?? 'Jugador',
      avatarUrl: r.avatarUrl ?? null,
      goals: r.goals,
      isCurrent: !!r.isCurrent,
    }))
  }

  /**
   * Agrega finalPosition y playsThirdPlace a cada campeonato, leyendo el cuadro
   * de todas las ediciones en una sola consulta (ver team-final-position.ts).
   */
  private async withFinalPositions<
    T extends { status: string; edition: { id: string; status: string } },
  >(teamId: string, championships: T[]) {
    const editionIds = [...new Set(championships.map((c) => c.edition.id))]
    const slots = editionIds.length
      ? await this.db
          .select({
            id: bracketSlots.id,
            editionId: bracketSlots.editionId,
            cupName: bracketSlots.cupName,
            round: bracketSlots.round,
            homeTeamId: bracketSlots.homeTeamId,
            awayTeamId: bracketSlots.awayTeamId,
            winnerId: bracketSlots.winnerId,
            nextSlotId: bracketSlots.nextSlotId,
            loserNextSlotId: bracketSlots.loserNextSlotId,
            createdAt: bracketSlots.createdAt,
          })
          .from(bracketSlots)
          .where(inArray(bracketSlots.editionId, editionIds))
      : []

    const byEdition = new Map<string, typeof slots>()
    for (const s of slots) {
      const list = byEdition.get(s.editionId) ?? []
      list.push(s)
      byEdition.set(s.editionId, list)
    }

    return championships.map((c) => {
      const { finalPosition, playsThirdPlace } = computeFinalPosition({
        slots: byEdition.get(c.edition.id) ?? [],
        teamId,
        editionStatus: c.edition.status,
        registrationStatus: c.status,
      })
      return { ...c, finalPosition: finalPosition as FinalPosition, playsThirdPlace }
    })
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

  /** Partidos jugados del equipo, paginados (más reciente primero). */
  async matchesPage(teamId: string, page = 1, pageSize = 10) {
    const size = Math.min(Math.max(Math.trunc(pageSize) || 10, 1), 50)
    const p = Math.max(Math.trunc(page) || 1, 1)
    const rows = await this.getRecentMatches(teamId, size + 1, (p - 1) * size)
    return { items: rows.slice(0, size), page: p, pageSize: size, hasMore: rows.length > size }
  }

  private async getRecentMatches(teamId: string, limit = 30, offset = 0) {
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
      .orderBy(desc(matches.finishedAt), desc(matches.id))
      .limit(limit)
      .offset(offset)

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
        rosterLocked: registrations.rosterLocked,
        edition: {
          id: editions.id,
          name: editions.name,
          season: editions.season,
          status: editions.status,
          registrationsOpen: editions.registrationsOpen,
          rostersLocked: editions.rostersLocked,
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
      // Fuente única de "nómina abierta" para la app: el mismo criterio que usa
      // el API para dejar agregar, quitar o editar jugadores.
      rosterOpen: isRosterOpen(row.rosterLocked, row.edition.rostersLocked),
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
    if (!(await isTeamDelegate(this.db, teamId, uid, team.directorUid))) throw new ForbiddenException('Solo un delegado puede inscribir el equipo')

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
    if (isRosterOpen(row.teamLocked, row.editionLocked)) return

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
    if (!(await isTeamDelegate(this.db, reg.teamId, uid, team.directorUid))) throw new ForbiddenException('Solo un delegado puede agregar jugadores')

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

    // Precarga: perfil + la ficha más completa del jugador en inscripciones
    // anteriores (fecha de nacimiento, EPS, correo, contacto de emergencia,
    // foto y documento). Así el delegado no vuelve a pedir todo cada torneo.
    const history = await this.loadPlayerHistory(toInsert.map((m) => m.playerUid), reg.teamId)
    const dedupe = await this.rosterUniqueGuard(registrationId)

    const inserted = await this.db
      .insert(registrationPlayers)
      .values(
        toInsert.map((m) =>
          this.buildRosterRow(registrationId, m.playerUid, m.playerName, m, history.get(m.playerUid), dedupe),
        ),
      )
      // Si el jugador ya tenia fila (activa o dada de baja) se REVIVE y se
      // conservan sus datos previos: documento, foto, dorsal, EPS.
      .onConflictDoUpdate({
        target: [registrationPlayers.registrationId, registrationPlayers.playerUid],
        set: { removedAt: null, removedBy: null },
      })
      .returning({
        id: registrationPlayers.id,
        playerUid: registrationPlayers.playerUid,
        isNew: sql<boolean>`(xmax = 0)`,
      })

    await this.copyHistoryFiles(inserted, history)

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

    if (!team || !(await isTeamDelegate(this.db, reg.teamId, uid, team.directorUid))) throw new ForbiddenException('Solo un delegado puede remover jugadores')

    // Retirar NO requiere nómina abierta ni aprobación del organizador (decisión
    // de producto 2026-11-12). Lo que el candado impide es inscribir a otro en su
    // lugar: agregar sí exige nómina abierta (assertRosterOpen en addPlayers).

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

    const rosterOpen = await this.rosterOpenFor(registrationId)
    return { removed: playerUid, rosterOpen }
  }

  private async rosterOpenFor(registrationId: string) {
    const [row] = await this.db
      .select({ teamLocked: registrations.rosterLocked, editionLocked: editions.rostersLocked })
      .from(registrations)
      .innerJoin(editions, eq(editions.id, registrations.editionId))
      .where(eq(registrations.id, registrationId))
    return row ? isRosterOpen(row.teamLocked, row.editionLocked) : false
  }

  // ── Delegados adicionales ──────────────────────────────────

  /**
   * El delegado principal (teams.director_uid) nombra o quita delegados
   * adicionales entre los miembros del club. Un adicional tiene los mismos
   * permisos de gestión, pero no puede tocar al principal ni nombrar a otros.
   */
  async setMemberDelegate(teamId: string, memberUid: string, makeDelegate: boolean, actorUid: string) {
    const [team] = await this.db
      .select({ directorUid: teams.directorUid })
      .from(teams)
      .where(eq(teams.id, teamId))
    if (!team) throw new NotFoundException('Equipo no encontrado')
    if (team.directorUid !== actorUid) {
      throw new ForbiddenException('Solo el delegado principal puede nombrar o quitar delegados')
    }
    if (memberUid === team.directorUid) {
      throw new BadRequestException('El delegado principal no se puede cambiar desde aquí')
    }
    if (makeDelegate && memberUid.startsWith('manual:')) {
      throw new BadRequestException('Solo puede ser delegado alguien con cuenta en la app')
    }

    const [member] = await this.db
      .update(teamMembers)
      .set({ role: makeDelegate ? 'director' : 'player' })
      .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.playerUid, memberUid)))
      .returning({ playerUid: teamMembers.playerUid, playerName: teamMembers.playerName, role: teamMembers.role })
    if (!member) throw new NotFoundException('Esa persona no es miembro del equipo')

    if (makeDelegate) {
      await this.notifications.createFor([memberUid], {
        type: 'team',
        title: 'Ahora eres delegado',
        body: 'Ya puedes invitar jugadores, armar la nómina e inscribir al equipo.',
        data: { kind: 'team', teamId },
      })
    }
    return member
  }

  // ── Opción A + C: jugadores en la lista sin cuenta y enlace personal ─────

  /** ¿El código ya existe como código de equipo, de inscripción o personal? */
  private async codeTaken(code: string) {
    const [t] = await this.db.select({ id: teams.id }).from(teams).where(eq(teams.accessCode, code))
    if (t) return true
    const [r] = await this.db.select({ id: registrations.id }).from(registrations).where(eq(registrations.inviteCode, code))
    if (r) return true
    const [p] = await this.db
      .select({ id: registrationPlayers.id })
      .from(registrationPlayers)
      .where(eq(registrationPlayers.inviteCode, code))
    return !!p
  }

  private async generateUniquePersonalCode(): Promise<string> {
    for (let attempt = 0; attempt < 10; attempt++) {
      const code = generateAccessCode()
      if (!(await this.codeTaken(code))) return code
    }
    throw new ConflictException('No se pudo generar un código único, intenta de nuevo')
  }

  /**
   * El delegado agrega a alguien a la lista con nombre y celular, aunque todavía
   * no tenga la app. La ficha queda con uid 'manual:' y un código personal que
   * se le comparte; al ingresarlo, la ficha pasa a su cuenta.
   */
  async addListPlayer(
    registrationId: string,
    actorUid: string,
    input: { firstName: string; lastName?: string | null; phone?: string | null; docNumber?: string | null },
  ) {
    const reg = await this.registrationForDelegate(registrationId, actorUid)
    await this.assertRosterOpen(registrationId)

    const firstName = (input.firstName ?? '').trim()
    const lastName = (input.lastName ?? '').trim() || null
    if (!firstName) throw new BadRequestException('Escribe el nombre del jugador')
    const phone = normalizePhone(input.phone)
    const docNumber = (input.docNumber ?? '').replace(/\D/g, '') || null
    if (!phone && !docNumber) throw new BadRequestException('Escribe el celular del jugador')

    // ¿Ya está en esta nómina? (misma cédula o mismo celular)
    const active = await this.db
      .select({ playerName: registrationPlayers.playerName, phone: registrationPlayers.phone, docNumber: registrationPlayers.docNumber })
      .from(registrationPlayers)
      .where(and(eq(registrationPlayers.registrationId, registrationId), isNull(registrationPlayers.removedAt)))
    const dup = active.find(
      (p) => (docNumber && p.docNumber === docNumber) || (phone && normalizePhone(p.phone) === phone),
    )
    if (dup) throw new ConflictException(`${dup.playerName} ya está en la nómina con ese celular o cédula`)

    const code = await this.generateUniquePersonalCode()
    const playerName = [firstName, lastName].filter(Boolean).join(' ')
    const [row] = await this.db
      .insert(registrationPlayers)
      .values({
        registrationId,
        playerUid: `manual:${randomUUID()}`,
        playerName,
        firstName,
        lastName,
        phone,
        docNumber,
        inviteCode: code,
      })
      .returning()

    return {
      player: stripInviteCode(row),
      invite: this.personalInviteText(code, firstName, reg.teamName, reg.editionName),
    }
  }

  /** Mensaje con el enlace personal de un jugador de la lista (solo delegados). */
  async getListPlayerInvite(registrationId: string, playerUid: string, actorUid: string) {
    const reg = await this.registrationForDelegate(registrationId, actorUid)
    const [row] = await this.db
      .select()
      .from(registrationPlayers)
      .where(and(eq(registrationPlayers.registrationId, registrationId), eq(registrationPlayers.playerUid, playerUid)))
    if (!row) throw new NotFoundException('Jugador no encontrado en esta nómina')
    if (!row.playerUid.startsWith('manual:')) {
      throw new BadRequestException(`${row.playerName} ya entró a la app con su cuenta`)
    }
    let code = row.inviteCode
    if (!code) {
      code = await this.generateUniquePersonalCode()
      await this.db.update(registrationPlayers).set({ inviteCode: code }).where(eq(registrationPlayers.id, row.id))
    }
    return this.personalInviteText(code, row.firstName ?? row.playerName, reg.teamName, reg.editionName)
  }

  private personalInviteText(code: string, firstName: string, teamName: string, editionName: string) {
    return {
      code,
      url: `${INVITE_BASE_URL}/i/${code}`,
      shareText: [
        `⚽ Hola ${firstName}, ${teamName} te inscribió en ${editionName} (Moverix)`,
        ``,
        `Completa tus datos con este enlace, es solo para ti:`,
        `👉 ${INVITE_BASE_URL}/i/${code}`,
        `🔑 Código: ${code}`,
        ``,
        `Descarga la app:`,
        `📱 iOS: ${IOS_STORE_URL}`,
        `🤖 Android: ${ANDROID_STORE_URL}`,
      ].join('\n'),
    }
  }

  private async registrationForDelegate(registrationId: string, actorUid: string) {
    const [reg] = await this.db
      .select({
        teamId: registrations.teamId,
        directorUid: teams.directorUid,
        teamName: teams.name,
        editionName: editions.name,
      })
      .from(registrations)
      .innerJoin(teams, eq(teams.id, registrations.teamId))
      .innerJoin(editions, eq(editions.id, registrations.editionId))
      .where(eq(registrations.id, registrationId))
    if (!reg) throw new NotFoundException('Inscripción no encontrada')
    if (!(await isTeamDelegate(this.db, reg.teamId, actorUid, reg.directorUid))) {
      throw new ForbiddenException('Solo un delegado puede gestionar la nómina')
    }
    return reg
  }

  /** Ficha sin cuenta de esta nómina que corresponde al usuario (cédula o celular). */
  private async findManualRowFor(registrationId: string, uid: string, docNumber: string | null) {
    const [profile] = await this.db
      .select({ phone: playerProfiles.phone, docNumber: playerProfiles.docNumber })
      .from(playerProfiles)
      .where(eq(playerProfiles.uid, uid))
    const doc = docNumber ?? profile?.docNumber ?? null
    const phone = normalizePhone(profile?.phone)
    if (!doc && !phone) return null

    const rows = await this.db
      .select({ id: registrationPlayers.id, docNumber: registrationPlayers.docNumber, phone: registrationPlayers.phone })
      .from(registrationPlayers)
      .where(
        and(
          eq(registrationPlayers.registrationId, registrationId),
          isNull(registrationPlayers.removedAt),
          like(registrationPlayers.playerUid, 'manual:%'),
        ),
      )
    return rows.find((r) => (doc && r.docNumber === doc) || (phone && normalizePhone(r.phone) === phone)) ?? null
  }

  /** Ingreso con código personal: liga la ficha de la lista a esta cuenta. */
  private async claimPersonalInvite(uid: string, displayName: string, rowId: string) {
    const [row] = await this.db
      .select({
        id: registrationPlayers.id,
        playerUid: registrationPlayers.playerUid,
        registrationId: registrationPlayers.registrationId,
        teamId: registrations.teamId,
        teamName: teams.name,
        logoUrl: teams.logoUrl,
        editionName: editions.name,
        registrationsOpen: editions.registrationsOpen,
      })
      .from(registrationPlayers)
      .innerJoin(registrations, eq(registrations.id, registrationPlayers.registrationId))
      .innerJoin(teams, eq(teams.id, registrations.teamId))
      .innerJoin(editions, eq(editions.id, registrations.editionId))
      .where(eq(registrationPlayers.id, rowId))
    if (!row) throw new NotFoundException('Código de invitación inválido')
    if (!row.playerUid.startsWith('manual:') && row.playerUid !== uid) {
      throw new ConflictException('Este enlace ya lo usó otra cuenta. Pídele uno nuevo a tu delegado.')
    }

    const [profile] = await this.db
      .select({ fullName: playerProfiles.fullName })
      .from(playerProfiles)
      .where(eq(playerProfiles.uid, uid))
    await this.claimManualRow(uid, profile?.fullName ?? displayName, row.id)

    return {
      teamId: row.teamId,
      teamName: row.teamName,
      logoUrl: row.logoUrl,
      registrationId: row.registrationId,
      editionName: row.editionName,
      addedToRegistration: true,
      registrationsOpen: row.registrationsOpen,
      rosterOpen: true,
      message: `¡Listo! Ya estás en la nómina de ${row.teamName} en ${row.editionName}. Completa tus datos.`,
    }
  }

  /**
   * Pasa una ficha 'manual:' a la cuenta real. Si la persona ya tenía ficha en
   * esa nómina, se completan sus campos vacíos con los de la lista y la ficha
   * manual se elimina. Mueve también lo que la ficha manual tuviera en partidos.
   */
  private async claimManualRow(uid: string, playerName: string, rowId: string) {
    await this.db.transaction(async (tx) => {
      const [manual] = await tx.select().from(registrationPlayers).where(eq(registrationPlayers.id, rowId))
      if (!manual || manual.playerUid === uid) return
      const manualUid = manual.playerUid

      const [reg] = await tx
        .select({ teamId: registrations.teamId })
        .from(registrations)
        .where(eq(registrations.id, manual.registrationId))

      await tx
        .insert(teamMembers)
        .values({ teamId: reg.teamId, playerUid: uid, playerName, role: 'player', isPlayer: true })
        .onConflictDoUpdate({ target: [teamMembers.teamId, teamMembers.playerUid], set: { isPlayer: true } })
      await reactivateFormerMember(tx, reg.teamId, uid)

      const [own] = await tx
        .select()
        .from(registrationPlayers)
        .where(and(eq(registrationPlayers.registrationId, manual.registrationId), eq(registrationPlayers.playerUid, uid)))

      if (own) {
        const fill: Record<string, unknown> = { removedAt: null, removedBy: null }
        for (const k of [
          'firstName', 'lastName', 'docNumber', 'birthDate', 'employer', 'phone', 'email', 'healthProvider',
          'jerseyNumber', 'position', 'docFileUrl', 'photoFileUrl', 'emergencyContactName', 'emergencyContactPhone',
        ] as const) {
          if (own[k] == null && manual[k] != null) fill[k] = manual[k]
        }
        await tx.delete(registrationPlayers).where(eq(registrationPlayers.id, manual.id))
        await tx.update(registrationPlayers).set(fill).where(eq(registrationPlayers.id, own.id))
      } else {
        await tx
          .update(registrationPlayers)
          .set({ playerUid: uid, playerName, inviteCode: null, claimedAt: new Date() })
          .where(eq(registrationPlayers.id, manual.id))
      }

      // Lo que se haya anotado a la ficha manual en partidos pasa a la cuenta.
      await tx.update(matchEvents).set({ playerUid: uid }).where(eq(matchEvents.playerUid, manualUid))
      await tx.update(matchEvents).set({ assistPlayerUid: uid }).where(eq(matchEvents.assistPlayerUid, manualUid))
    })
  }

  // ── Precarga de fichas desde inscripciones anteriores ─────────

  /**
   * Por jugador, su ficha más completa en cualquier inscripción (prefiere la
   * más llena y, a igualdad, la más reciente). Solo cuentan cuentas reales.
   */
  private async loadPlayerHistory(playerUids: string[], teamId: string) {
    const map = new Map<string, PlayerHistory>()
    const uids = playerUids.filter((u) => u && !u.startsWith('manual:'))
    if (!uids.length) return map

    const rp = registrationPlayers
    const filled = sql`(
      (${rp.docNumber} IS NOT NULL)::int + (${rp.birthDate} IS NOT NULL)::int + (${rp.phone} IS NOT NULL)::int +
      (${rp.email} IS NOT NULL)::int + (${rp.healthProvider} IS NOT NULL)::int + (${rp.employer} IS NOT NULL)::int +
      (${rp.emergencyContactName} IS NOT NULL)::int + (${rp.emergencyContactPhone} IS NOT NULL)::int +
      (${rp.docFileUrl} IS NOT NULL)::int + (${rp.photoFileUrl} IS NOT NULL)::int
    )`
    const rows = await this.db
      .selectDistinctOn([rp.playerUid], {
        playerUid: rp.playerUid,
        firstName: rp.firstName,
        lastName: rp.lastName,
        docNumber: rp.docNumber,
        birthDate: rp.birthDate,
        employer: rp.employer,
        phone: rp.phone,
        email: rp.email,
        healthProvider: rp.healthProvider,
        docFileUrl: rp.docFileUrl,
        photoFileUrl: rp.photoFileUrl,
        emergencyContactName: rp.emergencyContactName,
        emergencyContactPhone: rp.emergencyContactPhone,
        position: rp.position,
        jerseyNumber: rp.jerseyNumber,
        sameTeam: sql<boolean>`(${registrations.teamId} = ${teamId})`,
      })
      .from(rp)
      .innerJoin(registrations, eq(registrations.id, rp.registrationId))
      .where(inArray(rp.playerUid, uids))
      .orderBy(rp.playerUid, desc(filled), desc(rp.addedAt))

    for (const r of rows) map.set(r.playerUid, r)
    return map
  }

  /** Cédulas y correos ya usados en la nómina (índices únicos por inscripción). */
  private async rosterUniqueGuard(registrationId: string) {
    const rows = await this.db
      .select({ docNumber: registrationPlayers.docNumber, email: registrationPlayers.email })
      .from(registrationPlayers)
      .where(and(eq(registrationPlayers.registrationId, registrationId), isNull(registrationPlayers.removedAt)))
    return {
      docs: new Set(rows.map((r) => r.docNumber).filter(Boolean) as string[]),
      emails: new Set(rows.map((r) => r.email?.toLowerCase()).filter(Boolean) as string[]),
    }
  }

  /**
   * Arma la fila de nómina: el perfil manda en cédula/teléfono/posición (es lo
   * más actual); el resto sale del historial. Una cédula o correo repetido en
   * la misma nómina se deja vacío para no chocar con los índices únicos (varios
   * jugadores suelen compartir el correo del delegado).
   */
  private buildRosterRow(
    registrationId: string,
    playerUid: string,
    playerName: string,
    profile: { fullName: string | null; position: RegistrationPlayerPosition | null; docNumber: string | null; phone: string | null },
    hist: PlayerHistory | undefined,
    dedupe: { docs: Set<string>; emails: Set<string> },
  ) {
    const split = splitName(profile.fullName ?? playerName)
    let docNumber = profile.docNumber ?? hist?.docNumber ?? null
    if (docNumber && dedupe.docs.has(docNumber)) docNumber = null
    if (docNumber) dedupe.docs.add(docNumber)
    let email = hist?.email ?? null
    if (email && dedupe.emails.has(email.toLowerCase())) email = null
    if (email) dedupe.emails.add(email.toLowerCase())

    return {
      registrationId,
      playerUid,
      playerName,
      firstName: hist?.firstName ?? split.firstName,
      lastName: hist?.lastName ?? split.lastName,
      position: profile.position ?? hist?.position ?? null,
      // El dorsal es del equipo: solo se hereda si la ficha anterior era del mismo.
      jerseyNumber: hist?.sameTeam ? hist.jerseyNumber : null,
      docNumber,
      phone: profile.phone ?? hist?.phone ?? null,
      email,
      birthDate: hist?.birthDate ?? null,
      employer: hist?.employer ?? null,
      healthProvider: hist?.healthProvider ?? null,
      emergencyContactName: hist?.emergencyContactName ?? null,
      emergencyContactPhone: hist?.emergencyContactPhone ?? null,
    }
  }

  /** Copia foto y documento de la ficha anterior a las filas NUEVAS. Best-effort. */
  private async copyHistoryFiles(
    rows: { id: string; playerUid: string; isNew: boolean }[],
    history: Map<string, PlayerHistory>,
  ) {
    for (const row of rows) {
      if (!row.isNew) continue
      const hist = history.get(row.playerUid)
      if (!hist) continue
      const patch: { docFileUrl?: string; photoFileUrl?: string } = {}
      for (const [kind, column] of [['document', 'docFileUrl'], ['photo', 'photoFileUrl']] as const) {
        const src = hist[column]
        if (!src) continue
        try {
          patch[column] = await this.storage.copyPrivate(src, `registration-players/${row.id}`, PLAYER_FILE_KINDS[kind].label)
        } catch {
          // Si el archivo viejo no existe, el jugador lo vuelve a subir.
        }
      }
      if (patch.docFileUrl || patch.photoFileUrl) {
        await this.db.update(registrationPlayers).set(patch).where(eq(registrationPlayers.id, row.id))
      }
    }
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
    if (playerUid !== actorUid && !(await isTeamDelegate(this.db, reg.teamId, actorUid, team.directorUid))) {
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
      // El nombre visible de la nómina sigue a nombre + apellido: antes se quedaba
      // con el usuario del correo con que se unió (p. ej. "unionescueladeformacion").
      if ('firstName' in patch || 'lastName' in patch) {
        const full = [updated.firstName, updated.lastName].map((x) => (x ?? '').trim()).filter(Boolean).join(' ')
        if (full && full !== updated.playerName) {
          const [renamed] = await this.db
            .update(registrationPlayers)
            .set({ playerName: full.slice(0, 160) })
            .where(eq(registrationPlayers.id, player.id))
            .returning()
          return renamed
        }
      }
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

    if (!(await isTeamDelegate(this.db, reg.teamId, actorUid, team.directorUid))) {
      const [member] = await this.db
        .select({ id: teamMembers.id })
        .from(teamMembers)
        .where(and(eq(teamMembers.teamId, reg.teamId), eq(teamMembers.playerUid, actorUid)))
      if (!member) throw new ForbiddenException('No tienes acceso a esta plantilla')
    }

    // Los jugadores dados de baja no se listan, salvo para el propio jugador
    // (que debe poder ver su fila marcada). El organizador los ve en el admin.
    // El código personal no se expone: con él otro miembro podría reclamar la ficha.
    const rows = await this.db
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
    return rows.map(stripInviteCode)
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
    if (playerUid !== actorUid && !(await isTeamDelegate(this.db, reg.teamId, actorUid, team.directorUid))) {
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

    // Estado por jugador para el delegado: sin entrar (ficha sin cuenta),
    // faltan datos, o listo.
    const playerStates = players.map((p) => {
      const missing = requiredFields.filter((key) => !isFieldFilled(p as Record<string, unknown>, key))
      const state = p.playerUid.startsWith('manual:') ? 'sin_entrar' : missing.length ? 'faltan_datos' : 'listo'
      return { playerUid: p.playerUid, playerName: p.playerName, state, missing: missing.map((k) => fieldLabel(k)) }
    })

    return {
      registrationId,
      status: reg.status,
      playersCount: players.length,
      playerStates,
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
    if (!(await isTeamDelegate(this.db, reg.teamId, uid, team.directorUid))) throw new ForbiddenException('Solo un delegado puede enviar la inscripción')
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

    // Solo bloquea el mínimo/máximo de jugadores. Los datos incompletos NO
    // bloquean el envío (decisión de producto 2026-11-12): cada jugador los
    // sigue completando después, y se pueden agregar jugadores mientras la
    // nómina esté abierta. La app muestra cuántos faltan.
    const { countIssue, missingByPlayer } = await this.getRosterStatus(registrationId)

    if (countIssue) {
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

/**
 * ¿La nómina está abierta? El candado del equipo (registrations.roster_locked)
 * manda si está definido (true/false); si es null hereda el de la edición
 * (editions.rosters_locked). Mismo criterio para el API y para la app.
 */
export function isRosterOpen(teamLocked: boolean | null | undefined, editionLocked: boolean | null | undefined): boolean {
  return !(teamLocked ?? editionLocked ?? false)
}

/** Celular colombiano normalizado a sus últimos 10 dígitos (sin +57, espacios ni guiones). */
export function normalizePhone(phone: string | null | undefined): string | null {
  const digits = (phone ?? '').replace(/\D/g, '')
  if (digits.length < 7) return null
  return digits.length > 10 ? digits.slice(-10) : digits
}

function stripInviteCode<T extends { inviteCode?: string | null }>(row: T): Omit<T, 'inviteCode'> {
  const { inviteCode: _omit, ...rest } = row
  return rest
}
