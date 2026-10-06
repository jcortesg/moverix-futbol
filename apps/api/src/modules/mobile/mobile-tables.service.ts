import { Injectable, NotFoundException } from '@nestjs/common'
import { desc, eq, and, gt } from 'drizzle-orm'
import { DatabaseService } from '../../db/database.service'
import { editions, groups, playerStats, teams } from '../../db/schema'
import { StandingsService, type StandingRow } from '../standings/standings.service'

/**
 * Tablas del torneo listas para pintar.
 *
 * La app NO calcula, ordena ni decide qué tablas existen: recibe sub-pestañas
 * y secciones con columnas y filas ya resueltas, y las dibuja con un único
 * componente genérico. Así corregir o agregar una tabla es desplegar la API,
 * no recompilar la app (la valla, por ejemplo, contaba solo grupos y el
 * arreglo tuvo que esperar una versión nueva).
 */

export type CellTone = 'positive' | 'negative' | 'muted'

export interface TableColumn {
  key: string
  label: string
  /** Columna destacada (PTS, GOL, GC): va en verde y negrita. */
  emphasis?: boolean
}

export interface TableRow {
  id: string
  position: number
  title: string
  subtitle?: string | null
  logoUrl?: string | null
  color?: string | null
  /** Equipo de la fila, para resaltar el del usuario. */
  teamId?: string | null
  link?: { kind: 'team' | 'player'; id: string } | null
  cells: Record<string, { text: string; tone?: CellTone }>
}

export interface TableSection {
  id: string
  /** Sub-pestaña donde va la sección. */
  tab: string
  title: string
  /** Secciones con el mismo `slider` se muestran juntas en un carrusel. */
  slider?: string
  columns: TableColumn[]
  rows: TableRow[]
  emptyText?: string
}

export interface EditionTables {
  tabs: { key: string; label: string }[]
  sections: TableSection[]
  updatedAt: string
}

const SCORERS_LIMIT = 20

function num(n: number) {
  return { text: String(n) }
}

function diff(n: number) {
  return { text: n > 0 ? `+${n}` : String(n), tone: (n > 0 ? 'positive' : n < 0 ? 'negative' : 'muted') as CellTone }
}

function teamRow(r: StandingRow, position: number, cells: TableRow['cells']): TableRow {
  return {
    id: r.teamId,
    position,
    title: r.teamName,
    logoUrl: r.teamLogoUrl,
    color: r.teamPrimaryColor,
    teamId: r.teamId,
    link: { kind: 'team', id: r.teamId },
    cells,
  }
}

const STANDINGS_COLUMNS: TableColumn[] = [
  { key: 'pj', label: 'PJ' },
  { key: 'g', label: 'G' },
  { key: 'e', label: 'E' },
  { key: 'p', label: 'P' },
  { key: 'dg', label: 'DG' },
  { key: 'pts', label: 'PTS', emphasis: true },
]

function standingsCells(r: StandingRow): TableRow['cells'] {
  return {
    pj: num(r.played), g: num(r.wins), e: num(r.draws), p: num(r.losses),
    dg: diff(r.goalDiff), pts: num(r.points),
  }
}

@Injectable()
export class MobileTablesService {
  constructor(
    private readonly database: DatabaseService,
    private readonly standings: StandingsService,
  ) {}

  private get db() {
    return this.database.db
  }

  async tables(editionId: string, isIos = false): Promise<EditionTables> {
    const [edition] = await this.db
      .select({ id: editions.id, hiddenOnIos: editions.hiddenOnIos })
      .from(editions)
      .where(eq(editions.id, editionId))
    if (!edition || (isIos && edition.hiddenOnIos)) {
      throw new NotFoundException(`Edicion ${editionId} no encontrada`)
    }

    const [standingGroups, groupRows, conceded, scorers] = await Promise.all([
      this.standings.getForEdition(editionId),
      this.db.select({ id: groups.id, phase: groups.phase }).from(groups).where(eq(groups.editionId, editionId)),
      this.standings.getLeastConceded(editionId),
      this.db
        .select({
          id: playerStats.id,
          playerUid: playerStats.playerUid,
          playerName: playerStats.playerName,
          teamId: playerStats.teamId,
          matchesPlayed: playerStats.matchesPlayed,
          goals: playerStats.goals,
          teamName: teams.name,
          teamLogoUrl: teams.logoUrl,
        })
        .from(playerStats)
        .innerJoin(teams, eq(teams.id, playerStats.teamId))
        .where(and(eq(playerStats.editionId, editionId), gt(playerStats.goals, 0)))
        .orderBy(desc(playerStats.goals), desc(playerStats.assists))
        .limit(SCORERS_LIMIT),
    ])

    const sections: TableSection[] = []
    const phaseOf = new Map(groupRows.map((g) => [g.id, g.phase]))

    // ─── Posiciones ───
    const groupPhase = standingGroups.filter((g) => g.groupId && phaseOf.get(g.groupId) === 'groups')
    const otherPhases = standingGroups.filter((g) => g.groupId && phaseOf.get(g.groupId) !== 'groups')
    const general = standingGroups.filter((g) => !g.groupId)

    for (const g of groupPhase) {
      sections.push({
        id: `group-${g.groupId}`,
        tab: 'posiciones',
        title: g.groupName,
        slider: groupPhase.length > 1 ? 'grupos' : undefined,
        columns: STANDINGS_COLUMNS,
        rows: g.rows.map((r) => teamRow(r, r.position, standingsCells(r))),
      })
    }
    // Sin grupos es una liga: una sola tabla general.
    if (groupPhase.length === 0) {
      for (const g of general) {
        sections.push({
          id: 'general',
          tab: 'posiciones',
          title: 'Tabla general',
          columns: STANDINGS_COLUMNS,
          rows: g.rows.map((r) => teamRow(r, r.position, standingsCells(r))),
        })
      }
    }
    for (const g of otherPhases) {
      sections.push({
        id: `group-${g.groupId}`,
        tab: 'posiciones',
        title: g.groupName,
        columns: STANDINGS_COLUMNS,
        rows: g.rows.map((r) => teamRow(r, r.position, standingsCells(r))),
      })
    }

    // Reclasificación: todos los equipos de grupos en una tabla, pts > DG > GF.
    if (groupPhase.length > 1) {
      const all = groupPhase.flatMap((g) => g.rows)
      const sorted = [...all].sort((a, b) =>
        b.points - a.points || b.goalDiff - a.goalDiff || b.goalsFor - a.goalsFor ||
        a.teamName.localeCompare(b.teamName))
      sections.push({
        id: 'reclasificacion',
        tab: 'posiciones',
        title: 'Reclasificación',
        columns: [
          { key: 'pj', label: 'PJ' },
          { key: 'dg', label: 'DG' },
          { key: 'pts', label: 'PTS', emphasis: true },
        ],
        rows: sorted.map((r, i) => teamRow(r, i + 1, { pj: num(r.played), dg: diff(r.goalDiff), pts: num(r.points) })),
      })
    }

    // ─── Valla: todo el torneo (grupos + eliminatoria) ───
    sections.push({
      id: 'valla',
      tab: 'valla',
      title: 'Valla menos vencida',
      columns: [
        { key: 'pj', label: 'PJ' },
        { key: 'gc', label: 'GC', emphasis: true },
      ],
      rows: conceded.map((r) => ({
        id: r.teamId,
        position: r.position,
        title: r.teamName,
        logoUrl: r.teamLogoUrl,
        color: r.teamPrimaryColor,
        teamId: r.teamId,
        link: { kind: 'team', id: r.teamId },
        cells: { pj: num(r.played), gc: num(r.goalsAgainst) },
      })),
      emptyText: 'Todavía no se ha jugado ningún partido',
    })

    // ─── Goleadores: player_stats ya incluye todas las fases ───
    sections.push({
      id: 'goleadores',
      tab: 'goleadores',
      title: 'Goleadores',
      columns: [
        { key: 'pj', label: 'PJ' },
        { key: 'gol', label: 'GOL', emphasis: true },
      ],
      rows: scorers.map((s, i) => ({
        id: s.id,
        position: i + 1,
        title: s.playerName,
        subtitle: s.teamName,
        teamId: s.teamId,
        link: { kind: 'player', id: s.playerUid },
        cells: { pj: num(s.matchesPlayed), gol: num(s.goals) },
      })),
      emptyText: 'Sin goles registrados aún',
    })

    return {
      tabs: [
        { key: 'posiciones', label: 'Posiciones' },
        { key: 'valla', label: 'Valla' },
        { key: 'goleadores', label: 'Goleadores' },
      ],
      sections,
      updatedAt: new Date().toISOString(),
    }
  }
}
