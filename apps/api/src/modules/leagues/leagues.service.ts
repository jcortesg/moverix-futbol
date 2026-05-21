import { Injectable, NotFoundException, ConflictException } from '@nestjs/common'
import { and, eq } from 'drizzle-orm'
import { DatabaseService } from '../../db/database.service'
import { leagues } from '../../db/schema'
import { StorageService } from '../../common/services/storage.service'
import { CreateLeagueDto } from './dto/create-league.dto'
import { UpdateLeagueDto } from './dto/update-league.dto'

@Injectable()
export class LeaguesService {
  constructor(
    private readonly database: DatabaseService,
    private readonly storage: StorageService,
  ) {}

  private get db() {
    return this.database.db
  }

  async create(dto: CreateLeagueDto) {
    const existing = await this.db
      .select({ id: leagues.id })
      .from(leagues)
      .where(and(eq(leagues.organizationId, dto.organizationId), eq(leagues.slug, dto.slug)))

    if (existing.length > 0) {
      throw new ConflictException(`El slug "${dto.slug}" ya existe en esta organización`)
    }

    try {
      const [league] = await this.db.insert(leagues).values(dto).returning()
      return league
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new ConflictException(`El slug "${dto.slug}" ya existe en esta organización`)
      }
      throw err
    }
  }

  async findAll(organizationId: string) {
    return this.db.select().from(leagues).where(eq(leagues.organizationId, organizationId))
  }

  async findOne(id: string) {
    const [league] = await this.db.select().from(leagues).where(eq(leagues.id, id))
    if (!league) throw new NotFoundException(`Liga ${id} no encontrada`)
    return league
  }

  async update(id: string, dto: UpdateLeagueDto) {
    const current = await this.findOne(id)

    if (dto.slug && dto.slug !== current.slug) {
      const existing = await this.db
        .select({ id: leagues.id })
        .from(leagues)
        .where(and(eq(leagues.organizationId, current.organizationId), eq(leagues.slug, dto.slug)))
      if (existing.length > 0) {
        throw new ConflictException(`El slug "${dto.slug}" ya existe en esta organización`)
      }
    }

    try {
      const [updated] = await this.db
        .update(leagues)
        .set({ ...dto, updatedAt: new Date() })
        .where(eq(leagues.id, id))
        .returning()
      return updated
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new ConflictException(`El slug "${dto.slug}" ya existe en esta organización`)
      }
      throw err
    }
  }

  async remove(id: string) {
    await this.findOne(id)
    await this.db.delete(leagues).where(eq(leagues.id, id))
    return { id }
  }

  async uploadLogo(id: string, file: Express.Multer.File) {
    const league = await this.findOne(id)
    if (league.logoUrl) await this.storage.deleteFile(league.logoUrl)
    const logoUrl = await this.storage.uploadLogo(`leagues/${id}`, file)
    const [updated] = await this.db
      .update(leagues)
      .set({ logoUrl, updatedAt: new Date() })
      .where(eq(leagues.id, id))
      .returning()
    return updated
  }

  async uploadBanner(id: string, file: Express.Multer.File) {
    const league = await this.findOne(id)
    if (league.bannerUrl) await this.storage.deleteFile(league.bannerUrl)
    const bannerUrl = await this.storage.uploadBanner(`leagues/${id}`, file)
    const [updated] = await this.db
      .update(leagues)
      .set({ bannerUrl, updatedAt: new Date() })
      .where(eq(leagues.id, id))
      .returning()
    return updated
  }
}

function isUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'code' in err && (err as { code: string }).code === '23505'
}
