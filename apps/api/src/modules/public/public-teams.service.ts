import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common'
import { and, asc, eq } from 'drizzle-orm'
import { isTeamDelegate } from '../../common/utils/team-delegates'
import { DatabaseService } from '../../db/database.service'
import { StorageService } from '../../common/services/storage.service'
import {
  teams,
  teamMembers,
  registrations,
  registrationPlayers,
  editions,
  leagues,
  organizations,
  playerProfiles,
} from '../../db/schema'

const ALLOWED_DOC_MIME = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic']

@Injectable()
export class PublicTeamsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly storage: StorageService,
  ) {}

  private get db() {
    return this.database.db
  }

  /** Datos mínimos del equipo para la landing de invitación (lookup por código). */
  async getTeamByCode(code: string) {
    const accessCode = (code ?? '').toUpperCase().trim()
    if (!accessCode) throw new NotFoundException('Código no válido')

    // 1) Código de invitación de EQUIPO (teams.access_code)
    const [team] = await this.db
      .select({
        name: teams.name,
        accessCode: teams.accessCode,
        logoUrl: teams.logoUrl,
        city: teams.city,
        primaryColor: teams.primaryColor,
      })
      .from(teams)
      .where(eq(teams.accessCode, accessCode))
    if (team) return { ...team, editionName: null as string | null }

    // 2) Código de invitación de INSCRIPCIÓN (registrations.invite_code) → mismo
    //    formato de landing; al ingresarlo en la app entra directo a la nómina del campeonato.
    const [reg] = await this.db
      .select({
        name: teams.name,
        logoUrl: teams.logoUrl,
        city: teams.city,
        primaryColor: teams.primaryColor,
        editionName: editions.name,
      })
      .from(registrations)
      .innerJoin(teams, eq(teams.id, registrations.teamId))
      .innerJoin(editions, eq(editions.id, registrations.editionId))
      .where(eq(registrations.inviteCode, accessCode))
    if (reg) return { ...reg, accessCode }

    throw new NotFoundException('Invitación no válida')
  }

  /** Public team info for the invite page */
  async getTeamBySlug(teamSlug: string, editionSlug?: string) {
    const [team] = await this.db
      .select({
        id: teams.id,
        name: teams.name,
        slug: teams.slug,
        shortName: teams.shortName,
        logoUrl: teams.logoUrl,
        primaryColor: teams.primaryColor,
        city: teams.city,
      })
      .from(teams)
      .where(eq(teams.slug, teamSlug.toLowerCase().trim()))

    if (!team) throw new NotFoundException('Equipo no encontrado')

    // Get members
    const members = await this.db
      .select({
        playerName: teamMembers.playerName,
        role: teamMembers.role,
      })
      .from(teamMembers)
      .where(eq(teamMembers.teamId, team.id))

    // If editionSlug, get edition info
    let edition: any = null
    if (editionSlug) {
      const [ed] = await this.db
        .select({
          id: editions.id,
          name: editions.name,
          slug: editions.slug,
          season: editions.season,
          status: editions.status,
          logoUrl: editions.logoUrl,
          league: {
            name: leagues.name,
            sportFormat: leagues.sportFormat,
          },
          organization: {
            name: organizations.name,
          },
        })
        .from(editions)
        .innerJoin(leagues, eq(leagues.id, editions.leagueId))
        .innerJoin(organizations, eq(organizations.id, leagues.organizationId))
        .where(eq(editions.slug, editionSlug))

      if (ed) edition = ed
    }

    // If edition found, get roster (registration_players)
    let roster: any[] = []
    if (edition) {
      const [reg] = await this.db
        .select({ id: registrations.id, status: registrations.status })
        .from(registrations)
        .where(
          and(
            eq(registrations.editionId, edition.id),
            eq(registrations.teamId, team.id),
          ),
        )

      if (reg) {
        roster = await this.db
          .select({
            playerName: registrationPlayers.playerName,
            firstName: registrationPlayers.firstName,
            lastName: registrationPlayers.lastName,
            position: registrationPlayers.position,
            jerseyNumber: registrationPlayers.jerseyNumber,
            addedAt: registrationPlayers.addedAt,
          })
          .from(registrationPlayers)
          .where(eq(registrationPlayers.registrationId, reg.id))

        edition = { ...edition, registrationStatus: reg.status }
      }
    }

    return { ...team, members, edition, roster }
  }

  /** Join team + register to tournament roster in one step */
  async joinAndRegister(
    uid: string,
    _displayName: string,
    dto: {
      teamSlug: string
      accessCode: string
      editionSlug?: string
      playerName: string
      firstName?: string
      lastName?: string
      docNumber?: string
      phone?: string
      email?: string
      position?: string
      jerseyNumber?: number
    },
  ) {
    // 1. Find team by slug + validate access code
    const [team] = await this.db
      .select()
      .from(teams)
      .where(eq(teams.slug, dto.teamSlug.toLowerCase().trim()))

    if (!team) throw new NotFoundException('Equipo no encontrado')
    if (team.accessCode !== dto.accessCode.toUpperCase().trim()) {
      throw new BadRequestException('Código de acceso incorrecto')
    }

    // 2. Add to team_members (skip if already member)
    const [existingMember] = await this.db
      .select({ id: teamMembers.id })
      .from(teamMembers)
      .where(and(eq(teamMembers.teamId, team.id), eq(teamMembers.playerUid, uid)))

    if (!existingMember) {
      await this.db.insert(teamMembers).values({
        teamId: team.id,
        playerUid: uid,
        playerName: dto.playerName,
        role: 'player',
      })
    }

    // 3. If editionSlug provided, also add to tournament roster
    let registrationInfo: any = null
    if (dto.editionSlug) {
      // Find the edition
      const [edition] = await this.db
        .select({ id: editions.id })
        .from(editions)
        .where(eq(editions.slug, dto.editionSlug))

      if (!edition) throw new NotFoundException('Torneo no encontrado')

      // Find the team's registration in this edition
      const [reg] = await this.db
        .select({ id: registrations.id, status: registrations.status })
        .from(registrations)
        .where(
          and(
            eq(registrations.editionId, edition.id),
            eq(registrations.teamId, team.id),
          ),
        )

      if (!reg) {
        throw new BadRequestException('El equipo no está inscrito en este torneo')
      }

      // Check if already in roster
      const [existingPlayer] = await this.db
        .select({ id: registrationPlayers.id })
        .from(registrationPlayers)
        .where(
          and(
            eq(registrationPlayers.registrationId, reg.id),
            eq(registrationPlayers.playerUid, uid),
          ),
        )

      if (!existingPlayer) {
        await this.db.insert(registrationPlayers).values({
          registrationId: reg.id,
          playerUid: uid,
          playerName: dto.playerName,
          firstName: dto.firstName,
          lastName: dto.lastName,
          docNumber: dto.docNumber,
          phone: dto.phone,
          email: dto.email,
          position: dto.position as any,
          jerseyNumber: dto.jerseyNumber,
        })
      }

      registrationInfo = { registrationId: reg.id, editionId: edition.id }
    }

    // 4. Update player profile if it exists (set docNumber, name)
    const [profile] = await this.db
      .select({ id: playerProfiles.id })
      .from(playerProfiles)
      .where(eq(playerProfiles.uid, uid))

    if (profile && dto.docNumber) {
      await this.db
        .update(playerProfiles)
        .set({ docNumber: dto.docNumber, updatedAt: new Date() })
        .where(eq(playerProfiles.uid, uid))
    }

    return {
      teamId: team.id,
      teamName: team.name,
      joined: !existingMember,
      registration: registrationInfo,
    }
  }

  /** Verify user is the team director for a registration */
  private async verifyDirector(uid: string, registrationId: string) {
    const [reg] = await this.db
      .select({ teamId: registrations.teamId })
      .from(registrations)
      .where(eq(registrations.id, registrationId))
    if (!reg) throw new NotFoundException('Inscripcion no encontrada')

    const [team] = await this.db
      .select({ directorUid: teams.directorUid })
      .from(teams)
      .where(eq(teams.id, reg.teamId))
    if (!team || !(await isTeamDelegate(this.db, reg.teamId, uid, team.directorUid))) {
      throw new ForbiddenException('No eres delegado de este equipo')
    }
    return reg
  }

  /** Get roster for a registration (director only) */
  async getRosterForDirector(uid: string, registrationId: string) {
    await this.verifyDirector(uid, registrationId)
    return this.db
      .select()
      .from(registrationPlayers)
      .where(eq(registrationPlayers.registrationId, registrationId))
      .orderBy(asc(registrationPlayers.jerseyNumber), asc(registrationPlayers.playerName))
  }

  /** Add player manually to roster (director only) */
  async addPlayerForDirector(
    uid: string,
    dto: {
      registrationId: string
      playerName: string
      firstName?: string
      lastName?: string
      docNumber?: string
      birthDate?: string
      employer?: string
      healthProvider?: string
      phone?: string
      email?: string
      position?: string
      jerseyNumber?: number
      emergencyContactName?: string
      emergencyContactPhone?: string
    },
  ) {
    await this.verifyDirector(uid, dto.registrationId)
    const [row] = await this.db.insert(registrationPlayers).values({
      registrationId: dto.registrationId,
      playerUid: `manual-${Date.now()}`,
      playerName: dto.playerName,
      firstName: dto.firstName,
      lastName: dto.lastName,
      docNumber: dto.docNumber,
      birthDate: dto.birthDate,
      employer: dto.employer,
      healthProvider: dto.healthProvider,
      phone: dto.phone,
      email: dto.email,
      position: dto.position as any,
      jerseyNumber: dto.jerseyNumber,
      emergencyContactName: dto.emergencyContactName,
      emergencyContactPhone: dto.emergencyContactPhone,
    }).returning()
    return row
  }

  /** Verify the user is the director of the team that owns this roster player */
  private async verifyDirectorForPlayer(uid: string, playerId: string) {
    const [player] = await this.db
      .select({ registrationId: registrationPlayers.registrationId, docFileUrl: registrationPlayers.docFileUrl })
      .from(registrationPlayers)
      .where(eq(registrationPlayers.id, playerId))
    if (!player) throw new NotFoundException('Jugador no encontrado')
    await this.verifyDirector(uid, player.registrationId)
    return player
  }

  /** Upload a player's ID document (cédula) — director only */
  async uploadPlayerDocumentForDirector(uid: string, playerId: string, file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Archivo requerido')
    if (!ALLOWED_DOC_MIME.includes(file.mimetype)) {
      throw new BadRequestException('Formato no permitido. Usa PDF, JPG, PNG, WEBP o HEIC.')
    }
    const player = await this.verifyDirectorForPlayer(uid, playerId)
    const key = await this.storage.uploadPrivateDocument(`registration-players/${playerId}`, file)
    if (player.docFileUrl && player.docFileUrl !== key) {
      await this.storage.deletePrivate(player.docFileUrl)
    }
    const [updated] = await this.db
      .update(registrationPlayers)
      .set({ docFileUrl: key })
      .where(eq(registrationPlayers.id, playerId))
      .returning()
    return updated
  }

  /** Stream a player's ID document — director only */
  async getPlayerDocumentForDirector(uid: string, playerId: string) {
    const player = await this.verifyDirectorForPlayer(uid, playerId)
    if (!player.docFileUrl) throw new NotFoundException('Este jugador no tiene documento adjunto')
    return this.storage.streamPrivate(player.docFileUrl)
  }
}
