import { Injectable, NotFoundException, ConflictException } from '@nestjs/common'
import { and, eq } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { DatabaseService } from '../../db/database.service'
import { StorageService } from '../../common/services/storage.service'
import { editions } from '../../db/schema'
import { CreateEditionDto } from './dto/create-edition.dto'
import { UpdateEditionDto } from './dto/update-edition.dto'

@Injectable()
export class EditionsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly storage: StorageService,
  ) {}

  private get db() {
    return this.database.db
  }

  async create(dto: CreateEditionDto) {
    const existing = await this.db
      .select({ id: editions.id })
      .from(editions)
      .where(and(eq(editions.leagueId, dto.leagueId), eq(editions.season, dto.season)))
    if (existing.length > 0) {
      throw new ConflictException(`La temporada "${dto.season}" ya existe en esta liga`)
    }

    try {
      const id = randomUUID()
      const slug = `${this.toSlug(dto.name)}-${id.slice(0, 8)}`

      const [edition] = await this.db
        .insert(editions)
        .values({
          id,
          slug,
          leagueId: dto.leagueId,
          name: dto.name,
          season: dto.season,
          formatConfig: dto.formatConfig,
          tiebreakerRules: dto.tiebreakerRules,
          maxTeams: dto.maxTeams,
          registrationFee: dto.registrationFee,
          prizePool: dto.prizePool,
          currency: dto.currency,
          rulesUrl: dto.rulesUrl,
          startDate: dto.startDate ? new Date(dto.startDate) : undefined,
          endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        })
        .returning()
      return edition
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new ConflictException(`La temporada "${dto.season}" ya existe en esta liga`)
      }
      throw err
    }
  }

  async findAll(leagueId: string) {
    return this.db.select().from(editions).where(eq(editions.leagueId, leagueId))
  }

  async findOne(id: string) {
    const [edition] = await this.db.select().from(editions).where(eq(editions.id, id))
    if (!edition) throw new NotFoundException(`Edición ${id} no encontrada`)
    return edition
  }

  async update(id: string, dto: UpdateEditionDto) {
    const current = await this.findOne(id)
    const { startDate, endDate, ...rest } = dto

    if (dto.season && dto.season !== current.season) {
      const existing = await this.db
        .select({ id: editions.id })
        .from(editions)
        .where(and(eq(editions.leagueId, current.leagueId), eq(editions.season, dto.season)))
      if (existing.length > 0) {
        throw new ConflictException(`La temporada "${dto.season}" ya existe en esta liga`)
      }
    }

    try {
      const [updated] = await this.db
        .update(editions)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .set({
          ...(rest as any),
          ...(startDate !== undefined && { startDate: startDate ? new Date(startDate) : null }),
          ...(endDate !== undefined && { endDate: endDate ? new Date(endDate) : null }),
          updatedAt: new Date(),
        })
        .where(eq(editions.id, id))
        .returning()
      return updated
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new ConflictException(`La temporada "${dto.season}" ya existe en esta liga`)
      }
      throw err
    }
  }

  private toSlug(name: string): string {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60)
  }

  async remove(id: string) {
    await this.findOne(id)
    await this.db.delete(editions).where(eq(editions.id, id))
    return { id }
  }

  async uploadLogo(id: string, file: Express.Multer.File) {
    const edition = await this.findOne(id)
    if (edition.logoUrl) await this.storage.deleteFile(edition.logoUrl)
    const logoUrl = await this.storage.uploadLogo(`editions/${id}`, file)
    const [updated] = await this.db
      .update(editions)
      .set({ logoUrl, updatedAt: new Date() })
      .where(eq(editions.id, id))
      .returning()
    return updated
  }

  async uploadBanner(id: string, file: Express.Multer.File) {
    const edition = await this.findOne(id)
    if (edition.bannerUrl) await this.storage.deleteFile(edition.bannerUrl)
    const bannerUrl = await this.storage.uploadBanner(`editions/${id}`, file)
    const [updated] = await this.db
      .update(editions)
      .set({ bannerUrl, updatedAt: new Date() })
      .where(eq(editions.id, id))
      .returning()
    return updated
  }
}

function isUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'code' in err && (err as { code: string }).code === '23505'
}
