import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { and, asc, eq, inArray, min } from 'drizzle-orm'
import { DatabaseService } from '../../db/database.service'
import { bracketSlots, editions, matchdays, matches, registrations, teams, venues } from '../../db/schema'
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
  scheduledAt?: string | null
  venueName?: string | null
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

    // Jornada de la primera ronda. Las siguientes se crean al avanzar el cuadro,
    // una por ronda, para que el calendario las liste por separado.
    const firstRoundLabel = roundName(1, totalRounds, qualifiers.length < bracketSize)
    const bracketMatchday = await this.resolveRoundMatchday(
      editionId,
      1,
      cupName === 'main' ? firstRoundLabel : `${firstRoundLabel} ${cupName}`,
    )

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
      const roundLabel = firstRoundLabel
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
   * Carga un cuadro ya sorteado a mano, con los equipos puestos uno por uno.
   *
   * `generate` deduce los cruces de `getQualifiers`, y eso no sirve cuando el
   * sorteo se hizo fuera del sistema: en `groups_multi_cup` las posiciones que
   * usa son las del GRUPO, no las de la reclasificación general, así que el
   * cuadro saldría con otros equipos y en otro orden. Aquí el orden de los
   * pares es el del cuadro, y ese orden decide quién se cruza en la ronda
   * siguiente: los ganadores de los pares 1 y 2 se enfrentan, los de 3 y 4, etc.
   *
   * No toca `generate` ni la siembra clásica: es otro camino, para otro caso.
   */
  async generateManual(
    editionId: string,
    cupName: string,
    matchups: [string, string][],
  ) {
    const [edition] = await this.db.select().from(editions).where(eq(editions.id, editionId))
    if (!edition) throw new NotFoundException(`Edición ${editionId} no encontrada`)

    const existing = await this.db
      .select()
      .from(bracketSlots)
      .where(and(eq(bracketSlots.editionId, editionId), eq(bracketSlots.cupName, cupName)))
    if (existing.length > 0) {
      throw new BadRequestException(
        `Ya existe un bracket "${cupName}" para esta edición. Resetéalo primero si deseas regenerarlo.`,
      )
    }

    if (matchups.length < 1) {
      throw new BadRequestException('El cuadro necesita al menos un cruce.')
    }

    // Un equipo en dos llaves dejaría a otro fuera del torneo, y una vez creado
    // el cuadro eso es difícil de ver: se corta aquí.
    const vistos = new Set<string>()
    for (const [home, away] of matchups) {
      for (const teamId of [home, away]) {
        if (vistos.has(teamId)) {
          throw new BadRequestException(`El equipo ${teamId} aparece en más de un cruce.`)
        }
        vistos.add(teamId)
      }
    }

    // Todos deben estar inscritos y en carrera: un equipo retirado en el cuadro
    // es un partido que nadie va a jugar.
    const inscritos = await this.db
      .select({ teamId: registrations.teamId, status: registrations.status })
      .from(registrations)
      .where(eq(registrations.editionId, editionId))
    const activos = new Map(inscritos.map((r) => [r.teamId, r.status]))

    for (const teamId of vistos) {
      const status = activos.get(teamId)
      if (!status) {
        throw new BadRequestException(`El equipo ${teamId} no está inscrito en esta edición.`)
      }
      if (status === 'rejected' || status === 'withdrawn') {
        throw new BadRequestException(`El equipo ${teamId} está fuera del torneo (${status}).`)
      }
    }

    const bracketSize = nextPowerOf2(matchups.length * 2)
    const totalRounds = Math.log2(bracketSize)

    const slotsByRound = new Map<number, { id: string; slot: number }[]>()

    for (let round = totalRounds; round >= 1; round--) {
      const slotsInRound = bracketSize / Math.pow(2, round)
      const created: { id: string; slot: number }[] = []

      for (let s = 0; s < slotsInRound; s++) {
        const nextRoundSlots = slotsByRound.get(round + 1)
        const nextSlotId = nextRoundSlots
          ? nextRoundSlots[Math.floor(s / 2)]?.id ?? null
          : null

        const pair = round === 1 ? matchups[s] : undefined

        const [row] = await this.db
          .insert(bracketSlots)
          .values({
            editionId,
            cupName,
            round,
            slot: s,
            homeTeamId: pair?.[0] ?? null,
            awayTeamId: pair?.[1] ?? null,
            nextSlotId,
          })
          .returning()
        created.push({ id: row.id, slot: s })
      }
      slotsByRound.set(round, created)
    }

    // El cuadro está completo (todos los lugares tienen equipo), así que no hay
    // byes y la primera ronda lleva su nombre real: 16avos, octavos, etc.
    const firstRoundLabel = roundName(1, totalRounds, false)
    const bracketMatchday = await this.resolveRoundMatchday(
      editionId,
      1,
      cupName === 'main' ? firstRoundLabel : `${firstRoundLabel} ${cupName}`,
    )

    let matchesCreated = 0
    for (const slotInfo of slotsByRound.get(1) ?? []) {
      const [slotRow] = await this.db
        .select()
        .from(bracketSlots)
        .where(eq(bracketSlots.id, slotInfo.id))
      if (!slotRow.homeTeamId || !slotRow.awayTeamId) continue

      const [match] = await this.db
        .insert(matches)
        .values({
          matchdayId: bracketMatchday.id,
          homeTeamId: slotRow.homeTeamId,
          awayTeamId: slotRow.awayTeamId,
          status: 'scheduled',
          round: firstRoundLabel,
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
   * Copa de consolación: un cuadro que se llena con los PERDEDORES de una ronda
   * de otra copa, en vez de con los clasificados de la tabla.
   *
   * Es el formato del Desafío Mundial: se juegan los 16avos y el que gana sigue
   * en Oro mientras el que pierde arranca la Plata. Por eso no comparte camino
   * con `generate`, que siempre parte de `getQualifiers`: aquí los equipos aún
   * no se conocen, y van entrando a medida que se juega la ronda de origen.
   *
   * Nace vacío y se enlaza: cada llave de origen guarda en `loserNextSlotId` la
   * llave de esta copa donde cae su perdedor. Las llaves de origen que ya estén
   * decididas se rellenan de una vez, para poder generar la Plata aunque los
   * 16avos ya se hayan jugado.
   */
  async generateConsolation(
    editionId: string,
    cupName: string,
    sourceCup = 'main',
    sourceRound = 1,
  ) {
    const [edition] = await this.db.select().from(editions).where(eq(editions.id, editionId))
    if (!edition) throw new NotFoundException(`Edición ${editionId} no encontrada`)

    if (cupName === sourceCup) {
      throw new BadRequestException('La copa de consolación debe tener un nombre distinto al de origen.')
    }

    const existing = await this.db
      .select()
      .from(bracketSlots)
      .where(and(eq(bracketSlots.editionId, editionId), eq(bracketSlots.cupName, cupName)))
    if (existing.length > 0) {
      throw new BadRequestException(
        `Ya existe un bracket "${cupName}" para esta edición. Resetéalo primero si deseas regenerarlo.`,
      )
    }

    const sourceSlots = await this.db
      .select()
      .from(bracketSlots)
      .where(and(
        eq(bracketSlots.editionId, editionId),
        eq(bracketSlots.cupName, sourceCup),
        eq(bracketSlots.round, sourceRound),
      ))
      .orderBy(asc(bracketSlots.slot))

    if (sourceSlots.length < 2) {
      throw new BadRequestException(
        `La ronda ${sourceRound} de "${sourceCup}" tiene ${sourceSlots.length} llave(s). Se necesitan al menos 2 para armar una copa de consolación.`,
      )
    }

    const alreadyLinked = sourceSlots.filter((s) => s.loserNextSlotId !== null)
    if (alreadyLinked.length > 0) {
      throw new BadRequestException(
        `Esa ronda ya envía sus perdedores a otra copa. Resetea esa copa antes de crear una nueva.`,
      )
    }

    // Un bye no produce perdedor: esa llave de la copa nueva se quedaría con un
    // solo equipo. No se bloquea (el organizador puede resolverlo a mano), pero
    // se informa para que no sea una sorpresa a mitad del torneo.
    const byesInSource = sourceSlots.filter(
      (s) => (s.homeTeamId && !s.awayTeamId) || (!s.homeTeamId && s.awayTeamId),
    ).length

    // Un perdedor por llave de origen: 16 llaves de 16avos → cuadro de 16.
    const bracketSize = nextPowerOf2(sourceSlots.length)
    const totalRounds = Math.log2(bracketSize)

    // Mismo armado que `generate`, de la final hacia atrás, pero sin equipos:
    // aquí nadie está clasificado todavía.
    const slotsByRound = new Map<number, { id: string; slot: number }[]>()

    for (let round = totalRounds; round >= 1; round--) {
      const slotsInRound = bracketSize / Math.pow(2, round)
      const created: { id: string; slot: number }[] = []

      for (let s = 0; s < slotsInRound; s++) {
        const nextRoundSlots = slotsByRound.get(round + 1)
        const nextSlotId = nextRoundSlots
          ? nextRoundSlots[Math.floor(s / 2)]?.id ?? null
          : null

        const [row] = await this.db
          .insert(bracketSlots)
          .values({ editionId, cupName, round, slot: s, nextSlotId })
          .returning()
        created.push({ id: row.id, slot: s })
      }
      slotsByRound.set(round, created)
    }

    // Enlace origen → consolación. Se usa la misma regla que para el ganador
    // (llave par entra como local, impar como visitante) para que los dos
    // perdedores de un mismo par se crucen entre sí.
    const firstRound = slotsByRound.get(1) ?? []
    for (const src of sourceSlots) {
      const target = firstRound[Math.floor(src.slot / 2)]
      if (!target) continue
      await this.db
        .update(bracketSlots)
        .set({ loserNextSlotId: target.id, updatedAt: new Date() })
        .where(eq(bracketSlots.id, src.id))
    }

    // Llaves de origen ya jugadas: se baja su perdedor ahora mismo.
    let backfilled = 0
    for (const src of sourceSlots) {
      if (!src.winnerId) continue
      const loserId = src.homeTeamId === src.winnerId ? src.awayTeamId : src.homeTeamId
      if (!loserId) continue
      const target = firstRound[Math.floor(src.slot / 2)]
      if (!target) continue
      await this.placeLoser(target.id, loserId, src.slot % 2 === 0, editionId, cupName)
      backfilled++
    }

    return {
      cupName,
      sourceCup,
      sourceRound,
      bracketSize,
      rounds: totalRounds,
      slotsCreated: Array.from(slotsByRound.values()).reduce((a, b) => a + b.length, 0),
      linkedSlots: sourceSlots.length,
      backfilled,
      byesInSource,
    }
  }

  /**
   * Coloca al perdedor en su llave de la copa de consolación y, si ya están los
   * dos, crea el partido. Aparte de `advanceWinner` porque el perdedor entra a
   * OTRA copa, cuyo total de rondas y etiquetas son los suyos.
   */
  private async placeLoser(
    targetSlotId: string,
    loserId: string,
    asHome: boolean,
    editionId: string,
    cupName: string,
  ) {
    await this.db
      .update(bracketSlots)
      .set({
        ...(asHome ? { homeTeamId: loserId } : { awayTeamId: loserId }),
        updatedAt: new Date(),
      })
      .where(eq(bracketSlots.id, targetSlotId))

    const [refreshed] = await this.db
      .select()
      .from(bracketSlots)
      .where(eq(bracketSlots.id, targetSlotId))
    if (!refreshed?.homeTeamId || !refreshed.awayTeamId || refreshed.matchId) return

    const totalRounds = await this.getTotalRounds(editionId, cupName)
    const label = roundName(refreshed.round, totalRounds, false)
    const md = await this.resolveRoundMatchday(editionId, refreshed.round, `${label} ${cupName}`)
    if (!md) return

    const [match] = await this.db
      .insert(matches)
      .values({
        matchdayId: md.id,
        homeTeamId: refreshed.homeTeamId,
        awayTeamId: refreshed.awayTeamId,
        status: 'scheduled',
        round: `${label} ${cupName}`,
      })
      .returning()

    await this.db
      .update(bracketSlots)
      .set({ matchId: match.id, updatedAt: new Date() })
      .where(eq(bracketSlots.id, refreshed.id))
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

    // Copa de consolación: el perdedor baja al otro cuadro en vez de quedar
    // eliminado. Solo corre si la llave tiene destino; sin él (todas las que ya
    // existen) el comportamiento es el de siempre.
    if (slot.loserNextSlotId) {
      const loserId = slot.homeTeamId === winnerId ? slot.awayTeamId : slot.homeTeamId
      if (loserId) {
        const [target] = await this.db
          .select()
          .from(bracketSlots)
          .where(eq(bracketSlots.id, slot.loserNextSlotId))
        if (target) {
          await this.placeLoser(
            target.id,
            loserId,
            slot.slot % 2 === 0,
            slot.editionId,
            target.cupName,
          )
        }
      }
    }

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
      const totalRounds = await this.getTotalRounds(slot.editionId, slot.cupName)
      const hasByes = await this.firstRoundHasByes(slot.editionId, slot.cupName)
      const label = roundName(refreshed.round, totalRounds, hasByes)

      // Cada ronda tiene su propia jornada (Repechaje, Octavos, …): así el
      // calendario del admin las separa en vez de amontonarlas en una sola.
      const md = await this.resolveRoundMatchday(slot.editionId, refreshed.round, label)

      if (md) {
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
   * Jornada de una ronda eliminatoria. Si no existe, la crea. Cada ronda tiene
   * la suya para que el calendario muestre "Repechaje", "Octavos", etc. por
   * separado en vez de un único bloque con todo adentro.
   */
  private async resolveRoundMatchday(editionId: string, round: number, label: string) {
    const [existing] = await this.db
      .select()
      .from(matchdays)
      .where(and(
        eq(matchdays.editionId, editionId),
        eq(matchdays.phase, 'knockout'),
        eq(matchdays.name, label),
      ))
    if (existing) return existing

    const [created] = await this.db
      .insert(matchdays)
      .values({ editionId, number: 900 + round, name: label, phase: 'knockout' })
      .returning()
    return created
  }

  /** ¿La primera ronda tiene byes? Determina si se llama Repechaje. */
  private async firstRoundHasByes(editionId: string, cupName: string) {
    const rows = await this.db
      .select({ home: bracketSlots.homeTeamId, away: bracketSlots.awayTeamId })
      .from(bracketSlots)
      .where(and(
        eq(bracketSlots.editionId, editionId),
        eq(bracketSlots.cupName, cupName),
        eq(bracketSlots.round, 1),
      ))
    return rows.some((r) => !r.home || !r.away)
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
          // Programación: el admin muestra el fixture sobre el mismo cuadro.
          enrichedSlot.scheduledAt = m.scheduledAt ? m.scheduledAt.toISOString() : null
          if (m.venueId) {
            const [v] = await this.db.select().from(venues).where(eq(venues.id, m.venueId))
            enrichedSlot.venueName = v?.name ?? null
          }
        }
      }

      enriched.push(enrichedSlot)
    }

    return enriched
  }

  /**
   * List all cups that have bracket slots for an edition.
   */
  /**
   * Copas de la edición en orden estable: la principal primero y las demás por
   * fecha de creación. El orden importa porque de él sale la letra de cada copa
   * (ver cupLabels): sin ORDER BY Postgres las devolvía en cualquier orden.
   */
  async getCups(editionId: string): Promise<string[]> {
    const rows = await this.db
      .select({ cupName: bracketSlots.cupName, createdAt: min(bracketSlots.createdAt) })
      .from(bracketSlots)
      .where(eq(bracketSlots.editionId, editionId))
      .groupBy(bracketSlots.cupName)

    return rows
      .sort((a, b) => {
        if (a.cupName === 'main') return -1
        if (b.cupName === 'main') return 1
        return new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime()
      })
      .map((r) => r.cupName)
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

    // Si esta copa recibía perdedores de otra, soltar el enlace: si no, las
    // llaves de origen quedarían apuntando a slots ya borrados. Sin copa de
    // consolación no hay nada que soltar y este paso no hace nada.
    const slotIds = slots.map((s) => s.id)
    if (slotIds.length > 0) {
      await this.db
        .update(bracketSlots)
        .set({ loserNextSlotId: null, updatedAt: new Date() })
        .where(inArray(bracketSlots.loserNextSlotId, slotIds))
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

/**
 * Nombre visible de cada copa, en el orden de getCups: Copa A, Copa B, …
 * Internamente la consolación se llama como la escribió el organizador
 * ("plata"), pero él la anuncia como Copa B. Se sirve desde la API para poder
 * renombrarlas sin recompilar la app.
 */
export function cupLabels(cups: string[]): Record<string, string> {
  return Object.fromEntries(cups.map((c, i) => [c, `Copa ${String.fromCharCode(65 + i)}`]))
}

/**
 * Nombre de la ronda. Cuando el cuadro no está completo, la primera ronda es
 * un repechaje: solo la juegan los peor clasificados y el resto pasa directo,
 * así que llamarla "16avos" confunde a los equipos.
 */
function roundName(round: number, totalRounds: number, hasByes = false): string {
  if (round === 1 && hasByes) return 'Repechaje'
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
