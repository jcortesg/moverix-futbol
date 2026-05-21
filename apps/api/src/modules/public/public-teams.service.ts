import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common'
import { and, eq } from 'drizzle-orm'
import { DatabaseService } from '../../db/database.service'
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

@Injectable()
export class PublicTeamsService {
  constructor(private readonly database: DatabaseService) {}

  private get db() {
    return this.database.db
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
}
