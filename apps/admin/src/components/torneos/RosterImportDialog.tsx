'use client'

import { useEffect, useRef, useState } from 'react'
import {
  AlertCircle, CheckCircle2, Download, Loader2, Upload, X, Table, Trash2,
} from 'lucide-react'
import { clsx } from 'clsx'
import * as XLSX from 'xlsx'
import { parseCsv, normalizeHeader, parseDateLoose, downloadCsv } from '@/lib/csv'
import {
  addRosterPlayer,
  getRosterByRegistration,
  PLAYER_POSITIONS,
  type PlayerPosition,
  type RegistrationPlayerFromApi,
} from '@/lib/registration-players'

// Header aliases → normalized internal key. Matching is token-based (whole
// words only) to avoid "no" colliding with "nombres" or "no celular".
const HEADER_ALIASES: Record<string, string[]> = {
  firstName:       ['nombres', 'nombre'],
  lastName:        ['apellidos', 'apellido'],
  docNumber:       ['no cedula', 'cedula', 'documento', 'numero cedula', 'identificacion'],
  birthDate:       ['fecha de nacimiento', 'fecha nacimiento', 'nacimiento'],
  employer:        ['empresa que labora', 'empresa', 'lugar trabajo', 'compania'],
  phone:           ['no celular', 'celular', 'telefono', 'movil'],
  email:           ['correo electronico', 'correo', 'email'],
  healthProvider:  ['eps', 'sistema salud', 'aseguradora'],
  position:        ['posicion'],
  jerseyNumber:    ['dorsal', 'camiseta'],
}

// Token-based match: header must contain every token of the alias as a whole
// word. "nombres" does NOT match alias "no" (not a whole token).
function headerMatches(headerNorm: string, alias: string): boolean {
  if (headerNorm === alias) return true
  const hTokens = headerNorm.split(' ').filter(Boolean)
  const aTokens = alias.split(' ').filter(Boolean)
  return aTokens.every((t) => hTokens.includes(t))
}

// Position name → PlayerPosition code
const POSITION_MAP: Record<string, PlayerPosition> = {
  arquero: 'GK', portero: 'GK', gk: 'GK',
  defensa: 'CB', central: 'CB', zaguero: 'CB', cb: 'CB',
  'lateral izquierdo': 'LB', 'defensa izquierdo': 'LB', lb: 'LB',
  'lateral derecho': 'RB', 'defensa derecho': 'RB', rb: 'RB',
  'volante defensivo': 'CDM', cdm: 'CDM', mediocampista: 'CM',
  volante: 'CM', centrocampista: 'CM', medio: 'CM', cm: 'CM',
  'volante ofensivo': 'CAM', enganche: 'CAM', cam: 'CAM',
  'extremo izquierdo': 'LW', 'puntero izquierdo': 'LW', lw: 'LW',
  'extremo derecho': 'RW', 'puntero derecho': 'RW', rw: 'RW',
  'delantero centro': 'CF', centroatacante: 'CF', cf: 'CF',
  delantero: 'ST', atacante: 'ST', goleador: 'ST', st: 'ST',
}

function matchPosition(raw: string): PlayerPosition | undefined {
  const n = normalizeHeader(raw)
  if (!n) return undefined
  if ((PLAYER_POSITIONS as string[]).includes(n.toUpperCase())) return n.toUpperCase() as PlayerPosition
  if (POSITION_MAP[n]) return POSITION_MAP[n]
  for (const [key, value] of Object.entries(POSITION_MAP)) {
    if (n.includes(key)) return value
  }
  return undefined
}

type ParsedRow = {
  index: number
  raw: Record<string, string>
  // resolved values
  firstName: string
  lastName: string
  docNumber: string
  birthDate: string | null
  birthDateRaw: string
  employer: string
  phone: string
  email: string
  healthProvider: string
  position: PlayerPosition | undefined
  positionRaw: string
  jerseyNumber: number | null
  errors: string[]
}

export function RosterImportDialog({
  registrationId, onClose, onImported,
}: {
  registrationId: string
  onClose: () => void
  onImported: () => void
}) {
  const [parsed, setParsed] = useState<ParsedRow[] | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0, failed: [] as string[] })
  const [error, setError] = useState<string | null>(null)
  const [existingRoster, setExistingRoster] = useState<RegistrationPlayerFromApi[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    // Load existing roster once to validate duplicates against DB state
    getRosterByRegistration(registrationId).then(setExistingRoster).catch(() => {})
  }, [registrationId])

  async function handleFile(file: File) {
    setError(null)
    setProgress({ done: 0, total: 0, failed: [] })
    try {
      const name = file.name.toLowerCase()
      const isExcel = name.endsWith('.xlsx') || name.endsWith('.xls') ||
        file.type === 'application/vnd.ms-excel' ||
        file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

      // Cells can be strings or native Date objects (from Excel with cellDates).
      type Cell = string | Date
      let rows: Cell[][]
      if (isExcel) {
        const buf = await file.arrayBuffer()
        const wb = XLSX.read(buf, { type: 'array', cellDates: true })
        const sheet = wb.Sheets[wb.SheetNames[0]]
        if (!sheet) {
          setError('El archivo Excel no tiene hojas.')
          return
        }
        // raw:true preserves Date objects; strings and numbers come through too.
        const raw = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: '' })
        rows = raw
          .map((r) => (r as unknown[]).map((c): Cell => {
            if (c instanceof Date) return c
            if (c == null) return ''
            return String(c)
          }))
          .filter((r) => r.some((c) => (c instanceof Date) || (typeof c === 'string' && c.trim().length > 0)))
      } else {
        const text = await file.text()
        rows = parseCsv(text)
      }

      const cellString = (c: Cell | undefined): string => {
        if (c == null) return ''
        if (c instanceof Date) return c.toISOString()
        return c.trim()
      }
      const cellRaw = (c: Cell | undefined): string | Date => {
        if (c == null) return ''
        return c instanceof Date ? c : c.trim()
      }

      if (rows.length < 2) {
        setError('El archivo no contiene filas de datos.')
        return
      }

      const headers = rows[0].map((c) => normalizeHeader(cellString(c)))
      // map header column index → internal field key (token-based)
      const colMap: Record<string, number> = {}
      for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
        for (let i = 0; i < headers.length; i++) {
          if (aliases.some((a) => headerMatches(headers[i], a))) {
            colMap[field] = i
            break
          }
        }
      }

      const missing = ['firstName', 'lastName'].filter((k) => colMap[k] === undefined)
      if (missing.length > 0) {
        setError(`Faltan columnas obligatorias: ${missing.map((m) => m === 'firstName' ? 'Nombres' : 'Apellidos').join(', ')}.`)
        return
      }

      // Build lookup of existing emails/docs to detect duplicates against DB
      const existingEmails = new Set(
        existingRoster.map((p) => p.email?.toLowerCase().trim()).filter(Boolean) as string[],
      )
      const existingDocs = new Set(
        existingRoster.map((p) => p.docNumber?.trim()).filter(Boolean) as string[],
      )

      // Track duplicates within the file itself
      const fileEmails = new Map<string, number>() // email → first row index
      const fileDocs = new Map<string, number>()

      const out: ParsedRow[] = []
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i]
        const get = (k: string) => (colMap[k] !== undefined ? cellString(row[colMap[k]]) : '')
        const getRaw = (k: string) => (colMap[k] !== undefined ? cellRaw(row[colMap[k]]) : '')

        const firstName = get('firstName')
        const lastName = get('lastName')
        const birthDateCell = getRaw('birthDate')
        const birthDateRaw = typeof birthDateCell === 'string' ? birthDateCell : String(birthDateCell)
        const birthDate = birthDateCell ? parseDateLoose(birthDateCell) : null
        const positionRaw = get('position')
        const position = positionRaw ? matchPosition(positionRaw) : undefined
        const jerseyRaw = get('jerseyNumber')
        const jerseyNumber = jerseyRaw ? parseInt(jerseyRaw) : null
        const docNumber = get('docNumber')
        const email = get('email')
        const emailLc = email.toLowerCase()

        const errors: string[] = []
        if (!firstName) errors.push('Falta nombre')
        if (!lastName) errors.push('Falta apellido')
        if (birthDateRaw && !birthDate) errors.push('Fecha inválida')
        if (positionRaw && !position) errors.push('Posición no reconocida')
        if (jerseyRaw && (!Number.isFinite(jerseyNumber) || jerseyNumber! < 0)) errors.push('Dorsal inválido')
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('Email inválido')

        if (emailLc && existingEmails.has(emailLc)) errors.push('Email ya existe en la plantilla')
        if (docNumber && existingDocs.has(docNumber)) errors.push('Cédula ya existe en la plantilla')

        if (emailLc) {
          const prev = fileEmails.get(emailLc)
          if (prev !== undefined) errors.push(`Email duplicado en el archivo (fila ${prev + 1})`)
          else fileEmails.set(emailLc, i)
        }
        if (docNumber) {
          const prev = fileDocs.get(docNumber)
          if (prev !== undefined) errors.push(`Cédula duplicada en el archivo (fila ${prev + 1})`)
          else fileDocs.set(docNumber, i)
        }

        out.push({
          index: i,
          raw: Object.fromEntries(headers.map((h, idx) => [h, cellString(row[idx])])),
          firstName, lastName,
          docNumber,
          birthDate, birthDateRaw,
          employer: get('employer'),
          phone: get('phone'),
          email,
          healthProvider: get('healthProvider'),
          position, positionRaw,
          jerseyNumber: Number.isFinite(jerseyNumber) ? jerseyNumber : null,
          errors,
        })
      }

      setFileName(file.name)
      setParsed(out)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo leer el archivo.')
    }
  }

  function onFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (f) handleFile(f)
    e.target.value = ''
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files?.[0]
    if (f) handleFile(f)
  }

  function downloadTemplate(format: 'csv' | 'xlsx') {
    const data = [
      ['Nombres', 'Apellidos', 'Cédula', 'Fecha Nacimiento', 'Empresa', 'Celular', 'Email', 'EPS', 'Posición', 'Dorsal'],
      ['Diego Alexander', 'Espejo Lara', '80832402', '2/10/1985', 'Organizacion MAS', '3197298601', 'naturaalvector@gmail.com', 'Compensar', 'Defensa', '1'],
      ['Jhon Edison', 'Cortés Gutierréz', '1030553463', '21/1/1989', 'Domun Inc', '3124035940', 'jhon.cortes@domun.co', 'Salud Total', 'Defensa', '2'],
    ]
    if (format === 'csv') {
      downloadCsv('plantilla-jugadores.csv', data)
      return
    }
    const ws = XLSX.utils.aoa_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Jugadores')
    XLSX.writeFile(wb, 'plantilla-jugadores.xlsx')
  }

  const validCount = parsed?.filter((r) => r.errors.length === 0).length ?? 0
  const invalidCount = (parsed?.length ?? 0) - validCount

  async function runImport() {
    if (!parsed) return
    const toImport = parsed.filter((r) => r.errors.length === 0)
    if (toImport.length === 0) return

    setImporting(true)
    setProgress({ done: 0, total: toImport.length, failed: [] })

    const failed: string[] = []
    let done = 0

    for (const r of toImport) {
      try {
        await addRosterPlayer({
          registrationId,
          playerUid: `manual:${crypto.randomUUID()}`,
          playerName: `${r.firstName} ${r.lastName}`.trim(),
          firstName: r.firstName || undefined,
          lastName: r.lastName || undefined,
          docNumber: r.docNumber || undefined,
          birthDate: r.birthDate ?? undefined,
          employer: r.employer || undefined,
          phone: r.phone || undefined,
          email: r.email || undefined,
          healthProvider: r.healthProvider || undefined,
          position: r.position,
          jerseyNumber: r.jerseyNumber ?? undefined,
        })
      } catch (err) {
        const msg = extractError(err) ?? 'error'
        failed.push(`Fila ${r.index + 1}: ${r.firstName} ${r.lastName} — ${msg}`)
      } finally {
        done++
        setProgress({ done, total: toImport.length, failed: [...failed] })
      }
    }

    setImporting(false)
    if (failed.length === 0) {
      onImported()
    }
  }

  const done = progress.total > 0 && progress.done === progress.total

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={importing ? undefined : onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center">
                <Table size={15} className="text-emerald-700" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">Importar jugadores</h2>
                <p className="text-xs text-slate-400">Acepta archivos .csv, .xlsx y .xls</p>
              </div>
            </div>
            <button
              onClick={onClose}
              disabled={importing}
              className="text-slate-400 hover:text-slate-700 transition-colors disabled:opacity-50"
            >
              <X size={18} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4">
            {!parsed && (
              <>
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={onDrop}
                  onClick={() => inputRef.current?.click()}
                  className={clsx(
                    'rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-3 py-12 cursor-pointer transition-colors',
                    dragOver
                      ? 'border-green-500 bg-green-50'
                      : 'border-slate-200 hover:border-slate-300 bg-slate-50',
                  )}
                >
                  <Upload size={28} className="text-slate-400" />
                  <div className="text-center">
                    <p className="text-sm font-semibold text-slate-700">Arrastra el archivo aquí</p>
                    <p className="text-xs text-slate-400 mt-1">o haz click para seleccionarlo</p>
                  </div>
                  <input
                    ref={inputRef}
                    type="file"
                    accept=".csv,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    className="hidden"
                    onChange={onFileInputChange}
                  />
                </div>

                <div className="mt-4 flex items-center justify-between px-1">
                  <p className="text-xs text-slate-500">
                    ¿No sabes qué columnas incluir?
                  </p>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => downloadTemplate('xlsx')}
                      className="flex items-center gap-1.5 text-xs font-semibold text-green-700 hover:text-green-800 transition-colors"
                    >
                      <Download size={12} /> Plantilla .xlsx
                    </button>
                    <span className="text-slate-300">·</span>
                    <button
                      onClick={() => downloadTemplate('csv')}
                      className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700 transition-colors"
                    >
                      <Download size={12} /> .csv
                    </button>
                  </div>
                </div>

                <div className="mt-4 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Columnas reconocidas</p>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    <strong>Nombres</strong>, <strong>Apellidos</strong> (obligatorios), Cédula, Fecha Nacimiento,
                    Empresa, Celular, Email, EPS, Posición, Dorsal.
                    Los nombres de las columnas son flexibles (ej. "No. Celular" ≡ "Celular"). La posición se autodetecta
                    (ej. "Defensa" → CB, "Volante derecho" → RW).
                  </p>
                </div>

                {error && (
                  <div className="mt-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
                    <AlertCircle size={12} /> {error}
                  </div>
                )}
              </>
            )}

            {parsed && (
              <>
                <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
                  <div className="flex items-center gap-2 text-xs text-slate-500 min-w-0">
                    <Table size={13} />
                    <span className="font-semibold truncate max-w-[180px]" title={fileName ?? undefined}>{fileName}</span>
                    <span>·</span>
                    <span>{parsed.length} filas</span>
                    {invalidCount > 0 && (
                      <>
                        <span>·</span>
                        <span className="text-red-600 font-semibold">{invalidCount} con errores</span>
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    {invalidCount > 0 && (
                      <button
                        onClick={() => setParsed((prev) => prev?.filter((r) => r.errors.length === 0) ?? null)}
                        disabled={importing}
                        className="flex items-center gap-1.5 text-xs font-semibold text-red-600 hover:text-red-700 transition-colors disabled:opacity-50"
                      >
                        <Trash2 size={12} /> Eliminar {invalidCount} inválido{invalidCount === 1 ? '' : 's'}
                      </button>
                    )}
                    <button
                      onClick={() => { setParsed(null); setFileName(null); setError(null) }}
                      disabled={importing}
                      className="text-xs font-semibold text-slate-500 hover:text-slate-700 transition-colors disabled:opacity-50"
                    >
                      Cambiar archivo
                    </button>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 overflow-auto max-h-[50vh]">
                  <table className="w-full text-[11px]">
                    <thead className="bg-slate-50 sticky top-0 border-b border-slate-200">
                      <tr>
                        <th className="text-left font-bold text-slate-500 uppercase tracking-wide px-2 py-2 w-8">#</th>
                        <th className="text-left font-bold text-slate-500 uppercase tracking-wide px-2 py-2">Nombre</th>
                        <th className="text-left font-bold text-slate-500 uppercase tracking-wide px-2 py-2">Cédula</th>
                        <th className="text-left font-bold text-slate-500 uppercase tracking-wide px-2 py-2">Nacimiento</th>
                        <th className="text-left font-bold text-slate-500 uppercase tracking-wide px-2 py-2">Celular</th>
                        <th className="text-left font-bold text-slate-500 uppercase tracking-wide px-2 py-2">EPS</th>
                        <th className="text-left font-bold text-slate-500 uppercase tracking-wide px-2 py-2">POS</th>
                        <th className="text-left font-bold text-slate-500 uppercase tracking-wide px-2 py-2 w-28">Estado</th>
                        <th className="px-2 py-2 w-8"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {parsed.map((r) => (
                        <tr key={r.index} className={clsx(r.errors.length > 0 ? 'bg-red-50/40' : 'hover:bg-slate-50/50')}>
                          <td className="px-2 py-1.5 text-slate-400">{r.jerseyNumber ?? '—'}</td>
                          <td className="px-2 py-1.5 font-semibold text-slate-800 whitespace-nowrap">
                            {r.firstName} {r.lastName}
                          </td>
                          <td className="px-2 py-1.5 font-mono text-slate-600">{r.docNumber || '—'}</td>
                          <td className="px-2 py-1.5 text-slate-600">
                            {r.birthDate ?? (r.birthDateRaw ? <span className="text-red-600">{r.birthDateRaw}</span> : '—')}
                          </td>
                          <td className="px-2 py-1.5 font-mono text-slate-600">{r.phone || '—'}</td>
                          <td className="px-2 py-1.5 text-slate-600">{r.healthProvider || '—'}</td>
                          <td className="px-2 py-1.5">
                            {r.position ? (
                              <span className="inline-flex items-center rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-bold text-slate-700">
                                {r.position}
                              </span>
                            ) : r.positionRaw ? (
                              <span className="text-red-600">{r.positionRaw}</span>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                          <td className="px-2 py-1.5">
                            {r.errors.length === 0 ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-green-700">
                                <CheckCircle2 size={10} /> Listo
                              </span>
                            ) : (
                              <span
                                className="inline-flex items-center gap-1 text-[10px] font-bold text-red-600"
                                title={r.errors.join(' · ')}
                              >
                                <AlertCircle size={10} /> {r.errors[0]}
                              </span>
                            )}
                          </td>
                          <td className="px-2 py-1.5 text-right">
                            <button
                              onClick={() => setParsed((prev) => prev?.filter((p) => p.index !== r.index) ?? null)}
                              disabled={importing}
                              className="p-1 rounded-md text-slate-300 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                              title="Eliminar fila del preview"
                            >
                              <Trash2 size={12} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {progress.total > 0 && (
                  <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold text-slate-700">
                        {done
                          ? `Completado: ${progress.done - progress.failed.length} de ${progress.total} creados`
                          : `Importando... ${progress.done} / ${progress.total}`}
                      </p>
                      {importing && <Loader2 size={14} className="animate-spin text-slate-500" />}
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="h-full bg-green-500 transition-all"
                        style={{ width: `${(progress.done / progress.total) * 100}%` }}
                      />
                    </div>
                    {progress.failed.length > 0 && (
                      <div className="mt-3 space-y-1">
                        {progress.failed.map((f, i) => (
                          <p key={i} className="text-[11px] text-red-600">
                            <AlertCircle size={10} className="inline mr-1" /> {f}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {parsed && (
            <div className="flex items-center justify-between gap-2 px-5 py-4 border-t border-slate-200 bg-slate-50">
              <p className="text-xs text-slate-500">
                {done
                  ? `Importación finalizada.${progress.failed.length > 0 ? ' Revisa los errores arriba.' : ''}`
                  : `Se importarán ${validCount} jugadores${invalidCount > 0 ? ` (${invalidCount} ignorados por errores)` : ''}.`}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={onClose}
                  disabled={importing}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-50"
                >
                  {done ? 'Cerrar' : 'Cancelar'}
                </button>
                {!done && (
                  <button
                    onClick={runImport}
                    disabled={importing || validCount === 0}
                    className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white text-xs font-bold rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                  >
                    {importing ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                    Importar {validCount} {validCount === 1 ? 'jugador' : 'jugadores'}
                  </button>
                )}
                {done && progress.failed.length === 0 && (
                  <button
                    onClick={onImported}
                    className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white text-xs font-bold rounded-lg hover:bg-green-700 transition-colors"
                  >
                    <CheckCircle2 size={12} /> Listo
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

function extractError(err: unknown): string | null {
  if (typeof err !== 'object' || err === null) return null
  const maybeAxios = err as { response?: { data?: { message?: string | string[] } } }
  const msg = maybeAxios.response?.data?.message
  if (!msg) return null
  return Array.isArray(msg) ? msg[0] ?? null : msg
}
