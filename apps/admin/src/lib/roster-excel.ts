import * as XLSX from 'xlsx'
import { PLAYER_POSITION_LABEL, type RegistrationPlayerFromApi, type TeamDelegate } from './registration-players'

export type RosterExcelInput = {
  editionName: string
  teamName: string
  groupName?: string | null
  players: RegistrationPlayerFromApi[]
  delegates?: TeamDelegate[]
}

function fmtDate(d: string | null): string {
  if (!d) return ''
  const m = d.match(/^(\d{4})-(\d{2})-(\d{2})/)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : d
}

function slug(s: string): string {
  return (
    s
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '_')
      .replace(/^_|_$/g, '')
      .slice(0, 40) || 'planilla'
  )
}

/** Genera y descarga la planilla del equipo en Excel (.xlsx). Mismos datos que el PDF. */
export function downloadRosterExcel(input: RosterExcelInput): void {
  const rows = [...input.players].sort((a, b) => {
    const ja = a.jerseyNumber ?? 9999
    const jb = b.jerseyNumber ?? 9999
    if (ja !== jb) return ja - jb
    return (a.playerName || '').localeCompare(b.playerName || '')
  })

  const delegateRole = new Map((input.delegates ?? []).map((d) => [d.uid, d.role === 'principal' ? 'Principal' : 'Sí']))
  const data = rows.map((p) => ({
    '#': p.jerseyNumber ?? '',
    Jugador: [p.firstName, p.lastName].filter(Boolean).join(' ').trim() || p.playerName,
    Documento: p.docNumber ?? '',
    Posición: p.position ? PLAYER_POSITION_LABEL[p.position] : '',
    'F. Nacimiento': fmtDate(p.birthDate),
    Capitán: p.isCaptain ? 'Sí' : '',
    Delegado: delegateRole.get(p.playerUid) ?? '',
  }))

  const ws = XLSX.utils.json_to_sheet(data, {
    header: ['#', 'Jugador', 'Documento', 'Posición', 'F. Nacimiento', 'Capitán', 'Delegado'],
  })
  // Anchos de columna
  ws['!cols'] = [
    { wch: 4 },   // #
    { wch: 32 },  // Jugador
    { wch: 16 },  // Documento
    { wch: 18 },  // Posición
    { wch: 14 },  // F. Nacimiento
    { wch: 8 },   // Capitán
    { wch: 10 },  // Delegado
  ]

  const wb = XLSX.utils.book_new()
  // Nombre de hoja: máx 31 chars, sin caracteres inválidos
  const sheetName = input.teamName.replace(/[\\/?*[\]:]/g, '').slice(0, 31) || 'Planilla'
  XLSX.utils.book_append_sheet(wb, ws, sheetName)

  XLSX.writeFile(wb, `Planilla_${slug(input.teamName)}_${slug(input.editionName)}.xlsx`)
}
