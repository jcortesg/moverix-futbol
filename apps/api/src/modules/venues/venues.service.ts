import { Injectable, NotFoundException } from '@nestjs/common'
import { asc, eq } from 'drizzle-orm'
import { DatabaseService } from '../../db/database.service'
import { StorageService } from '../../common/services/storage.service'
import { venues } from '../../db/schema'
import { CreateVenueDto } from './dto/create-venue.dto'
import { UpdateVenueDto } from './dto/update-venue.dto'

@Injectable()
export class VenuesService {
  constructor(
    private readonly database: DatabaseService,
    private readonly storage: StorageService,
  ) {}

  private get db() {
    return this.database.db
  }

  async create(dto: CreateVenueDto) {
    const [row] = await this.db.insert(venues).values(dto).returning()
    return row
  }

  async findAll(organizationId: string) {
    return this.db
      .select()
      .from(venues)
      .where(eq(venues.organizationId, organizationId))
      .orderBy(asc(venues.name))
  }

  async findOne(id: string) {
    const [row] = await this.db.select().from(venues).where(eq(venues.id, id))
    if (!row) throw new NotFoundException(`Cancha ${id} no encontrada`)
    return row
  }

  async update(id: string, dto: UpdateVenueDto) {
    await this.findOne(id)
    const [updated] = await this.db
      .update(venues)
      .set({ ...dto, updatedAt: new Date() })
      .where(eq(venues.id, id))
      .returning()
    return updated
  }

  async remove(id: string) {
    const venue = await this.findOne(id)
    if (venue.photoUrl) await this.storage.deleteFile(venue.photoUrl)
    await this.db.delete(venues).where(eq(venues.id, id))
    return { id }
  }

  async uploadPhoto(id: string, file: Express.Multer.File) {
    const venue = await this.findOne(id)
    if (venue.photoUrl) await this.storage.deleteFile(venue.photoUrl)
    const photoUrl = await this.storage.uploadLogo(`venues/${id}`, file)
    const [updated] = await this.db
      .update(venues)
      .set({ photoUrl, updatedAt: new Date() })
      .where(eq(venues.id, id))
      .returning()
    return updated
  }
}
