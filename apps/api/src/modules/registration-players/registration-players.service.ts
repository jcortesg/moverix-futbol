import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { asc, eq } from 'drizzle-orm'
import { DatabaseService } from '../../db/database.service'
import { registrationPlayers } from '../../db/schema'
import { CreateRegistrationPlayerDto } from './dto/create-registration-player.dto'
import { UpdateRegistrationPlayerDto } from './dto/update-registration-player.dto'

@Injectable()
export class RegistrationPlayersService {
  constructor(private readonly database: DatabaseService) {}

  private get db() {
    return this.database.db
  }

  async create(dto: CreateRegistrationPlayerDto) {
    try {
      const [row] = await this.db.insert(registrationPlayers).values(dto).returning()
      return row
    } catch (err) {
      throw mapUniqueViolation(err, dto.email, dto.docNumber)
    }
  }

  async findByRegistration(registrationId: string) {
    return this.db
      .select()
      .from(registrationPlayers)
      .where(eq(registrationPlayers.registrationId, registrationId))
      .orderBy(asc(registrationPlayers.jerseyNumber), asc(registrationPlayers.playerName))
  }

  async findOne(id: string) {
    const [row] = await this.db.select().from(registrationPlayers).where(eq(registrationPlayers.id, id))
    if (!row) throw new NotFoundException(`Jugador ${id} no encontrado`)
    return row
  }

  async update(id: string, dto: UpdateRegistrationPlayerDto) {
    await this.findOne(id)
    try {
      const [updated] = await this.db
        .update(registrationPlayers)
        .set(dto)
        .where(eq(registrationPlayers.id, id))
        .returning()
      return updated
    } catch (err) {
      throw mapUniqueViolation(err, dto.email, dto.docNumber)
    }
  }

  async remove(id: string) {
    await this.findOne(id)
    await this.db.delete(registrationPlayers).where(eq(registrationPlayers.id, id))
    return { id }
  }
}

function isUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'code' in err && (err as { code: string }).code === '23505'
}

function mapUniqueViolation(err: unknown, email?: string, doc?: string): Error {
  if (!isUniqueViolation(err)) return err as Error
  const constraint = (err as { constraint?: string }).constraint ?? ''
  if (constraint.includes('email')) {
    return new ConflictException(`Ya hay un jugador con el email "${email}" en este equipo`)
  }
  if (constraint.includes('doc')) {
    return new ConflictException(`Ya hay un jugador con la cédula "${doc}" en este equipo`)
  }
  return new ConflictException('Este jugador ya está en la plantilla de este equipo')
}
