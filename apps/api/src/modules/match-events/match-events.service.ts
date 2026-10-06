import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { and, asc, eq, sql } from 'drizzle-orm'
import { DatabaseService } from '../../db/database.service'
import { editions, fines, matches, matchdays, matchEvents } from '../../db/schema'
import { PlayerStatsService } from '../player-stats/player-stats.service'
import { SocialPostsService } from '../social/social-posts.service'
import { CreateMatchEventDto } from './dto/create-match-event.dto'
import { UpdateMatchEventDto } from './dto/update-match-event.dto'

/**
 * Valores de multas cuando la edición no define los suyos.
 * El organizador los configura por torneo en `editions.fine_defaults`.
 */
const DEFAULT_FINE_AMOUNTS = {
  // Amarilla suelta y acumulacion arrancan en 0 = NO generan multa hasta que
  // el organizador les ponga precio. Asi ningun torneo existente empieza a
  // cobrar de golpe por un cambio de codigo.
  yellow_card: 0,
  yellow_card_accumulation: 0,
  red_card: 50000,
} as const

const YELLOW_CARDS_FOR_ACCUMULATION = 3

/** Config de multas de una edición, ya resuelta contra los valores por defecto. */
interface FineConfig {
  redCard: number
  /** Multa por CADA amarilla, independiente de la acumulacion. */
  yellowCard: number
  yellowAccumulation: number
  yellowsForAccumulation: number
  redCardMatchesBanned: number
  yellowAccumulationMatchesBanned: number
  /** Texto libre de la sanción; si no se define, se arma con los partidos. */
  redCardSanction?: string
  yellowAccumulationSanction?: string
}

/** Texto de sanción: el custom del torneo o el automático por partidos. */
function sanctionText(custom: string | undefined, banned: number): string | null {
  const t = (custom ?? '').trim()
  if (t) return t.slice(0, 160)
  return banned > 0 ? `Suspensión ${banned} partido${banned === 1 ? '' : 's'}` : null
}

/** Texto no vacío, o undefined. */
function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() ? v.trim() : undefined
}

/** Número válido y no negativo, o undefined para caer al default. */
function num(v: unknown): number | undefined {
  const n = typeof v === 'string' ? Number(v) : (v as number)
  return typeof n === 'number' && Number.isFinite(n) && n >= 0 ? n : undefined
}

function resolveFineConfig(raw: unknown): FineConfig {
  const c = (raw ?? {}) as Record<string, unknown>
  return {
    redCard: num(c.redCard) ?? DEFAULT_FINE_AMOUNTS.red_card,
    yellowCard: num(c.yellowCard) ?? DEFAULT_FINE_AMOUNTS.yellow_card,
    yellowAccumulation:
      num(c.yellowAccumulation) ?? DEFAULT_FINE_AMOUNTS.yellow_card_accumulation,
    // Debe ser >= 1: un 0 haría que CADA amarilla generara multa (division por
    // cero en el modulo) y dejaria el torneo lleno de sanciones.
    yellowsForAccumulation:
      Math.max(1, Math.trunc(num(c.yellowsForAccumulation) ?? YELLOW_CARDS_FOR_ACCUMULATION)),
    redCardMatchesBanned: Math.trunc(num(c.redCardMatchesBanned) ?? 1),
    yellowAccumulationMatchesBanned: Math.trunc(
      num(c.yellowAccumulationMatchesBanned) ?? 1,
    ),
    redCardSanction: str(c.redCardSanction),
    yellowAccumulationSanction: str(c.yellowAccumulationSanction),
  }
}

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

    // Resolve editionId via matches → matchdays, junto con la config de multas
    // que el organizador definió para ESTE torneo.
    const [matchRow] = await this.db
      .select({ editionId: matchdays.editionId, fineDefaults: editions.fineDefaults })
      .from(matches)
      .innerJoin(matchdays, eq(matchdays.id, matches.matchdayId))
      .innerJoin(editions, eq(editions.id, matchdays.editionId))
      .where(eq(matches.id, dto.matchId))
    if (!matchRow) return
    const editionId = matchRow.editionId
    const cfg = resolveFineConfig(matchRow.fineDefaults)

    if (dto.eventType === 'red_card') {
      const banned = cfg.redCardMatchesBanned
      await this.createFineIfMissing({
        editionId,
        teamId: dto.teamId,
        matchId: dto.matchId,
        playerUid: dto.playerUid,
        playerName: dto.playerName,
        concept: 'red_card',
        reason: `Tarjeta roja directa${dto.playerName ? ' a ' + dto.playerName : ''}`,
        amount: cfg.redCard,
        sanction: sanctionText(cfg.redCardSanction, banned),
        matchesBanned: banned,
      })
      return
    }

    // Multa por la amarilla EN SI (independiente de la acumulación).
    if (cfg.yellowCard > 0) {
      await this.createFineIfMissing({
        editionId,
        teamId: dto.teamId,
        matchId: dto.matchId,
        playerUid: dto.playerUid,
        playerName: dto.playerName,
        concept: 'yellow_card',
        reason: `Tarjeta amarilla${dto.playerName ? ' a ' + dto.playerName : ''}`,
        amount: cfg.yellowCard,
        sanction: null,
        matchesBanned: 0,
      })
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

    const hitsAccumulation =
      yellowCount > 0 && yellowCount % cfg.yellowsForAccumulation === 0
    const accBanned = cfg.yellowAccumulationMatchesBanned
    // Con multa 0 y sin suspension no hay nada que registrar.
    if (hitsAccumulation && (cfg.yellowAccumulation > 0 || accBanned > 0)) {
      const banned = accBanned
      await this.createFineIfMissing({
        editionId,
        teamId: dto.teamId,
        matchId: dto.matchId,
        playerUid: dto.playerUid,
        playerName: dto.playerName,
        concept: 'yellow_card_accumulation',
        reason: `Acumulación de ${cfg.yellowsForAccumulation} amarillas${dto.playerName ? ' (' + dto.playerName + ')' : ''}`,
        amount: cfg.yellowAccumulation,
        sanction: sanctionText(cfg.yellowAccumulationSanction, banned),
        matchesBanned: banned,
      })
    }
  }

  private async createFineIfMissing(values: {
    editionId: string
    teamId: string
    matchId: string
    playerUid: string
    playerName?: string
    concept: 'red_card' | 'yellow_card' | 'yellow_card_accumulation'
    reason: string
    amount: number
    sanction: string | null
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

    // Si el partido ya estaba cerrado, la tarjeta resumen del feed quedo con
    // el gol que se acaba de borrar: hay que reescribirla.
    try { await this.socialPostsService.onMatchEventRemoved(existing.matchId) } catch (err) {
      this.logger.warn(`Social summary refresh failed for match ${existing.matchId}: ${err}`)
    }

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
