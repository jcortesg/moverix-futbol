import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { and, asc, eq, inArray } from 'drizzle-orm'
import { DatabaseService } from '../../db/database.service'
import {
  bracketSlots,
  editions,
  groups,
  matchdays,
  matches,
  registrations,
} from '../../db/schema'
import { BracketsService } from '../brackets/brackets.service'
import { PlayerStatsService } from '../player-stats/player-stats.service'
import { SocialPostsService } from '../social/social-posts.service'
import { CreateMatchDto } from './dto/create-match.dto'
import { UpdateMatchDto } from './dto/update-match.dto'
import { FinalizeMatchDto } from './dto/finalize-match.dto'
import { GenerateFixtureDto } from './dto/generate-fixture.dto'

type FormatConfigShape = {
  phase1?: { kind?: string; doubleLeg?: boolean }
}

@Injectable()
export class MatchesService {
  private readonly logger = new Logger(MatchesService.name)

  constructor(
    private readonly database: DatabaseService,
    private readonly bracketsService: BracketsService,
    private readonly playerStatsService: PlayerStatsService,
    private readonly socialPostsService: SocialPostsService,
  ) {}

  private get db() {
    return this.database.db
  }

  async create(dto: CreateMatchDto) {
    const [row] = await this.db
      .insert(matches)
      .values({
        matchdayId: dto.matchdayId,
        groupId: dto.groupId,
        homeTeamId: dto.homeTeamId,
        awayTeamId: dto.awayTeamId,
        venueId: dto.venueId,
        refereeId: dto.refereeId,
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : undefined,
        isNeutral: dto.isNeutral,
        round: dto.round,
      })
      .returning()
    return row
  }

  async findByMatchday(matchdayId: string) {
    return this.db.select().from(matches).where(eq(matches.matchdayId, matchdayId))
  }

  /**
   * Find all matches of an edition, joined through matchdays.
   */
  async findByEdition(editionId: string) {
    const result = await this.db
      .select({ match: matches, matchdayNumber: matchdays.number })
      .from(matches)
      .innerJoin(matchdays, eq(matchdays.id, matches.matchdayId))
      .where(eq(matchdays.editionId, editionId))
      .orderBy(asc(matchdays.number))
    return result.map((r) => ({ ...r.match, matchdayNumber: r.matchdayNumber }))
  }

  async findOne(id: string) {
    const [row] = await this.db.select().from(matches).where(eq(matches.id, id))
    if (!row) throw new NotFoundException(`Partido ${id} no encontrado`)
    return row
  }

  async update(id: string, dto: UpdateMatchDto) {
    await this.findOne(id)
    const { scheduledAt, ...rest } = dto
    const [updated] = await this.db
      .update(matches)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .set({
        ...(rest as any),
        ...(scheduledAt !== undefined && {
          scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        }),
        updatedAt: new Date(),
      })
      .where(eq(matches.id, id))
      .returning()
    return updated
  }

  async remove(id: string) {
    await this.findOne(id)
    await this.db.delete(matches).where(eq(matches.id, id))
    return { id }
  }

  async finalize(id: string, dto: FinalizeMatchDto) {
    const match = await this.findOne(id)
    if (!match.homeTeamId || !match.awayTeamId) {
      throw new BadRequestException('El partido no tiene equipos asignados.')
    }
    const [updated] = await this.db
      .update(matches)
      .set({
        status: 'finished',
        homeScore: dto.homeScore,
        awayScore: dto.awayScore,
        homePenalties: dto.homePenalties,
        awayPenalties: dto.awayPenalties,
        finishedAt: match.finishedAt ?? new Date(),
        startedAt: match.startedAt ?? new Date(),
        updatedAt: new Date(),
      })
      .where(eq(matches.id, id))
      .returning()

    // Auto-advance bracket winner if this match belongs to a bracket slot
    try {
      const [slot] = await this.db
        .select()
        .from(bracketSlots)
        .where(eq(bracketSlots.matchId, id))

      if (slot) {
        const hs = dto.homeScore
        const as_ = dto.awayScore
        let winnerId: string | null = null

        if (hs > as_) {
          winnerId = slot.homeTeamId
        } else if (as_ > hs) {
          winnerId = slot.awayTeamId
        } else if (dto.homePenalties != null && dto.awayPenalties != null) {
          winnerId = dto.homePenalties > dto.awayPenalties
            ? slot.homeTeamId
            : slot.awayTeamId
        }

        if (winnerId) {
          await this.bracketsService.advanceWinner(slot.id, winnerId)
        }
      }
    } catch (err) {
      this.logger.warn(`Error advancing bracket winner for match ${id}: ${err}`)
    }

    // Recompute player stats for this match (best-effort)
    try {
      await this.playerStatsService.recomputeMatch(id)
    } catch (err) {
      this.logger.warn(`Error recomputing player stats for match ${id}: ${err}`)
    }

    // Generate match result social post (best-effort)
    try {
      await this.socialPostsService.onMatchFinalized(updated)
    } catch (err) {
      this.logger.warn(`Social post failed for finalized match ${id}: ${err}`)
    }

    return updated
  }

  /**
   * Auto-generate fixture for the edition's group phase using Berger tables.
   * - Reads each group + its approved registrations.
   * - Builds rounds: each team plays every other once (or twice if doubleLeg).
   * - Aligns rounds across groups: Round 1 of every group → Matchday 1, etc.
   */
  async generateFixture(dto: GenerateFixtureDto) {
    const [edition] = await this.db.select().from(editions).where(eq(editions.id, dto.editionId))
    if (!edition) throw new NotFoundException(`Edición ${dto.editionId} no encontrada`)

    const cfg = (edition.formatConfig ?? {}) as FormatConfigShape
    const phase1 = cfg.phase1
    if (!phase1 || phase1.kind !== 'groups') {
      throw new BadRequestException(
        'Solo se soporta generación automática para fase de grupos por ahora.',
      )
    }

    const groupRows = await this.db
      .select()
      .from(groups)
      .where(eq(groups.editionId, dto.editionId))
      .orderBy(asc(groups.order), asc(groups.code))
    if (groupRows.length === 0) {
      throw new BadRequestException('No hay grupos creados. Crea los grupos primero.')
    }

    // Existing matches via matchdays
    const existingMatchdays = await this.db
      .select()
      .from(matchdays)
      .where(eq(matchdays.editionId, dto.editionId))
    if (existingMatchdays.length > 0 && !dto.force) {
      throw new BadRequestException(
        'Ya existe un fixture. Usa force=true para regenerar (borra los partidos actuales).',
      )
    }
    if (existingMatchdays.length > 0 && dto.force) {
      // Delete matches first (CASCADE on matchday will cover but be explicit)
      await this.db.delete(matches).where(
        inArray(matches.matchdayId, existingMatchdays.map((m) => m.id)),
      )
      await this.db.delete(matchdays).where(eq(matchdays.editionId, dto.editionId))
    }

    // Approved registrations per group
    const allApproved = await this.db
      .select()
      .from(registrations)
      .where(and(
        eq(registrations.editionId, dto.editionId),
        eq(registrations.status, 'approved'),
      ))

    // Generate rounds per group
    type GroupRound = {
      groupId: string
      roundNumber: number // 1-indexed
      pairings: { home: string; away: string }[]
    }
    const allRounds: GroupRound[] = []
    let maxRoundNumber = 0

    for (const g of groupRows) {
      const teamIds = allApproved
        .filter((r) => r.groupId === g.id)
        .map((r) => r.teamId)

      if (teamIds.length < 2) continue

      const rounds = bergerRounds(teamIds, phase1.doubleLeg ?? false)
      maxRoundNumber = Math.max(maxRoundNumber, rounds.length)
      rounds.forEach((pairings, idx) => {
        allRounds.push({ groupId: g.id, roundNumber: idx + 1, pairings })
      })
    }

    if (maxRoundNumber === 0) {
      throw new BadRequestException(
        'Ningún grupo tiene 2+ equipos aprobados. Asigna equipos a grupos primero.',
      )
    }

    // Create matchdays (one per round across groups)
    const createdMatchdays: { id: string; number: number }[] = []
    for (let i = 1; i <= maxRoundNumber; i++) {
      const [md] = await this.db.insert(matchdays).values({
        editionId: dto.editionId,
        number: i,
        name: `Jornada ${i}`,
        phase: 'groups',
      }).returning()
      createdMatchdays.push({ id: md.id, number: md.number })
    }

    // Create matches
    let totalMatches = 0
    for (const r of allRounds) {
      const md = createdMatchdays.find((x) => x.number === r.roundNumber)!
      for (const p of r.pairings) {
        await this.db.insert(matches).values({
          matchdayId: md.id,
          groupId: r.groupId,
          homeTeamId: p.home,
          awayTeamId: p.away,
          status: 'scheduled',
          round: `J${r.roundNumber}`,
        })
        totalMatches++
      }
    }

    return {
      matchdays: createdMatchdays.length,
      matches: totalMatches,
      groups: groupRows.length,
    }
  }
}

/**
 * Berger / round-robin pairing algorithm.
 * For an even number of teams (N), produces N-1 rounds with N/2 pairings each.
 * For an odd N, adds a "bye" virtual seat — one team rests per round.
 *
 * Home/away alternation: position 0 alternates home/away each round.
 * If doubleLeg, appends the same rounds with home/away swapped.
 */
function bergerRounds(teamIds: string[], doubleLeg: boolean): { home: string; away: string }[][] {
  const teams = [...teamIds]
  const isOdd = teams.length % 2 === 1
  if (isOdd) teams.push('__bye__')

  const n = teams.length
  const halfN = n / 2
  const rounds: { home: string; away: string }[][] = []

  // Use Berger's circle algorithm:
  // Index 0 is fixed; the rest rotate clockwise each round.
  const fixed = teams[0]
  let rotating = teams.slice(1)

  for (let r = 0; r < n - 1; r++) {
    const round: { home: string; away: string }[] = []

    // Fixed team plays against rotating[0]; alternate home/away to balance
    const opponent = rotating[0]
    if (fixed !== '__bye__' && opponent !== '__bye__') {
      const fixedIsHome = r % 2 === 0
      round.push(
        fixedIsHome ? { home: fixed, away: opponent } : { home: opponent, away: fixed },
      )
    }

    // Remaining pairings: rotating[i] vs rotating[n-1-i] for i=1..halfN-1
    for (let i = 1; i < halfN; i++) {
      const a = rotating[i]
      const b = rotating[rotating.length - i]
      if (a === '__bye__' || b === '__bye__') continue
      // Alternate home/away
      const aIsHome = (r + i) % 2 === 0
      round.push(aIsHome ? { home: a, away: b } : { home: b, away: a })
    }

    rounds.push(round)

    // Rotate clockwise: take last and put it first
    rotating = [rotating[rotating.length - 1], ...rotating.slice(0, -1)]
  }

  if (doubleLeg) {
    const swapped = rounds.map((round) =>
      round.map((p) => ({ home: p.away, away: p.home })),
    )
    return [...rounds, ...swapped]
  }

  return rounds
}
