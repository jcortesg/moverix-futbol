import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { and, asc, eq, sql } from 'drizzle-orm'
import { DatabaseService } from '../../db/database.service'
import { fines, matches, matchdays, matchEvents } from '../../db/schema'
import { PlayerStatsService } from '../player-stats/player-stats.service'
import { SocialPostsService } from '../social/social-posts.service'
import { CreateMatchEventDto } from './dto/create-match-event.dto'
import { UpdateMatchEventDto } from './dto/update-match-event.dto'

// Default amounts for auto-fines per concept. The admin can later override per
// edition (in `editions.fineDefaults` JSONB — not yet exposed in UI).
const DEFAULT_FINE_AMOUNTS = {
  yellow_card_accumulation: 30000,
  red_card: 50000,
} as const

const YELLOW_CARDS_FOR_ACCUMULATION = 3

@Injectable()
export class MatchEventsService {
  private readonly logger = new Logger(MatchEventsService.name)

  constructor(
    private readonly database: DatabaseService,
    private readonly playerStatsService: PlayerStatsService,
    private readonly socialPostsService: SocialPostsService,
  ) {}

  private get db() {
    return this.database.db
  }

  async create(dto: CreateMatchEventDto) {
    let row
    try {
      [row] = await this.db.insert(matchEvents).values(dto).returning()
    } catch (err) {
      if (isUniqueViolation(err) && dto.eventType === 'mvp') {
        throw new ConflictException('Ya hay un MVP asignado a este partido. Bórralo o usa setMvp para reemplazarlo.')
      }
      throw err
    }

    // Auto-fines (best effort) for cards with a known player
    if ((dto.eventType === 'yellow_card' || dto.eventType === 'red_card') && dto.playerUid) {
      try { await this.handleCardFine(dto) } catch { /* non-fatal */ }
    }

    // Recompute player stats (best-effort)
    try { await this.playerStatsService.recomputeMatch(dto.matchId) } catch (err) {
      this.logger.warn(`Stats recompute failed for match ${dto.matchId}: ${err}`)
    }

    // Generate social post (best-effort)
    const POST_WORTHY = ['goal', 'own_goal', 'red_card', 'penalty_scored', 'penalty_missed', 'mvp']
    if (POST_WORTHY.includes(dto.eventType)) {
      try { await this.socialPostsService.onMatchEvent(row) } catch (err) {
        this.logger.warn(`Social post failed for event ${row.id}: ${err}`)
      }
    }

    return row
  }

  /**
   * Creates fines automatically when a card event is registered:
   *  - red_card → fine 'red_card'
   *  - yellow_card with 3+ accumulated across the edition → fine 'yellow_card_accumulation'
   *
   * Idempotent enough: checks existing fines with same matchId+playerUid+concept
   * before inserting (best-effort, no DB constraint).
   */
  private async handleCardFine(dto: CreateMatchEventDto) {
    if (!dto.playerUid) return

    // Resolve editionId via matches → matchdays
    const [matchRow] = await this.db
      .select({ editionId: matchdays.editionId })
      .from(matches)
      .innerJoin(matchdays, eq(matchdays.id, matches.matchdayId))
      .where(eq(matches.id, dto.matchId))
    if (!matchRow) return
    const editionId = matchRow.editionId

    if (dto.eventType === 'red_card') {
      await this.createFineIfMissing({
        editionId,
        teamId: dto.teamId,
        matchId: dto.matchId,
        playerUid: dto.playerUid,
        playerName: dto.playerName,
        concept: 'red_card',
        reason: `Tarjeta roja directa${dto.playerName ? ' a ' + dto.playerName : ''}`,
        amount: DEFAULT_FINE_AMOUNTS.red_card,
        sanction: 'Suspensión 1 partido',
        matchesBanned: 1,
      })
      return
    }

    // yellow_card → check accumulation in this edition
    const [{ count: yellowCount }] = await this.db
      .select({ count: sql<number>`COUNT(*)`.mapWith(Number) })
      .from(matchEvents)
      .innerJoin(matches, eq(matches.id, matchEvents.matchId))
      .innerJoin(matchdays, eq(matchdays.id, matches.matchdayId))
      .where(and(
        eq(matchdays.editionId, editionId),
        eq(matchEvents.playerUid, dto.playerUid),
        eq(matchEvents.eventType, 'yellow_card'),
      ))

    if (yellowCount > 0 && yellowCount % YELLOW_CARDS_FOR_ACCUMULATION === 0) {
      await this.createFineIfMissing({
        editionId,
        teamId: dto.teamId,
        matchId: dto.matchId,
        playerUid: dto.playerUid,
        playerName: dto.playerName,
        concept: 'yellow_card_accumulation',
        reason: `Acumulación de ${YELLOW_CARDS_FOR_ACCUMULATION} amarillas${dto.playerName ? ' (' + dto.playerName + ')' : ''}`,
        amount: DEFAULT_FINE_AMOUNTS.yellow_card_accumulation,
        sanction: 'Suspensión 1 partido',
        matchesBanned: 1,
      })
    }
  }

  private async createFineIfMissing(values: {
    editionId: string
    teamId: string
    matchId: string
    playerUid: string
    playerName?: string
    concept: 'red_card' | 'yellow_card_accumulation'
    reason: string
    amount: number
    sanction: string
    matchesBanned: number
  }) {
    const existing = await this.db
      .select({ id: fines.id })
      .from(fines)
      .where(and(
        eq(fines.matchId, values.matchId),
        eq(fines.playerUid, values.playerUid),
        eq(fines.concept, values.concept),
      ))
    if (existing.length > 0) return
    await this.db.insert(fines).values({
      editionId: values.editionId,
      teamId: values.teamId,
      matchId: values.matchId,
      playerUid: values.playerUid,
      playerName: values.playerName,
      concept: values.concept,
      reason: values.reason,
      amount: values.amount,
      sanction: values.sanction,
      matchesBanned: values.matchesBanned,
    })
  }

  async findByMatch(matchId: string) {
    return this.db
      .select()
      .from(matchEvents)
      .where(eq(matchEvents.matchId, matchId))
      .orderBy(asc(matchEvents.minute), asc(matchEvents.createdAt))
  }

  async findOne(id: string) {
    const [row] = await this.db.select().from(matchEvents).where(eq(matchEvents.id, id))
    if (!row) throw new NotFoundException(`Evento ${id} no encontrado`)
    return row
  }

  async update(id: string, dto: UpdateMatchEventDto) {
    const existing = await this.findOne(id)
    const [updated] = await this.db
      .update(matchEvents)
      .set(dto)
      .where(eq(matchEvents.id, id))
      .returning()

    try { await this.playerStatsService.recomputeMatch(existing.matchId) } catch { /* non-fatal */ }

    return updated
  }

  async remove(id: string) {
    const existing = await this.findOne(id)
    await this.db.delete(matchEvents).where(eq(matchEvents.id, id))

    try { await this.playerStatsService.recomputeMatch(existing.matchId) } catch { /* non-fatal */ }

    return { id }
  }

  /**
   * Sets (or replaces) the MVP of a match. Any existing MVP for the same match
   * is removed first to avoid the unique-index conflict.
   */
  async setMvp(matchId: string, teamId: string, playerUid: string, playerName: string) {
    await this.db.delete(matchEvents).where(and(
      eq(matchEvents.matchId, matchId),
      eq(matchEvents.eventType, 'mvp'),
    ))
    const [row] = await this.db.insert(matchEvents).values({
      matchId,
      teamId,
      eventType: 'mvp',
      playerUid,
      playerName,
    }).returning()
    return row
  }

  async clearMvp(matchId: string) {
    await this.db.delete(matchEvents).where(and(
      eq(matchEvents.matchId, matchId),
      eq(matchEvents.eventType, 'mvp'),
    ))
    return { matchId }
  }
}

function isUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'code' in err && (err as { code: string }).code === '23505'
}
