import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { eq } from 'drizzle-orm'
import { DatabaseService } from '../../db/database.service'
import { editions, registrations, teams } from '../../db/schema'
import { CreateRegistrationDto } from './dto/create-registration.dto'
import { UpdateRegistrationDto } from './dto/update-registration.dto'

@Injectable()
export class RegistrationsService {
  constructor(private readonly database: DatabaseService) {}

  private get db() {
    return this.database.db
  }

  async create(dto: CreateRegistrationDto, actorUid: string) {
    // Validate edition and team exist
    const [edition] = await this.db.select().from(editions).where(eq(editions.id, dto.editionId))
    if (!edition) throw new NotFoundException(`Edición ${dto.editionId} no encontrada`)

    const [team] = await this.db.select().from(teams).where(eq(teams.id, dto.teamId))
    if (!team) throw new NotFoundException(`Equipo ${dto.teamId} no encontrado`)

    try {
      const [registration] = await this.db
        .insert(registrations)
        .values({
          editionId: dto.editionId,
          teamId: dto.teamId,
          registeredByUid: actorUid,
          seedRank: dto.seedRank,
        })
        .returning()
      return registration
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new ConflictException('Este equipo ya está inscrito en esta edición')
      }
      throw err
    }
  }

  async findByEdition(editionId: string) {
    return this.db
      .select({
        id: registrations.id,
        editionId: registrations.editionId,
        teamId: registrations.teamId,
        groupId: registrations.groupId,
        status: registrations.status,
        seedRank: registrations.seedRank,
        registeredByUid: registrations.registeredByUid,
        paidAt: registrations.paidAt,
        approvedAt: registrations.approvedAt,
        createdAt: registrations.createdAt,
        updatedAt: registrations.updatedAt,
        team: {
          id: teams.id,
          name: teams.name,
          shortName: teams.shortName,
          logoUrl: teams.logoUrl,
          primaryColor: teams.primaryColor,
          secondaryColor: teams.secondaryColor,
          city: teams.city,
          directorUid: teams.directorUid,
        },
      })
      .from(registrations)
      .innerJoin(teams, eq(teams.id, registrations.teamId))
      .where(eq(registrations.editionId, editionId))
  }

  async findMine(teamDirectorUid: string) {
    return this.db
      .select({
        id: registrations.id,
        editionId: registrations.editionId,
        teamId: registrations.teamId,
        status: registrations.status,
        groupId: registrations.groupId,
        createdAt: registrations.createdAt,
        team: {
          id: teams.id,
          name: teams.name,
          logoUrl: teams.logoUrl,
        },
      })
      .from(registrations)
      .innerJoin(teams, eq(teams.id, registrations.teamId))
      .where(eq(teams.directorUid, teamDirectorUid))
  }

  async findOne(id: string) {
    const [reg] = await this.db
      .select({
        id: registrations.id,
        editionId: registrations.editionId,
        teamId: registrations.teamId,
        groupId: registrations.groupId,
        status: registrations.status,
        seedRank: registrations.seedRank,
        registeredByUid: registrations.registeredByUid,
        paidAt: registrations.paidAt,
        approvedAt: registrations.approvedAt,
        createdAt: registrations.createdAt,
        updatedAt: registrations.updatedAt,
        team: {
          id: teams.id,
          name: teams.name,
          shortName: teams.shortName,
          logoUrl: teams.logoUrl,
          primaryColor: teams.primaryColor,
          secondaryColor: teams.secondaryColor,
          city: teams.city,
          directorUid: teams.directorUid,
        },
      })
      .from(registrations)
      .innerJoin(teams, eq(teams.id, registrations.teamId))
      .where(eq(registrations.id, id))
    if (!reg) throw new NotFoundException(`Inscripción ${id} no encontrada`)
    return reg
  }

  async update(id: string, dto: UpdateRegistrationDto) {
    const current = await this.findOne(id)
    const patch: Record<string, unknown> = { updatedAt: new Date() }

    if (dto.status !== undefined) {
      patch.status = dto.status
      if (dto.status === 'approved' && !current.approvedAt) {
        patch.approvedAt = new Date()
      }
    }
    if (dto.groupId !== undefined) patch.groupId = dto.groupId
    if (dto.seedRank !== undefined) patch.seedRank = dto.seedRank
    if (dto.paidAt !== undefined) patch.paidAt = dto.paidAt ? new Date(dto.paidAt) : null

    const [updated] = await this.db
      .update(registrations)
      .set(patch)
      .where(eq(registrations.id, id))
      .returning()
    return updated
  }

  async remove(id: string, actorUid: string) {
    const reg = await this.findOne(id)
    // Only the registrar or the team director can withdraw; status check stays in admin UI
    const [team] = await this.db.select().from(teams).where(eq(teams.id, reg.teamId))
    const isDirector = team?.directorUid === actorUid
    const isRegistrar = reg.registeredByUid === actorUid
    if (!isDirector && !isRegistrar) {
      // Admin panel may bypass with its own endpoint; keep this conservative
      throw new NotFoundException(`Inscripción ${id} no encontrada`)
    }
    await this.db.delete(registrations).where(eq(registrations.id, id))
    return { id }
  }
}

function isUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'code' in err && (err as { code: string }).code === '23505'
}
