import * as XLSX from 'xlsx'
import type { FineFromApi } from './fines'

const FINE_STATUS_LABEL: Record<string, string> = {
  pending: 'Pendiente', paid: 'Pagada', waived: 'Anulada',
}

export type CardStat = {
  playerName: string
  teamName: string
  yellow: number
  red: number
  matchesPlayed: number
}

/** Una tarjeta puntual en un partido específico. */
export type CardDetail = {
  matchId?: string
  playerUid?: string | null
  playerName: string
  teamName: string
  type: 'yellow_card' | 'red_card'
  minute: number | null
  matchLabel: string   // "Local vs Visitante"
  matchdayNumber: number | null
  date: string | null
}

export type FinesExcelInput = {
  editionName: string
  currency: string
  fines: FineFromApi[]
  cards: CardStat[]
  cardDetails?: CardDetail[]
  /** Tabla de multas y sanciones vigente del torneo (ya resuelta con los defaults). */
  tariffs?: FineTariffs
}

export type FineTariffs = {
  yellowCard: number
  redCard: number
  yellowAccumulation: number
  yellowsForAccumulation: number
  redCardMatchesBanned: number
  yellowAccumulationMatchesBanned: number
  redCardSanction?: string
  yellowAccumulationSanction?: string
}

/** Lee editions.fine_defaults con los mismos valores por defecto del API. */
export function resolveFineTariffs(raw: Record<string, unknown> | null | undefined): FineTariffs {
  const c = raw ?? {}
  const n = (v: unknown, d: number) => {
    const x = typeof v === 'string' ? Number(v) : (v as number)
    return typeof x === 'number' && Number.isFinite(x) && x >= 0 ? x : d
  }
  const s = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined)
  return {
    yellowCard: n(c.yellowCard, 0),
    redCard: n(c.redCard, 50000),
    yellowAccumulation: n(c.yellowAccumulation, 0),
    yellowsForAccumulation: Math.max(1, Math.trunc(n(c.yellowsForAccumulation, 3))),
    redCardMatchesBanned: Math.trunc(n(c.redCardMatchesBanned, 1)),
    yellowAccumulationMatchesBanned: Math.trunc(n(c.yellowAccumulationMatchesBanned, 1)),
    redCardSanction: s(c.redCardSanction),
    yellowAccumulationSanction: s(c.yellowAccumulationSanction),
  }
}

export function tariffRows(t: FineTariffs): Array<{ concepto: string; multa: number; sancion: string }> {
  const fechas = (k: number) => (k > 0 ? `Suspensión ${k} fecha${k === 1 ? '' : 's'}` : 'Sin suspensión')
  return [
    { concepto: 'Tarjeta amarilla', multa: t.yellowCard, sancion: 'Sin suspensión' },
    { concepto: 'Tarjeta roja', multa: t.redCard, sancion: t.redCardSanction || fechas(t.redCardMatchesBanned) },
    {
      concepto: `Acumulación de ${t.yellowsForAccumulation} amarillas`,
      multa: t.yellowAccumulation,
      sancion: t.yellowAccumulationSanction || fechas(t.yellowAccumulationMatchesBanned),
    },
  ]
}

function fmtDate(d: string | null): string {
  if (!d) return ''
  const dt = new Date(d)
  return isNaN(dt.getTime()) ? '' : dt.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
function slug(s: string): string {
  return (s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40)) || 'sanciones'
}

/** Descarga un Excel con: Sanciones, Tarjetas por jugador y Resumen por equipo. */
export function downloadFinesExcel(input: FinesExcelInput): void {
  const wb = XLSX.utils.book_new()

  // Multa de cada tarjeta: misma llave que usa el API al crearla (partido + jugador + tipo).
  const conceptOf = (f: FineFromApi) => (f as FineFromApi & { concept?: string }).concept
    ?? (/roja/i.test(f.reason) ? 'red_card' : /amarilla/i.test(f.reason) && !/acumulaci/i.test(f.reason) ? 'yellow_card' : 'other')
  const fineByKey = new Map<string, FineFromApi>()
  for (const f of input.fines) {
    if (f.matchId && f.playerUid) fineByKey.set(`${f.matchId}|${f.playerUid}|${conceptOf(f)}`, f)
  }
  const fineFor = (matchId: string, playerUid: string, type: string) => fineByKey.get(`${matchId}|${playerUid}|${type}`)

  // ── Hoja 0: Tabla de multas y sanciones ──
  if (input.tariffs) {
    const rows = tariffRows(input.tariffs).map((r) => ({ Concepto: r.concepto, Multa: r.multa, Sanción: r.sancion }))
    const wsT = XLSX.utils.json_to_sheet(rows, { header: ['Concepto', 'Multa', 'Sanción'] })
    wsT['!cols'] = [{ wch: 30 }, { wch: 12 }, { wch: 30 }]
    XLSX.utils.book_append_sheet(wb, wsT, 'Tabla de multas')
  }

  // ── Hoja 1: Sanciones / Multas ──
  const finesRows = [...input.fines]
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
    .map((f) => ({
      Equipo: f.team?.name ?? '',
      Jugador: f.playerName ?? '(equipo)',
      Motivo: f.reason,
      Sanción: f.sanction ?? '',
      'Fechas susp.': f.matchesBanned || '',
      Monto: Number(f.amount) || 0,
      Moneda: f.currency,
      Estado: FINE_STATUS_LABEL[f.status] ?? f.status,
      Fecha: fmtDate(f.createdAt),
    }))
  const wsFines = XLSX.utils.json_to_sheet(finesRows, {
    header: ['Equipo', 'Jugador', 'Motivo', 'Sanción', 'Fechas susp.', 'Monto', 'Moneda', 'Estado', 'Fecha'],
  })
  wsFines['!cols'] = [{ wch: 24 }, { wch: 26 }, { wch: 34 }, { wch: 16 }, { wch: 12 }, { wch: 12 }, { wch: 8 }, { wch: 12 }, { wch: 12 }]
  XLSX.utils.book_append_sheet(wb, wsFines, 'Sanciones')

  // ── Hoja 2: Tarjetas por jugador ──
  const cardRows = [...input.cards]
    .filter((c) => c.yellow > 0 || c.red > 0)
    .sort((a, b) => b.red - a.red || b.yellow - a.yellow || a.playerName.localeCompare(b.playerName))
    .map((c) => ({
      Jugador: c.playerName,
      Equipo: c.teamName,
      Amarillas: c.yellow,
      Rojas: c.red,
      PJ: c.matchesPlayed,
    }))
  const wsCards = XLSX.utils.json_to_sheet(cardRows, { header: ['Jugador', 'Equipo', 'Amarillas', 'Rojas', 'PJ'] })
  wsCards['!cols'] = [{ wch: 28 }, { wch: 24 }, { wch: 11 }, { wch: 8 }, { wch: 6 }]
  XLSX.utils.book_append_sheet(wb, wsCards, 'Tarjetas por jugador')

  // ── Hoja: Detalle de tarjetas (cada tarjeta en su partido) ──
  if (input.cardDetails && input.cardDetails.length) {
    const detailRows = [...input.cardDetails]
      .sort((a, b) => (a.matchdayNumber ?? 0) - (b.matchdayNumber ?? 0) || a.playerName.localeCompare(b.playerName))
      .map((d) => {
        const fine = d.matchId && d.playerUid ? fineFor(d.matchId, d.playerUid, d.type) : undefined
        return {
          Jornada: d.matchdayNumber ?? '',
          Partido: d.matchLabel,
          Jugador: d.playerName,
          Equipo: d.teamName,
          Tarjeta: d.type === 'red_card' ? 'Roja' : 'Amarilla',
          Minuto: d.minute != null ? `${d.minute}'` : '',
          Fecha: d.date ? fmtDate(d.date) : '',
          Multa: fine ? Number(fine.amount) || 0 : 0,
          'Estado pago': fine ? (FINE_STATUS_LABEL[fine.status] ?? fine.status) : 'Sin multa',
        }
      })
    const wsDetail = XLSX.utils.json_to_sheet(detailRows, {
      header: ['Jornada', 'Partido', 'Jugador', 'Equipo', 'Tarjeta', 'Minuto', 'Fecha', 'Multa', 'Estado pago'],
    })
    wsDetail['!cols'] = [{ wch: 8 }, { wch: 34 }, { wch: 26 }, { wch: 22 }, { wch: 10 }, { wch: 8 }, { wch: 12 }, { wch: 10 }, { wch: 12 }]
    XLSX.utils.book_append_sheet(wb, wsDetail, 'Tarjetas y pagos')
  }

  // ── Hoja 3: Resumen por equipo ──
  const byTeam = new Map<string, { yellow: number; red: number; fines: number; amount: number; paid: number; pending: number }>()
  for (const c of input.cards) {
    const t = byTeam.get(c.teamName) ?? { yellow: 0, red: 0, fines: 0, amount: 0, paid: 0, pending: 0 }
    t.yellow += c.yellow; t.red += c.red
    byTeam.set(c.teamName, t)
  }
  for (const f of input.fines) {
    const name = f.team?.name ?? '(sin equipo)'
    const t = byTeam.get(name) ?? { yellow: 0, red: 0, fines: 0, amount: 0, paid: 0, pending: 0 }
    const amt = Number(f.amount) || 0
    t.fines += 1; t.amount += amt
    if (f.status === 'paid') t.paid += amt
    else if (f.status === 'pending') t.pending += amt
    byTeam.set(name, t)
  }
  const teamRows = [...byTeam.entries()]
    .sort((a, b) => b[1].red - a[1].red || b[1].yellow - a[1].yellow)
    .map(([name, t]) => ({
      Equipo: name,
      Amarillas: t.yellow,
      Rojas: t.red,
      Multas: t.fines,
      'Monto multas': t.amount,
      Pagado: t.paid,
      Pendiente: t.pending,
    }))
  const wsTeam = XLSX.utils.json_to_sheet(teamRows, { header: ['Equipo', 'Amarillas', 'Rojas', 'Multas', 'Monto multas', 'Pagado', 'Pendiente'] })
  wsTeam['!cols'] = [{ wch: 26 }, { wch: 11 }, { wch: 8 }, { wch: 8 }, { wch: 14 }, { wch: 12 }, { wch: 12 }]
  XLSX.utils.book_append_sheet(wb, wsTeam, 'Resumen por equipo')

  XLSX.writeFile(wb, `sanciones_${slug(input.editionName)}.xlsx`)
}
