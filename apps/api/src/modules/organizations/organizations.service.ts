import { Injectable, NotFoundException } from '@nestjs/common'
import { eq } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { DatabaseService } from '../../db/database.service'
import { organizations } from '../../db/schema'
import { StorageService } from '../../common/services/storage.service'
import { CreateOrganizationDto } from './dto/create-organization.dto'
import { UpdateOrganizationDto } from './dto/update-organization.dto'

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly storage: StorageService,
  ) {}

  private get db() {
    return this.database.db
  }

  async create(dto: CreateOrganizationDto, ownerUid: string) {
    const id = randomUUID()
    const slug = `${this.toSlug(dto.name)}-${id.slice(0, 8)}`

    const [org] = await this.db
      .insert(organizations)
      .values({ id, name: dto.name, city: dto.city, slug, ownerUid })
      .returning()

    return org
  }

  private toSlug(name: string): string {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60)
  }

  async findAll(ownerUid: string) {
    return this.db
      .select()
      .from(organizations)
      .where(eq(organizations.ownerUid, ownerUid))
  }

  async findOne(id: string) {
    const [org] = await this.db
      .select()
      .from(organizations)
      .where(eq(organizations.id, id))

    if (!org) throw new NotFoundException(`Organización ${id} no encontrada`)
    return org
  }

  async update(id: string, dto: UpdateOrganizationDto) {
    await this.findOne(id)

    const [updated] = await this.db
      .update(organizations)
      .set({ ...dto, updatedAt: new Date() })
      .where(eq(organizations.id, id))
      .returning()

    return updated
  }

  async remove(id: string) {
    await this.findOne(id)
    await this.db.delete(organizations).where(eq(organizations.id, id))
    return { id }
  }

  async uploadLogo(id: string, file: Express.Multer.File) {
    const org = await this.findOne(id)

    if (org.logoUrl) {
      await this.storage.deleteFile(org.logoUrl)
    }

    const logoUrl = await this.storage.uploadLogo(`organizations/${id}`, file)

    const [updated] = await this.db
      .update(organizations)
      .set({ logoUrl, updatedAt: new Date() })
      .where(eq(organizations.id, id))
      .returning()

    return updated
  }
}
