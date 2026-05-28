import { Injectable, NotFoundException } from '@nestjs/common'
import { eq } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { DatabaseService } from '../../db/database.service'
import { organizations, organizationMembers } from '../../db/schema'
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

    // Add creator as owner member
    await this.db.insert(organizationMembers).values({
      organizationId: id,
      uid: ownerUid,
      role: 'owner',
    })

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

  async findAll(uid: string) {
    return this.db
      .select({
        id: organizations.id,
        name: organizations.name,
        slug: organizations.slug,
        logoUrl: organizations.logoUrl,
        city: organizations.city,
        country: organizations.country,
        ownerUid: organizations.ownerUid,
        active: organizations.active,
        createdAt: organizations.createdAt,
        updatedAt: organizations.updatedAt,
      })
      .from(organizations)
      .innerJoin(
        organizationMembers,
        eq(organizationMembers.organizationId, organizations.id),
      )
      .where(eq(organizationMembers.uid, uid))
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

  async getMembers(organizationId: string) {
    return this.db
      .select()
      .from(organizationMembers)
      .where(eq(organizationMembers.organizationId, organizationId))
  }

  async addMember(organizationId: string, uid: string, role: string) {
    const [member] = await this.db
      .insert(organizationMembers)
      .values({ organizationId, uid, role })
      .onConflictDoNothing()
      .returning()
    return member
  }

  async removeMember(_organizationId: string, memberId: string) {
    await this.db
      .delete(organizationMembers)
      .where(eq(organizationMembers.id, memberId))
    return { id: memberId }
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
