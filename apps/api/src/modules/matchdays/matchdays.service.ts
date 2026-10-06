import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { asc, eq, inArray } from 'drizzle-orm'
import { DatabaseService } from '../../db/database.service'
import { matchdays, matches, matchEvents } from '../../db/schema'
import { CreateMatchdayDto } from './dto/create-matchday.dto'
import { UpdateMatchdayDto } from './dto/update-matchday.dto'

@Injectable()
export class MatchdaysService {
  constructor(private readonly database: DatabaseService) {}

  private get db() {
    return this.database.db
  }

  async create(dto: CreateMatchdayDto) {
    const [row] = await this.db.insert(matchdays).values({
      editionId: dto.editionId,
      number: dto.number,
      name: dto.name ?? `Jornada ${dto.number}`,
      phase: dto.phase ?? 'groups',
      scheduledDate: dto.scheduledDate ? new Date(dto.scheduledDate) : undefined,
    }).returning()
    return row
  }

  async findByEdition(editionId: string) {
    return this.db
      .select()
      .from(matchdays)
      .where(eq(matchdays.editionId, editionId))
      .orderBy(asc(matchdays.number))
  }

  async findOne(id: string) {
    const [row] = await this.db.select().from(matchdays).where(eq(matchdays.id, id))
    if (!row) throw new NotFoundException(`Jornada ${id} no encontrada`)
    return row
  }

  async update(id: string, dto: UpdateMatchdayDto) {
    await this.findOne(id)
    const { scheduledDate, ...rest } = dto
    const [updated] = await this.db
      .update(matchdays)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .set({
        ...(rest as any),
        ...(scheduledDate !== undefined && {
          scheduledDate: scheduledDate ? new Date(scheduledDate) : null,
        }),
      })
      .where(eq(matchdays.id, id))
      .returning()
    return updated
  }

  /**
   * Borrar una jornada arrastra en cascada sus partidos y, con ellos, todos los
   * goles, tarjetas y sustituciones. Solo se permite cuando ningún partido de la
   * jornada llegó a jugarse; para el resto hay que mover o cancelar los partidos
   * primero.
   */
  async remove(id: string) {
    await this.findOne(id)

    const rows = await this.db
      .select({ id: matches.id, status: matches.status, homeScore: matches.homeScore })
      .from(matches)
      .where(eq(matches.matchdayId, id))

    const PLAYED: string[] = ['finished', 'live', 'walkover']
    const played = rows.filter((m) => PLAYED.includes(m.status) || m.homeScore != null)

    if (played.length) {
      throw new BadRequestException(
        `Esta jornada tiene ${played.length} partido(s) ya jugados. Muévelos a otra jornada o cancélalos antes de eliminarla.`,
      )
    }

    if (rows.length) {
      const withEvents = await this.db
        .select({ matchId: matchEvents.matchId })
        .from(matchEvents)
        .where(inArray(matchEvents.matchId, rows.map((m) => m.id)))
        .limit(1)

      if (withEvents.length) {
        throw new BadRequestException(
          'Esta jornada tiene partidos con eventos registrados. Muévelos a otra jornada antes de eliminarla.',
        )
      }
    }

    await this.db.delete(matchdays).where(eq(matchdays.id, id))
    return { id }
  }
}
