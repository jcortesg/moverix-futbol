import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import * as admin from 'firebase-admin'
import { and, asc, count, eq, inArray, ne } from 'drizzle-orm'
import { DatabaseService } from '../../db/database.service'
import {
  bracketSlots,
  editions,
  groups,
  matchdays,
  matches,
  matchDelegates,
  matchEvents,
  referees,
  registrations,
  teams,
} from '../../db/schema'
import { BracketsService } from '../brackets/brackets.service'
import { PlayerStatsService } from '../player-stats/player-stats.service'
import { SocialPostsService } from '../social/social-posts.service'
import { MobileNotificationsService } from '../mobile/mobile-notifications.service'
import { CreateMatchDto } from './dto/create-match.dto'
import { UpdateMatchDto } from './dto/update-match.dto'
import { FinalizeMatchDto } from './dto/finalize-match.dto'
import { GenerateFixtureDto } from './dto/generate-fixture.dto'

import { normalizeFormatConfig, findPhase } from '../../common/utils/format-config'

/**
 * Zona horaria en la que se muestran las horas de partido en los textos que
 * genera el servidor (notificaciones). Cloud Run corre en UTC, asi que sin
 * esto los horarios salen corridos 5 horas.
 */
const MATCH_TIME_ZONE = process.env.MATCH_TIME_ZONE ?? 'America/Bogota'

@Injectable()
export class MatchesService {
  private readonly logger = new Logger(MatchesService.name)

  constructor(
    private readonly database: DatabaseService,
    private readonly bracketsService: BracketsService,
    private readonly playerStatsService: PlayerStatsService,
    private readonly socialPostsService: SocialPostsService,
    private readonly notifications: MobileNotificationsService,
  ) {}

  /** Nombres de dos equipos por id (para los textos de notificación). */
  private async teamNames(homeId: string | null, awayId: string | null) {
    const ids = [homeId, awayId].filter(Boolean) as string[]
    if (!ids.length) return { home: 'Local', away: 'Visitante' }
    const rows = await this.db.select({ id: teams.id, name: teams.name }).from(teams).where(inArray(teams.id, ids))
    const byId = new Map(rows.map((r) => [r.id, r.name]))
    return { home: byId.get(homeId ?? '') ?? 'Local', away: byId.get(awayId ?? '') ?? 'Visitante' }
  }

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

    await this.syncRefereeAsDelegate(row.id, dto.refereeId)

    // Notificar a ambos equipos que tienen partido programado (best-effort).
    try {
      const { home, away } = await this.teamNames(row.homeTeamId, row.awayTeamId)
      // OJO: el servidor corre en UTC. Sin timeZone explicito, toLocaleString
      // formatea la hora UTC y la notificacion muestra 11:30 en vez de 06:30.
      const when = row.scheduledAt
        ? new Date(row.scheduledAt).toLocaleString('es-CO', {
            timeZone: MATCH_TIME_ZONE,
            weekday: 'short',
            day: '2-digit',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
          })
        : null
      const payload = {
        type: 'match' as const,
        title: 'Nuevo partido programado',
        body: `${home} vs ${away}${when ? ` · ${when}` : ''}`,
        data: { kind: 'match', matchId: row.id },
      }
      if (row.homeTeamId) await this.notifications.notifyTeam(row.homeTeamId, payload)
      if (row.awayTeamId) await this.notifications.notifyTeam(row.awayTeamId, payload)
    } catch (err) {
      this.logger.warn(`notify create match: ${err}`)
    }
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

  /**
   * Si el partido tiene arbitro asignado y esa persona tiene correo, se agrega
   * tambien a la terna (match_delegates) para que pueda dirigir desde la web.
   * Best-effort: nunca bloquea la edicion del partido.
   */
  private async syncRefereeAsDelegate(matchId: string, refereeId: string | null | undefined) {
    if (!refereeId) return
    try {
      const [ref] = await this.db
        .select({ fullName: referees.fullName, email: referees.email })
        .from(referees)
        .where(eq(referees.id, refereeId))
      if (!ref?.email) return

      const email = ref.email.trim().toLowerCase()
      let uid: string | null = null
      try {
        uid = (await admin.auth().getUserByEmail(email)).uid
      } catch {
        // Aun no tiene cuenta: queda pendiente y se vincula al registrarse.
      }

      await this.db
        .insert(matchDelegates)
        .values({
          matchId,
          uid,
          pendingEmail: uid ? null : email,
          invitedName: ref.fullName,
          // Se registra como delegado: es quien lleva la planilla en cancha.
          // El puesto en la terna se ajusta desde el panel si hace falta.
          role: 'delegate',
        })
        .onConflictDoNothing()
    } catch (err) {
      this.logger.warn(`sync referee as delegate: ${err}`)
    }
  }

  async update(id: string, dto: UpdateMatchDto) {
    const current = await this.findOne(id)

    // Mover de jornada exige validar antes: una vez movido, la tabla y el
    // calendario se recalculan sobre la jornada nueva.
    let roundPatch: { round: string } | null = null
    if (dto.matchdayId && dto.matchdayId !== current.matchdayId) {
      roundPatch = await this.assertMatchdayMove(current, dto.matchdayId)
    }

    const { scheduledAt, ...rest } = dto
    const [updated] = await this.db
      .update(matches)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .set({
        ...(rest as any),
        ...(scheduledAt !== undefined && {
          scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        }),
        // `round` es texto copiado del nombre de la jornada: al mover, se
        // actualiza o quedaría mostrando la jornada anterior.
        ...(roundPatch ?? {}),
        updatedAt: new Date(),
      })
      .where(eq(matches.id, id))
      .returning()

    if (dto.refereeId !== undefined) {
      await this.syncRefereeAsDelegate(id, dto.refereeId)
    }
    return updated
  }

  /**
   * Valida que el partido pueda pasar a `targetMatchdayId` y devuelve el `round`
   * que le corresponde en la jornada destino.
   */
  private async assertMatchdayMove(
    current: { id: string; matchdayId: string; homeTeamId: string | null; awayTeamId: string | null; status: string },
    targetMatchdayId: string,
  ) {
    const [origin] = await this.db
      .select({ editionId: matchdays.editionId })
      .from(matchdays)
      .where(eq(matchdays.id, current.matchdayId))

    const [target] = await this.db
      .select({ editionId: matchdays.editionId, number: matchdays.number, name: matchdays.name })
      .from(matchdays)
      .where(eq(matchdays.id, targetMatchdayId))

    if (!target) throw new NotFoundException('La jornada destino no existe.')

    // Mover entre ediciones rompería la tabla de posiciones de ambas.
    if (origin && target.editionId !== origin.editionId) {
      throw new BadRequestException('No puedes mover un partido a la jornada de otro campeonato.')
    }

    // Un equipo no puede jugar dos veces en la misma jornada.
    const teamIds = [current.homeTeamId, current.awayTeamId].filter((t): t is string => !!t)
    if (teamIds.length) {
      const rivals = await this.db
        .select({ homeTeamId: matches.homeTeamId, awayTeamId: matches.awayTeamId })
        .from(matches)
        .where(and(eq(matches.matchdayId, targetMatchdayId), ne(matches.id, current.id)))

      const busy = new Set(rivals.flatMap((r) => [r.homeTeamId, r.awayTeamId]).filter(Boolean))
      const clash = teamIds.find((t) => busy.has(t))
      if (clash) {
        const [team] = await this.db
          .select({ name: teams.name })
          .from(teams)
          .where(eq(teams.id, clash))
        throw new BadRequestException(
          `${team?.name ?? 'Un equipo'} ya tiene un partido en esa jornada.`,
        )
      }
    }

    return { round: target.name ?? `Jornada ${target.number}` }
  }

  /**
   * Borrar un partido con historial destruye sus goles, tarjetas y sustituciones
   * (match_events cuelga en cascada) y deja multas huérfanas. Por eso solo se
   * permite borrar los que nunca se jugaron: para el resto está `cancelled`,
   * que conserva la fila y sus eventos pero lo saca de la tabla de posiciones.
   */
  async remove(id: string) {
    const match = await this.findOne(id)

    const PLAYED: string[] = ['finished', 'live', 'walkover']
    if (PLAYED.includes(match.status)) {
      throw new BadRequestException(
        'Este partido ya se jugó y no se puede eliminar. Cámbialo a "Cancelado" o "Aplazado": conserva el registro y sale de la tabla de posiciones.',
      )
    }

    if (match.homeScore != null || match.awayScore != null) {
      throw new BadRequestException(
        'Este partido tiene resultado registrado y no se puede eliminar. Cámbialo a "Cancelado" para conservar el historial.',
      )
    }

    const [{ total }] = await this.db
      .select({ total: count() })
      .from(matchEvents)
      .where(eq(matchEvents.matchId, id))

    if (Number(total) > 0) {
      throw new BadRequestException(
        `Este partido tiene ${total} evento(s) registrados (goles, tarjetas o cambios) y no se puede eliminar. Cámbialo a "Cancelado" para conservarlos.`,
      )
    }

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

    // Notificar el resultado final a ambos equipos (best-effort).
    try {
      const { home, away } = await this.teamNames(updated.homeTeamId, updated.awayTeamId)
      const payload = {
        type: 'result' as const,
        title: 'Resultado final',
        body: `${home} ${updated.homeScore} - ${updated.awayScore} ${away}`,
        data: { kind: 'match', matchId: updated.id },
      }
      if (updated.homeTeamId) await this.notifications.notifyTeam(updated.homeTeamId, payload)
      if (updated.awayTeamId) await this.notifications.notifyTeam(updated.awayTeamId, payload)
    } catch (err) {
      this.logger.warn(`notify finalize match: ${err}`)
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

    const cfg = normalizeFormatConfig(edition.formatConfig as Record<string, unknown>)
    const groupsPhase = findPhase(cfg.phases, 'groups')
    if (!groupsPhase) {
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
      // Nunca regenerar si ya hay partidos jugados: se perderían resultados,
      // match_events y player_stats. El organizador debe gestionar a mano.
      const [played] = await this.db
        .select({ id: matches.id })
        .from(matches)
        .where(and(
          inArray(matches.matchdayId, existingMatchdays.map((m) => m.id)),
          // Un W.O. también deja resultado, y un partido en vivo se perdería a medias.
          inArray(matches.status, ['finished', 'live', 'walkover']),
        ))
        .limit(1)
      if (played) {
        throw new BadRequestException(
          'Hay partidos ya jugados en este torneo. No se puede regenerar el fixture (se perderían los resultados). Gestiona las jornadas manualmente.',
        )
      }
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

      const rounds = bergerRounds(teamIds, (groupsPhase.doubleLeg as boolean) ?? false)
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
