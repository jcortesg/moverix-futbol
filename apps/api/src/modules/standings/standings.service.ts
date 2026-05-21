import { Injectable, NotFoundException } from '@nestjs/common'
import { and, asc, eq } from 'drizzle-orm'
import { DatabaseService } from '../../db/database.service'
import {
  editions,
  groups,
  matchdays,
  matches,
  matchEvents,
  registrations,
  teams,
} from '../../db/schema'

export type TiebreakerCriterion =
  | 'points' | 'goalDiff' | 'goalsFor' | 'goalsAgainst'
  | 'headToHead' | 'yellowCards' | 'redCards' | 'drawLots'

type TiebreakerRules = {
  winPts: number
  drawPts: number
  lossPts: number
  allowDraw: boolean
  order: TiebreakerCriterion[]
}

const DEFAULT_TB: TiebreakerRules = {
  winPts: 3, drawPts: 1, lossPts: 0, allowDraw: true,
  order: ['points', 'goalDiff', 'goalsFor', 'headToHead', 'yellowCards'],
}

export type StandingRow = {
  position: number
  teamId: string
  teamName: string
  teamShortName: string | null
  teamLogoUrl: string | null
  teamPrimaryColor: string | null
  played: number
  wins: number
  draws: number
  losses: number
  goalsFor: number
  goalsAgainst: number
  goalDiff: number
  points: number
  yellowCards: number
  redCards: number
}

export type StandingGroup = {
  groupId: string | null
  groupName: string
  groupCode: string | null
  qualifiersPerGroup: number | null
  rows: StandingRow[]
}

export type QualifierType =
  | 'groups_knockout'
  | 'groups_multi_cup'
  | 'round_robin_playoffs'
  | 'none'

export type Qualifier = {
  teamId: string
  teamName: string
  teamShortName: string | null
  teamLogoUrl: string | null
  teamPrimaryColor: string | null
  groupId: string | null
  groupCode: string | null
  groupPosition: number
  seed: number
  destination: string
  destinationLabel: string
}

export type QualifiersResult = {
  type: QualifierType
  bracketSize: number | null
  qualifiers: Qualifier[]
  totalSlots: number
  reason?: string
}

type FormatConfigShape = {
  type?: string
  phase1?: { kind?: string; qualifiersPerGroup?: number }
  phase2?:
    | { kind?: 'knockout'; bracketSize?: number; hasRepechage?: boolean; hasThirdPlace?: boolean }
    | { kind?: 'multi_cup'; cups?: { name: string; from: number; to: number; size: number }[] }
}

@Injectable()
export class StandingsService {
  constructor(private readonly database: DatabaseService) {}

  private get db() {
    return this.database.db
  }

  async getForEdition(editionId: string): Promise<StandingGroup[]> {
    const [edition] = await this.db.select().from(editions).where(eq(editions.id, editionId))
    if (!edition) throw new NotFoundException(`Edición ${editionId} no encontrada`)

    const tb: TiebreakerRules = (edition.tiebreakerRules as TiebreakerRules | null) ?? DEFAULT_TB
    const formatConfig = (edition.formatConfig ?? {}) as { phase1?: { qualifiersPerGroup?: number } }
    const qualifiers = formatConfig.phase1?.qualifiersPerGroup ?? null

    // Load groups, registrations (with team info), and finished matches
    const [groupRows, regRows, matchRows] = await Promise.all([
      this.db.select().from(groups).where(eq(groups.editionId, editionId))
        .orderBy(asc(groups.order), asc(groups.code)),
      this.db
        .select({
          id: registrations.id,
          teamId: registrations.teamId,
          groupId: registrations.groupId,
          status: registrations.status,
          team: {
            id: teams.id,
            name: teams.name,
            shortName: teams.shortName,
            logoUrl: teams.logoUrl,
            primaryColor: teams.primaryColor,
          },
        })
        .from(registrations)
        .innerJoin(teams, eq(teams.id, registrations.teamId))
        .where(and(
          eq(registrations.editionId, editionId),
          eq(registrations.status, 'approved'),
        )),
      this.db
        .select({ match: matches })
        .from(matches)
        .innerJoin(matchdays, eq(matchdays.id, matches.matchdayId))
        .where(and(
          eq(matchdays.editionId, editionId),
          eq(matches.status, 'finished'),
        )),
    ])

    const finishedMatches = matchRows.map((r) => r.match)

    // Load match events for finished matches (for fair-play stats)
    const finishedIds = finishedMatches.map((m) => m.id)
    const eventRows = finishedIds.length > 0
      ? await this.db
          .select({
            matchId: matchEvents.matchId,
            teamId: matchEvents.teamId,
            eventType: matchEvents.eventType,
          })
          .from(matchEvents)
      : []

    // Aggregate yellow/red counts per (matchId, teamId)
    type CardCount = { yellow: number; red: number }
    const cardsByTeamMatch = new Map<string, CardCount>()
    function cardKey(matchId: string, teamId: string) { return `${matchId}::${teamId}` }
    const finishedIdSet = new Set(finishedIds)
    for (const ev of eventRows) {
      if (!finishedIdSet.has(ev.matchId)) continue
      if (ev.eventType !== 'yellow_card' && ev.eventType !== 'red_card') continue
      const k = cardKey(ev.matchId, ev.teamId)
      const c = cardsByTeamMatch.get(k) ?? { yellow: 0, red: 0 }
      if (ev.eventType === 'yellow_card') c.yellow++
      else c.red++
      cardsByTeamMatch.set(k, c)
    }

    // Build a stat row per (groupId, teamId)
    const stats = new Map<string, StandingRow>()
    function key(groupId: string | null, teamId: string) {
      return `${groupId ?? '-'}::${teamId}`
    }

    // Seed with all approved registrations so teams w/o matches still appear
    for (const reg of regRows) {
      const k = key(reg.groupId, reg.teamId)
      stats.set(k, {
        position: 0,
        teamId: reg.teamId,
        teamName: reg.team.name,
        teamShortName: reg.team.shortName,
        teamLogoUrl: reg.team.logoUrl,
        teamPrimaryColor: reg.team.primaryColor,
        played: 0, wins: 0, draws: 0, losses: 0,
        goalsFor: 0, goalsAgainst: 0, goalDiff: 0, points: 0,
        yellowCards: 0, redCards: 0,
      })
    }

    // Apply finished matches
    for (const m of finishedMatches) {
      if (!m.homeTeamId || !m.awayTeamId) continue
      const hs = m.homeScore ?? 0
      const as = m.awayScore ?? 0

      const homeKey = key(m.groupId, m.homeTeamId)
      const awayKey = key(m.groupId, m.awayTeamId)
      const home = stats.get(homeKey)
      const away = stats.get(awayKey)

      const homeCards = cardsByTeamMatch.get(cardKey(m.id, m.homeTeamId)) ?? { yellow: 0, red: 0 }
      const awayCards = cardsByTeamMatch.get(cardKey(m.id, m.awayTeamId)) ?? { yellow: 0, red: 0 }

      if (home) {
        home.played++
        home.goalsFor += hs
        home.goalsAgainst += as
        home.goalDiff = home.goalsFor - home.goalsAgainst
        home.yellowCards += homeCards.yellow
        home.redCards += homeCards.red
        if (hs > as) { home.wins++; home.points += tb.winPts }
        else if (hs < as) { home.losses++; home.points += tb.lossPts }
        else { home.draws++; home.points += tb.drawPts }
      }
      if (away) {
        away.played++
        away.goalsFor += as
        away.goalsAgainst += hs
        away.goalDiff = away.goalsFor - away.goalsAgainst
        away.yellowCards += awayCards.yellow
        away.redCards += awayCards.red
        if (as > hs) { away.wins++; away.points += tb.winPts }
        else if (as < hs) { away.losses++; away.points += tb.lossPts }
        else { away.draws++; away.points += tb.drawPts }
      }
    }

    // Group by groupId
    const buckets = new Map<string | null, StandingRow[]>()
    for (const row of stats.values()) {
      // Reverse-lookup the groupId from the registration
      const reg = regRows.find((r) => r.teamId === row.teamId)
      const gid = reg?.groupId ?? null
      if (!buckets.has(gid)) buckets.set(gid, [])
      buckets.get(gid)!.push(row)
    }

    // Sort each bucket by tiebreaker order, then assign positions
    const headToHeadCache = new Map<string, Map<string, number>>()

    function getHeadToHead(groupId: string | null, teamIds: string[]): Map<string, number> {
      const cacheKey = `${groupId ?? '-'}::${teamIds.sort().join(',')}`
      if (headToHeadCache.has(cacheKey)) return headToHeadCache.get(cacheKey)!

      const points = new Map<string, number>()
      teamIds.forEach((id) => points.set(id, 0))
      const set = new Set(teamIds)
      for (const m of finishedMatches) {
        if (m.groupId !== groupId) continue
        if (!m.homeTeamId || !m.awayTeamId) continue
        if (!set.has(m.homeTeamId) || !set.has(m.awayTeamId)) continue
        const hs = m.homeScore ?? 0
        const as = m.awayScore ?? 0
        if (hs > as) points.set(m.homeTeamId, (points.get(m.homeTeamId) ?? 0) + tb.winPts)
        else if (as > hs) points.set(m.awayTeamId, (points.get(m.awayTeamId) ?? 0) + tb.winPts)
        else {
          points.set(m.homeTeamId, (points.get(m.homeTeamId) ?? 0) + tb.drawPts)
          points.set(m.awayTeamId, (points.get(m.awayTeamId) ?? 0) + tb.drawPts)
        }
      }
      headToHeadCache.set(cacheKey, points)
      return points
    }

    function compareByCriterion(a: StandingRow, b: StandingRow, c: TiebreakerCriterion, h2h: Map<string, number> | null): number {
      switch (c) {
        case 'points':       return b.points - a.points
        case 'goalDiff':     return b.goalDiff - a.goalDiff
        case 'goalsFor':     return b.goalsFor - a.goalsFor
        case 'goalsAgainst': return a.goalsAgainst - b.goalsAgainst // less is better
        case 'yellowCards':  return a.yellowCards - b.yellowCards
        case 'redCards':     return a.redCards - b.redCards
        case 'headToHead':
          if (!h2h) return 0
          return (h2h.get(b.teamId) ?? 0) - (h2h.get(a.teamId) ?? 0)
        case 'drawLots':     return 0
      }
    }

    function sortBucket(groupId: string | null, rows: StandingRow[]) {
      // First pass with all ordering criteria except head-to-head
      rows.sort((a, b) => {
        for (const c of tb.order) {
          if (c === 'headToHead') continue
          const r = compareByCriterion(a, b, c, null)
          if (r !== 0) return r
        }
        return a.teamName.localeCompare(b.teamName)
      })

      // If head-to-head is in the order, resolve ties by recomputing within tied subgroups.
      const h2hIdx = tb.order.indexOf('headToHead')
      if (h2hIdx >= 0) {
        // Find consecutive runs of teams that are tied on every criterion before h2h.
        const before = tb.order.slice(0, h2hIdx)
        const after = tb.order.slice(h2hIdx + 1)
        const isTied = (a: StandingRow, b: StandingRow) =>
          before.every((c) => compareByCriterion(a, b, c, null) === 0)

        let i = 0
        while (i < rows.length) {
          let j = i + 1
          while (j < rows.length && isTied(rows[i], rows[j])) j++
          if (j - i > 1) {
            const tied = rows.slice(i, j)
            const h2h = getHeadToHead(groupId, tied.map((r) => r.teamId))
            tied.sort((a, b) => {
              const r = compareByCriterion(a, b, 'headToHead', h2h)
              if (r !== 0) return r
              for (const c of after) {
                const r2 = compareByCriterion(a, b, c, null)
                if (r2 !== 0) return r2
              }
              return a.teamName.localeCompare(b.teamName)
            })
            rows.splice(i, j - i, ...tied)
          }
          i = j
        }
      }

      rows.forEach((r, idx) => { r.position = idx + 1 })
    }

    // Build response
    const result: StandingGroup[] = []

    if (groupRows.length === 0) {
      // No groups — single bucket
      const rows = buckets.get(null) ?? []
      sortBucket(null, rows)
      result.push({
        groupId: null,
        groupName: 'General',
        groupCode: null,
        qualifiersPerGroup: qualifiers,
        rows,
      })
    } else {
      for (const g of groupRows) {
        const rows = buckets.get(g.id) ?? []
        sortBucket(g.id, rows)
        result.push({
          groupId: g.id,
          groupName: g.name,
          groupCode: g.code,
          qualifiersPerGroup: qualifiers,
          rows,
        })
      }
      // Also include unassigned approved teams if any
      const unassigned = buckets.get(null)
      if (unassigned && unassigned.length > 0) {
        sortBucket(null, unassigned)
        result.push({
          groupId: null,
          groupName: 'Sin grupo',
          groupCode: null,
          qualifiersPerGroup: null,
          rows: unassigned,
        })
      }
    }

    return result
  }

  /**
   * Computes who qualifies for the next phase (bracket, multi-cup, or playoffs).
   * Uses standings + formatConfig to derive seed and destination per team.
   */
  async getQualifiers(editionId: string): Promise<QualifiersResult> {
    const [edition] = await this.db.select().from(editions).where(eq(editions.id, editionId))
    if (!edition) throw new NotFoundException(`Edición ${editionId} no encontrada`)

    const cfg = (edition.formatConfig ?? {}) as FormatConfigShape
    const formatType = cfg.type ?? 'none'
    const standings = await this.getForEdition(editionId)

    if (formatType === 'groups_knockout') {
      const phase2 = cfg.phase2 as { kind?: 'knockout'; bracketSize?: number } | undefined
      const bracketSize = phase2?.bracketSize ?? 0
      const qpg = cfg.phase1?.qualifiersPerGroup ?? 0
      if (!bracketSize || !qpg) {
        return { type: 'groups_knockout', bracketSize, qualifiers: [], totalSlots: bracketSize, reason: 'Configuración incompleta de fase 2.' }
      }

      // Real groups only (skip "Sin grupo")
      const groupBuckets = standings.filter((g) => g.groupId !== null)
      // Build a list with everyone within `qpg` per group, tagging position
      const candidates: { teamRow: StandingRow; groupCode: string | null; groupPosition: number }[] = []
      for (const g of groupBuckets) {
        for (let i = 0; i < Math.min(qpg, g.rows.length); i++) {
          candidates.push({ teamRow: g.rows[i], groupCode: g.groupCode, groupPosition: i + 1 })
        }
      }

      // Build seed order: layer by position (1° of all groups → seed 1..N), then 2° → seed N+1..2N, etc.
      const ordered: typeof candidates = []
      for (let pos = 1; pos <= qpg; pos++) {
        const layer = candidates.filter((c) => c.groupPosition === pos)
        // Inside the layer keep group order (A, B, C, …)
        layer.sort((a, b) => (a.groupCode ?? '').localeCompare(b.groupCode ?? ''))
        ordered.push(...layer)
      }

      const slots = bracketSize
      const qualifiers: Qualifier[] = ordered.slice(0, slots).map((c, idx) => ({
        teamId: c.teamRow.teamId,
        teamName: c.teamRow.teamName,
        teamShortName: c.teamRow.teamShortName,
        teamLogoUrl: c.teamRow.teamLogoUrl,
        teamPrimaryColor: c.teamRow.teamPrimaryColor,
        groupId: groupBuckets.find((g) => g.groupCode === c.groupCode)?.groupId ?? null,
        groupCode: c.groupCode,
        groupPosition: c.groupPosition,
        seed: idx + 1,
        destination: 'main',
        destinationLabel: bracketRoundLabel(slots, idx + 1),
      }))

      return { type: 'groups_knockout', bracketSize: slots, qualifiers, totalSlots: slots }
    }

    if (formatType === 'groups_multi_cup') {
      const phase2 = cfg.phase2 as { kind?: 'multi_cup'; cups?: { name: string; from: number; to: number; size: number }[] } | undefined
      const cups = phase2?.cups ?? []
      if (cups.length === 0) {
        return { type: 'groups_multi_cup', bracketSize: null, qualifiers: [], totalSlots: 0, reason: 'No hay copas configuradas.' }
      }

      const groupBuckets = standings.filter((g) => g.groupId !== null)
      const qualifiers: Qualifier[] = []

      for (const g of groupBuckets) {
        for (let i = 0; i < g.rows.length; i++) {
          const pos = i + 1
          const cup = cups.find((c) => pos >= c.from && pos <= c.to)
          if (!cup) continue
          qualifiers.push({
            teamId: g.rows[i].teamId,
            teamName: g.rows[i].teamName,
            teamShortName: g.rows[i].teamShortName,
            teamLogoUrl: g.rows[i].teamLogoUrl,
            teamPrimaryColor: g.rows[i].teamPrimaryColor,
            groupId: g.groupId,
            groupCode: g.groupCode,
            groupPosition: pos,
            seed: 0, // assigned per-cup below
            destination: cupSlug(cup.name),
            destinationLabel: cup.name,
          })
        }
      }

      // Assign seeds within each cup: layer by group position, then group order
      const grouped = new Map<string, Qualifier[]>()
      for (const q of qualifiers) {
        if (!grouped.has(q.destination)) grouped.set(q.destination, [])
        grouped.get(q.destination)!.push(q)
      }
      for (const list of grouped.values()) {
        list.sort((a, b) => {
          if (a.groupPosition !== b.groupPosition) return a.groupPosition - b.groupPosition
          return (a.groupCode ?? '').localeCompare(b.groupCode ?? '')
        })
        list.forEach((q, idx) => { q.seed = idx + 1 })
      }

      return {
        type: 'groups_multi_cup',
        bracketSize: null,
        qualifiers,
        totalSlots: cups.reduce((acc, c) => acc + c.size, 0),
      }
    }

    if (formatType === 'round_robin_playoffs') {
      const phase2 = cfg.phase2 as { kind?: 'knockout'; bracketSize?: number } | undefined
      const bracketSize = phase2?.bracketSize ?? 0
      if (!bracketSize) {
        return { type: 'round_robin_playoffs', bracketSize, qualifiers: [], totalSlots: 0, reason: 'Configuración incompleta.' }
      }
      const general = standings[0]
      if (!general) {
        return { type: 'round_robin_playoffs', bracketSize, qualifiers: [], totalSlots: bracketSize }
      }
      const qualifiers: Qualifier[] = general.rows.slice(0, bracketSize).map((r, idx) => ({
        teamId: r.teamId,
        teamName: r.teamName,
        teamShortName: r.teamShortName,
        teamLogoUrl: r.teamLogoUrl,
        teamPrimaryColor: r.teamPrimaryColor,
        groupId: null,
        groupCode: null,
        groupPosition: r.position,
        seed: idx + 1,
        destination: 'main',
        destinationLabel: bracketRoundLabel(bracketSize, idx + 1),
      }))
      return { type: 'round_robin_playoffs', bracketSize, qualifiers, totalSlots: bracketSize }
    }

    return { type: 'none', bracketSize: null, qualifiers: [], totalSlots: 0, reason: 'Este formato no tiene fase eliminatoria.' }
  }
}

// Maps a bracket size to the first round name. Seed indexes that pass into
// later rounds (byes) are flagged separately if the bracket isn't full.
function bracketRoundLabel(bracketSize: number, _seed: number): string {
  switch (bracketSize) {
    case 2:  return 'Final'
    case 4:  return 'Semifinales'
    case 8:  return 'Cuartos'
    case 16: return 'Octavos'
    case 32: return '16avos'
    case 64: return '32avos'
    default: return `Bracket de ${bracketSize}`
  }
}

function cupSlug(name: string): string {
  return 'cup_' + name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 30)
}
