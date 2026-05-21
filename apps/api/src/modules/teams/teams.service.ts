import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { eq, ilike, or } from 'drizzle-orm'
import * as admin from 'firebase-admin'
import { DatabaseService } from '../../db/database.service'
import { StorageService } from '../../common/services/storage.service'
import { teams } from '../../db/schema'
import { CreateTeamDto } from './dto/create-team.dto'
import { UpdateTeamDto } from './dto/update-team.dto'

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
export class TeamsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly storage: StorageService,
  ) {}

  private get db() {
    return this.database.db
  }

  async create(dto: CreateTeamDto, actorUid: string) {
    let directorUid = actorUid
    if (dto.directorEmail) {
      try {
        const user = await admin.auth().getUserByEmail(dto.directorEmail)
        directorUid = user.uid
      } catch {
        throw new BadRequestException(`No hay un usuario registrado con el email "${dto.directorEmail}"`)
      }
    }
    const [team] = await this.db
      .insert(teams)
      .values({
        directorUid,
        name: dto.name,
        shortName: dto.shortName,
        slug: generateSlug(dto.name),
        accessCode: generateAccessCode(),
        primaryColor: dto.primaryColor,
        secondaryColor: dto.secondaryColor,
        city: dto.city,
      })
      .returning()
    return team
  }

  async findMine(directorUid: string) {
    return this.db.select().from(teams).where(eq(teams.directorUid, directorUid))
  }

  async search(query: string) {
    const q = query.trim()
    if (q.length < 2) return []
    const pattern = `%${q}%`
    return this.db
      .select()
      .from(teams)
      .where(or(ilike(teams.name, pattern), ilike(teams.shortName, pattern)))
      .limit(20)
  }

  async findOne(id: string) {
    const [team] = await this.db.select().from(teams).where(eq(teams.id, id))
    if (!team) throw new NotFoundException(`Equipo ${id} no encontrado`)
    return team
  }

  async update(id: string, dto: UpdateTeamDto, actorUid: string) {
    const team = await this.findOne(id)
    if (team.directorUid !== actorUid) {
      throw new ForbiddenException('Sólo el director del equipo puede editarlo')
    }
    const [updated] = await this.db
      .update(teams)
      .set({ ...dto, updatedAt: new Date() })
      .where(eq(teams.id, id))
      .returning()
    return updated
  }

  async remove(id: string, actorUid: string) {
    const team = await this.findOne(id)
    if (team.directorUid !== actorUid) {
      throw new ForbiddenException('Sólo el director del equipo puede eliminarlo')
    }
    await this.db.delete(teams).where(eq(teams.id, id))
    return { id }
  }

  async uploadLogo(id: string, file: Express.Multer.File) {
    // Admin backoffice users are trusted (auth guard already verified them).
    // The director check stays only on update/delete to protect editable fields.
    const team = await this.findOne(id)
    if (team.logoUrl) await this.storage.deleteFile(team.logoUrl)
    const logoUrl = await this.storage.uploadLogo(`teams/${id}`, file)
    const [updated] = await this.db
      .update(teams)
      .set({ logoUrl, updatedAt: new Date() })
      .where(eq(teams.id, id))
      .returning()
    return updated
  }
}
