import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { and, asc, eq, inArray } from 'drizzle-orm'
import { DatabaseService } from '../../db/database.service'
import { bracketSlots, editions, matchdays, matches, teams } from '../../db/schema'
import { StandingsService, type Qualifier } from '../standings/standings.service'

export type BracketSlotRow = typeof bracketSlots.$inferSelect & {
  homeTeamName?: string | null
  awayTeamName?: string | null
  homeTeamLogoUrl?: string | null
  awayTeamLogoUrl?: string | null
  homeScore?: number | null
  awayScore?: number | null
  homePenalties?: number | null
  awayPenalties?: number | null
  matchStatus?: string | null
}

@Injectable()
export class BracketsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly standingsService: StandingsService,
  ) {}

  private get db() {
    return this.database.db
  }

  /**
   * Generate bracket slots + first-round matches from qualifiers.
   * Classic seeding: 1v16, 8v9, 4v13, 5v12, 2v15, 7v10, 3v14, 6v11
   */
  async generate(editionId: string, cupName = 'main') {
    const [edition] = await this.db.select().from(editions).where(eq(editions.id, editionId))
    if (!edition) throw new NotFoundException(`Edición ${editionId} no encontrada`)

    // Check no existing bracket for this cup
    const existing = await this.db
      .select()
      .from(bracketSlots)
      .where(and(eq(bracketSlots.editionId, editionId), eq(bracketSlots.cupName, cupName)))
    if (existing.length > 0) {
      throw new BadRequestException(
        `Ya existe un bracket "${cupName}" para esta edición. Resetéalo primero si deseas regenerar.`,
      )
    }

    // Get qualifiers from standings
    const qualifiersResult = await this.standingsService.getQualifiers(editionId)
    let qualifiers: Qualifier[]

    if (cupName === 'main') {
      qualifiers = qualifiersResult.qualifiers.filter((q) => q.destination === 'main')
    } else {
      const cupDest = 'cup_' + cupName.toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 30)
      qualifiers = qualifiersResult.qualifiers.filter((q) => q.destination === cupDest)
    }

    if (qualifiers.length < 2) {
      throw new BadRequestException(
        `Se necesitan al menos 2 clasificados para generar el bracket "${cupName}". Hay ${qualifiers.length}.`,
      )
    }

    // Determine bracket size (next power of 2 >= qualifiers)
    const bracketSize = nextPowerOf2(qualifiers.length)
    const totalRounds = Math.log2(bracketSize)

    // Build seeded matchups for the first round
    const firstRoundPairings = classicSeeding(bracketSize)

    // Map seeds to teams (seeds beyond qualifiers.length are byes)
    const teamBySeed = new Map<number, Qualifier>()
    for (const q of qualifiers) {
      teamBySeed.set(q.seed, q)
    }

    // Create all bracket slots (all rounds)
    // Round 1 = first round, round totalRounds = final
    const slotsByRound = new Map<number, { id: string; slot: number }[]>()

    for (let round = totalRounds; round >= 1; round--) {
      const slotsInRound = bracketSize / Math.pow(2, round)
      const created: { id: string; slot: number }[] = []

      for (let s = 0; s < slotsInRound; s++) {
        const nextRoundSlots = slotsByRound.get(round + 1)
        const nextSlotId = nextRoundSlots
          ? nextRoundSlots[Math.floor(s / 2)]?.id ?? null
          : null

        let homeTeamId: string | null = null
        let awayTeamId: string | null = null

        if (round === 1) {
          const pairing = firstRoundPairings[s]
          const home = teamBySeed.get(pairing.seedA)
          const away = teamBySeed.get(pairing.seedB)
          homeTeamId = home?.teamId ?? null
          awayTeamId = away?.teamId ?? null
        }

        const [row] = await this.db
          .insert(bracketSlots)
          .values({
            editionId,
            cupName,
            round,
            slot: s,
            homeTeamId,
            awayTeamId,
            nextSlotId,
          })
          .returning()
        created.push({ id: row.id, slot: s })
      }
      slotsByRound.set(round, created)
    }

    // Create a matchday for the bracket phase
    const [bracketMatchday] = await this.db
      .insert(matchdays)
      .values({
        editionId,
        number: 900 + (cupName === 'main' ? 0 : cupName.charCodeAt(0)),
        name: cupName === 'main' ? 'Fase eliminatoria' : `Eliminatoria ${cupName}`,
        phase: 'knockout',
      })
      .returning()

    // Create matches for first round (skip byes — auto-advance)
    const firstRoundSlots = slotsByRound.get(1) ?? []
    let matchesCreated = 0

    for (const slotInfo of firstRoundSlots) {
      const [slotRow] = await this.db
        .select()
        .from(bracketSlots)
        .where(eq(bracketSlots.id, slotInfo.id))

      if (!slotRow.homeTeamId && !slotRow.awayTeamId) continue // empty slot

      if (slotRow.homeTeamId && !slotRow.awayTeamId) {
        // Bye: home advances automatically
        await this.advanceWinner(slotRow.id, slotRow.homeTeamId)
        continue
      }
      if (!slotRow.homeTeamId && slotRow.awayTeamId) {
        // Bye: away advances
        await this.advanceWinner(slotRow.id, slotRow.awayTeamId)
        continue
      }

      // Both teams present — create match
      const roundLabel = roundName(1, totalRounds)
      const [match] = await this.db
        .insert(matches)
        .values({
          matchdayId: bracketMatchday.id,
          homeTeamId: slotRow.homeTeamId,
          awayTeamId: slotRow.awayTeamId,
          status: 'scheduled',
          round: roundLabel,
        })
        .returning()

      await this.db
        .update(bracketSlots)
        .set({ matchId: match.id, updatedAt: new Date() })
        .where(eq(bracketSlots.id, slotRow.id))

      matchesCreated++
    }

    return {
      cupName,
      bracketSize,
      rounds: totalRounds,
      slotsCreated: Array.from(slotsByRound.values()).reduce((a, b) => a + b.length, 0),
      matchesCreated,
      matchdayId: bracketMatchday.id,
    }
  }

  /**
   * Advance winner from a slot to the next round.
   * If the next round slot now has both teams, create the match.
   */
  async advanceWinner(slotId: string, winnerId: string) {
    const [slot] = await this.db.select().from(bracketSlots).where(eq(bracketSlots.id, slotId))
    if (!slot) throw new NotFoundException(`Bracket slot ${slotId} no encontrado`)

    // Set winner on current slot
    await this.db
      .update(bracketSlots)
      .set({ winnerId, updatedAt: new Date() })
      .where(eq(bracketSlots.id, slotId))

    if (!slot.nextSlotId) return // final — no next slot

    // Place winner in next slot
    const [nextSlot] = await this.db.select().from(bracketSlots).where(eq(bracketSlots.id, slot.nextSlotId))
    if (!nextSlot) return

    // Determine if winner goes to home or away position
    // Even slot index → home, odd → away
    const isHome = slot.slot % 2 === 0
    await this.db
      .update(bracketSlots)
      .set({
        ...(isHome ? { homeTeamId: winnerId } : { awayTeamId: winnerId }),
        updatedAt: new Date(),
      })
      .where(eq(bracketSlots.id, nextSlot.id))

    // Refresh next slot to check if both teams are now set
    const [refreshed] = await this.db.select().from(bracketSlots).where(eq(bracketSlots.id, nextSlot.id))
    if (refreshed.homeTeamId && refreshed.awayTeamId && !refreshed.matchId) {
      // Both teams ready — create match
      // Find the bracket matchday for this edition
      const [md] = await this.db
        .select()
        .from(matchdays)
        .where(and(
          eq(matchdays.editionId, slot.editionId),
          eq(matchdays.phase, 'knockout'),
        ))

      if (md) {
        const totalRounds = await this.getTotalRounds(slot.editionId, slot.cupName)
        const label = roundName(refreshed.round, totalRounds)

        const [match] = await this.db
          .insert(matches)
          .values({
            matchdayId: md.id,
            homeTeamId: refreshed.homeTeamId,
            awayTeamId: refreshed.awayTeamId,
            status: 'scheduled',
            round: label,
          })
          .returning()

        await this.db
          .update(bracketSlots)
          .set({ matchId: match.id, updatedAt: new Date() })
          .where(eq(bracketSlots.id, refreshed.id))
      }
    }
  }

  /**
   * Get the full bracket structure for an edition + cup.
   */
  async getByEdition(editionId: string, cupName = 'main'): Promise<BracketSlotRow[]> {
    const rows = await this.db
      .select()
      .from(bracketSlots)
      .where(and(
        eq(bracketSlots.editionId, editionId),
        eq(bracketSlots.cupName, cupName),
      ))
      .orderBy(asc(bracketSlots.round), asc(bracketSlots.slot))

    if (rows.length === 0) return []

    // Enrich with team names and match scores
    const enriched: BracketSlotRow[] = []

    for (const slot of rows) {
      const enrichedSlot: BracketSlotRow = { ...slot }

      if (slot.homeTeamId) {
        const [t] = await this.db.select().from(teams).where(eq(teams.id, slot.homeTeamId))
        if (t) { enrichedSlot.homeTeamName = t.name; enrichedSlot.homeTeamLogoUrl = t.logoUrl }
      }
      if (slot.awayTeamId) {
        const [t] = await this.db.select().from(teams).where(eq(teams.id, slot.awayTeamId))
        if (t) { enrichedSlot.awayTeamName = t.name; enrichedSlot.awayTeamLogoUrl = t.logoUrl }
      }
      if (slot.matchId) {
        const [m] = await this.db.select().from(matches).where(eq(matches.id, slot.matchId))
        if (m) {
          enrichedSlot.homeScore = m.homeScore
          enrichedSlot.awayScore = m.awayScore
          enrichedSlot.homePenalties = m.homePenalties
          enrichedSlot.awayPenalties = m.awayPenalties
          enrichedSlot.matchStatus = m.status
        }
      }

      enriched.push(enrichedSlot)
    }

    return enriched
  }

  /**
   * List all cups that have bracket slots for an edition.
   */
  async getCups(editionId: string): Promise<string[]> {
    const rows = await this.db
      .select({ cupName: bracketSlots.cupName })
      .from(bracketSlots)
      .where(eq(bracketSlots.editionId, editionId))

    return [...new Set(rows.map((r) => r.cupName))]
  }

  /**
   * Reset (delete) all bracket slots + associated knockout matches for a cup.
   */
  async reset(editionId: string, cupName = 'main') {
    const slots = await this.db
      .select()
      .from(bracketSlots)
      .where(and(eq(bracketSlots.editionId, editionId), eq(bracketSlots.cupName, cupName)))

    if (slots.length === 0) {
      throw new NotFoundException(`No hay bracket "${cupName}" para esta edición.`)
    }

    // Delete associated matches
    const matchIds = slots.map((s) => s.matchId).filter(Boolean) as string[]
    if (matchIds.length > 0) {
      await this.db.delete(matches).where(inArray(matches.id, matchIds))
    }

    // Delete bracket slots
    await this.db
      .delete(bracketSlots)
      .where(and(eq(bracketSlots.editionId, editionId), eq(bracketSlots.cupName, cupName)))

    // Delete knockout matchday if no more bracket slots exist for the edition
    const remaining = await this.db
      .select()
      .from(bracketSlots)
      .where(eq(bracketSlots.editionId, editionId))
    if (remaining.length === 0) {
      await this.db
        .delete(matchdays)
        .where(and(eq(matchdays.editionId, editionId), eq(matchdays.phase, 'knockout')))
    }

    return { deleted: slots.length }
  }

  private async getTotalRounds(editionId: string, cupName: string): Promise<number> {
    const rows = await this.db
      .select({ round: bracketSlots.round })
      .from(bracketSlots)
      .where(and(eq(bracketSlots.editionId, editionId), eq(bracketSlots.cupName, cupName)))
    if (rows.length === 0) return 0
    return Math.max(...rows.map((r) => r.round))
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function nextPowerOf2(n: number): number {
  let p = 1
  while (p < n) p *= 2
  return p
}

/**
 * Classic tournament seeding for a bracket of size N.
 * Returns N/2 pairings: [{seedA, seedB}, ...] ordered so that
 * seed 1 and 2 can only meet in the final.
 *
 * For bracket of 8: (1v8, 4v5, 3v6, 2v7)
 */
function classicSeeding(bracketSize: number): { seedA: number; seedB: number }[] {
  // Recursive: for a bracket of 2, it's just [1, 2].
  // For larger brackets, split into top half and bottom half
  // so that seed 1 is in the top and seed 2 is in the bottom.
  function buildOrder(size: number): number[] {
    if (size === 1) return [1]
    const half = buildOrder(size / 2)
    const result: number[] = []
    for (const seed of half) {
      result.push(seed)
      result.push(size + 1 - seed)
    }
    return result
  }

  const order = buildOrder(bracketSize)
  const pairings: { seedA: number; seedB: number }[] = []
  for (let i = 0; i < order.length; i += 2) {
    pairings.push({ seedA: order[i], seedB: order[i + 1] })
  }
  return pairings
}

function roundName(round: number, totalRounds: number): string {
  const fromFinal = totalRounds - round
  switch (fromFinal) {
    case 0: return 'Final'
    case 1: return 'Semifinales'
    case 2: return 'Cuartos'
    case 3: return 'Octavos'
    case 4: return '16avos'
    case 5: return '32avos'
    default: return `Ronda ${round}`
  }
}
