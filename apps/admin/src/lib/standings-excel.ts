import * as XLSX from 'xlsx'
import type { StandingGroup } from './standings'
import type { PlayerStatFromApi } from './player-stats'

function slug(s: string): string {
  return (
    s
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '_')
      .replace(/^_|_$/g, '')
      .slice(0, 40) || 'torneo'
  )
}

function save(wb: XLSX.WorkBook, filename: string) {
  XLSX.writeFile(wb, filename)
}

/**
 * Reclasificación: todos los equipos en una sola tabla, sin importar el grupo,
 * con el mismo criterio de desempate que usa la plataforma
 * (puntos → diferencia de gol → goles a favor → nombre).
 */
export function downloadReclassificationExcel(input: {
  editionName: string
  standings: StandingGroup[]
}): void {
  const all = input.standings.flatMap((g) =>
    g.rows.map((r) => ({ ...r, groupCode: g.groupCode })),
  )

  all.sort(
    (a, b) =>
      b.points - a.points ||
      b.goalDiff - a.goalDiff ||
      b.goalsFor - a.goalsFor ||
      a.teamName.localeCompare(b.teamName),
  )

  const data = all.map((r, i) => ({
    'Pos': i + 1,
    'Equipo': r.teamName,
    'Grupo': r.groupCode ?? '',
    'PJ': r.played,
    'G': r.wins,
    'E': r.draws,
    'P': r.losses,
    'GF': r.goalsFor,
    'GC': r.goalsAgainst,
    'Dif': r.goalDiff,
    'Pts': r.points,
    'Amarillas': r.yellowCards,
    'Rojas': r.redCards,
  }))

  const ws = XLSX.utils.json_to_sheet(data, {
    header: ['Pos', 'Equipo', 'Grupo', 'PJ', 'G', 'E', 'P', 'GF', 'GC', 'Dif', 'Pts', 'Amarillas', 'Rojas'],
  })
  ws['!cols'] = [
    { wch: 5 }, { wch: 32 }, { wch: 8 },
    { wch: 5 }, { wch: 4 }, { wch: 4 }, { wch: 4 },
    { wch: 5 }, { wch: 5 }, { wch: 6 }, { wch: 6 },
    { wch: 10 }, { wch: 8 },
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Reclasificación')

  // Una hoja por grupo, con su tabla propia: es lo que publican los organizadores.
  for (const g of input.standings) {
    if (!g.groupId) continue
    const gd = g.rows.map((r, i) => ({
      'Pos': i + 1,
      'Equipo': r.teamName,
      'PJ': r.played,
      'G': r.wins,
      'E': r.draws,
      'P': r.losses,
      'GF': r.goalsFor,
      'GC': r.goalsAgainst,
      'Dif': r.goalDiff,
      'Pts': r.points,
    }))
    const gws = XLSX.utils.json_to_sheet(gd, {
      header: ['Pos', 'Equipo', 'PJ', 'G', 'E', 'P', 'GF', 'GC', 'Dif', 'Pts'],
    })
    gws['!cols'] = [
      { wch: 5 }, { wch: 32 }, { wch: 5 }, { wch: 4 }, { wch: 4 },
      { wch: 4 }, { wch: 5 }, { wch: 5 }, { wch: 6 }, { wch: 6 },
    ]
    // El nombre de hoja de Excel admite 31 caracteres y no acepta : \ / ? * [ ]
    const sheetName = (g.groupName || g.groupCode || 'Grupo').replace(/[:\\/?*[\]]/g, '').slice(0, 31)
    XLSX.utils.book_append_sheet(wb, gws, sheetName)
  }

  save(wb, `reclasificacion_${slug(input.editionName)}.xlsx`)
}

/** Tabla de goleadores del campeonato. */
export function downloadScorersExcel(input: {
  editionName: string
  scorers: PlayerStatFromApi[]
  teamNameById?: Map<string, string>
}): void {
  const rows = [...input.scorers].sort(
    (a, b) =>
      b.goals - a.goals ||
      a.matchesPlayed - b.matchesPlayed ||
      a.playerName.localeCompare(b.playerName),
  )

  const data = rows.map((r, i) => ({
    'Pos': i + 1,
    'Jugador': r.playerName,
    'Equipo': input.teamNameById?.get(r.teamId) ?? '',
    'Goles': r.goals,
    'PJ': r.matchesPlayed,
    // Promedio por partido: dos goles en un partido no es lo mismo que en diez.
    'Goles/PJ': r.matchesPlayed > 0 ? Number((r.goals / r.matchesPlayed).toFixed(2)) : 0,
    'Asistencias': r.assists,
    'Amarillas': r.yellowCards,
    'Rojas': r.redCards,
  }))

  const ws = XLSX.utils.json_to_sheet(data, {
    header: ['Pos', 'Jugador', 'Equipo', 'Goles', 'PJ', 'Goles/PJ', 'Asistencias', 'Amarillas', 'Rojas'],
  })
  ws['!cols'] = [
    { wch: 5 }, { wch: 34 }, { wch: 28 }, { wch: 7 },
    { wch: 5 }, { wch: 9 }, { wch: 12 }, { wch: 10 }, { wch: 8 },
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Goleadores')
  save(wb, `goleadores_${slug(input.editionName)}.xlsx`)
}
