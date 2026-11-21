'use client'

import { useEffect, useState } from 'react'
import {
  Loader2, AlertCircle, Plus, Users, Crown, Trash2, Pencil, Upload, ShieldCheck, Download, RotateCcw, CheckCircle2,
} from 'lucide-react'
import { clsx } from 'clsx'
import {
  getRosterByRegistration,
  addRosterPlayer,
  updateRosterPlayer,
  removeRosterPlayer,
  restoreRosterPlayer,
  addDirectorAsPlayer,
  getTeamDelegates,
  PLAYER_POSITION_LABEL,
  type RegistrationPlayerFromApi,
  type TeamDelegate,
} from '@/lib/registration-players'
import { ROSTER_PLAYER_FIELDS } from '@/lib/leagues'
import { getPlayerStatsByTeam, type PlayerStatFromApi } from '@/lib/player-stats'
import { RosterImportDialog } from './RosterImportDialog'
import {
  PlayerDetailDrawer,
  type PlayerFormValues,
} from './PlayerDetailDrawer'
import { downloadRosterPdf } from '@/lib/roster-pdf'
import { downloadRosterExcel } from '@/lib/roster-excel'

type Props = {
  registrationId: string
  editionId?: string
  teamId?: string
  editionName?: string
  teamName?: string
  teamLogoUrl?: string | null
  groupName?: string | null
  city?: string | null
  /** Campos que la edición exige a cada jugador (editions.requiredPlayerFields). */
  requiredPlayerFields?: string[]
}

/**
 * Qué le falta a un jugador según los campos que exige la edición.
 * Mismo criterio que el backend: vacío, null o cadena en blanco = falta.
 */
function missingFields(
  p: RegistrationPlayerFromApi,
  required: string[],
): string[] {
  const value: Record<string, unknown> = {
    firstName: p.firstName, lastName: p.lastName, docNumber: p.docNumber,
    birthDate: p.birthDate, phone: p.phone, email: p.email,
    employer: p.employer, healthProvider: p.healthProvider,
    jerseyNumber: p.jerseyNumber, position: p.position,
    photoFileUrl: p.photoFileUrl, docFileUrl: p.docFileUrl,
    emergencyContactName: p.emergencyContactName,
    emergencyContactPhone: p.emergencyContactPhone,
  }
  return required
    .filter((k) => {
      const v = value[k]
      return v === null || v === undefined || (typeof v === 'string' && !v.trim())
    })
    .map((k) => ROSTER_PLAYER_FIELDS.find((f) => f.key === k)?.label ?? k)
}

export function RosterTab({
  registrationId, editionId, teamId,
  editionName, teamName, teamLogoUrl, groupName, city,
  requiredPlayerFields = [],
}: Props) {
  const [players, setPlayers] = useState<RegistrationPlayerFromApi[]>([])
  const [stats, setStats] = useState<Map<string, PlayerStatFromApi>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<RegistrationPlayerFromApi | null>(null)
  const [creating, setCreating] = useState(false)
  const [importing, setImporting] = useState(false)
  const [addingDirector, setAddingDirector] = useState(false)
  const [downloadingPdf, setDownloadingPdf] = useState(false)
  const [delegates, setDelegates] = useState<TeamDelegate[]>([])
  const delegateByUid = new Map(delegates.map((d) => [d.uid, d]))

  async function handleDownloadPdf() {
    // La planilla es el documento oficial del partido: los dados de baja no van.
    const activos = players.filter((p) => !p.removedAt)
    if (activos.length === 0) return
    setDownloadingPdf(true)
    try {
      await downloadRosterPdf({
        editionName: editionName ?? 'Torneo',
        teamName: teamName ?? 'Equipo',
        teamLogoUrl,
        groupName,
        city,
        players: activos,
        delegates,
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo generar el PDF')
    } finally {
      setDownloadingPdf(false)
    }
  }

  function handleDownloadExcel() {
    const activos = players.filter((p) => !p.removedAt)
    if (activos.length === 0) return
    try {
      downloadRosterExcel({
        editionName: editionName ?? 'Torneo',
        teamName: teamName ?? 'Equipo',
        groupName,
        players: activos,
        delegates,
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo generar el Excel')
    }
  }

  useEffect(() => {
    const promises: Promise<void>[] = [
      getRosterByRegistration(registrationId).then(setPlayers),
      // Best-effort: si falla, la planilla se ve igual sin la marca de delegado.
      getTeamDelegates(registrationId).then(setDelegates).catch(() => setDelegates([])),
    ]
    if (editionId && teamId) {
      promises.push(
        getPlayerStatsByTeam(editionId, teamId)
          .then((rows) => {
            const map = new Map<string, PlayerStatFromApi>()
            for (const r of rows) map.set(r.playerUid, r)
            setStats(map)
          })
          .catch(() => { /* stats are best-effort */ }),
      )
    }
    Promise.all(promises)
      .catch(() => setError('No se pudo cargar la plantilla.'))
      .finally(() => setLoading(false))
  }, [registrationId, editionId, teamId])

  async function handleCreate(values: PlayerFormValues) {
    const playerName = `${values.firstName.trim()} ${values.lastName.trim()}`.trim()
    if (playerName.length < 2) throw new Error('Nombre y apellido son obligatorios.')
    const row = await addRosterPlayer({
      registrationId,
      playerUid: `manual:${crypto.randomUUID()}`,
      playerName,
      firstName: values.firstName.trim() || undefined,
      lastName: values.lastName.trim() || undefined,
      docNumber: values.docNumber.trim() || undefined,
      birthDate: values.birthDate || undefined,
      employer: values.employer.trim() || undefined,
      phone: values.phone.trim() || undefined,
      email: values.email.trim() || undefined,
      healthProvider: values.healthProvider.trim() || undefined,
      jerseyNumber: values.jerseyNumber ? parseInt(values.jerseyNumber) : undefined,
      position: values.position || undefined,
      isCaptain: values.isCaptain,
      emergencyContactName: values.emergencyContactName.trim() || undefined,
      emergencyContactPhone: values.emergencyContactPhone.trim() || undefined,
    })
    // Enforce single captain
    if (row.isCaptain) {
      const previous = players.find((p) => p.isCaptain)
      if (previous) await updateRosterPlayer(previous.id, { isCaptain: false })
      setPlayers((prev) => [...prev.map((p) => p.isCaptain ? { ...p, isCaptain: false } : p), row].sort(sortPlayers))
    } else {
      setPlayers((prev) => [...prev, row].sort(sortPlayers))
    }
    setCreating(false)
  }

  async function handleUpdate(id: string, values: PlayerFormValues) {
    const playerName = `${values.firstName.trim()} ${values.lastName.trim()}`.trim()
    if (playerName.length < 2) throw new Error('Nombre y apellido son obligatorios.')
    const updated = await updateRosterPlayer(id, {
      playerName,
      firstName: values.firstName.trim() || undefined,
      lastName: values.lastName.trim() || undefined,
      docNumber: values.docNumber.trim() || undefined,
      birthDate: values.birthDate || undefined,
      employer: values.employer.trim() || undefined,
      phone: values.phone.trim() || undefined,
      email: values.email.trim() || undefined,
      healthProvider: values.healthProvider.trim() || undefined,
      jerseyNumber: values.jerseyNumber ? parseInt(values.jerseyNumber) : undefined,
      position: values.position || undefined,
      isCaptain: values.isCaptain,
      emergencyContactName: values.emergencyContactName.trim() || undefined,
      emergencyContactPhone: values.emergencyContactPhone.trim() || undefined,
    })
    // Enforce single captain when toggled on
    if (values.isCaptain && !editing?.isCaptain) {
      const previous = players.find((p) => p.isCaptain && p.id !== id)
      if (previous) await updateRosterPlayer(previous.id, { isCaptain: false })
      setPlayers((prev) => prev.map((p) =>
        p.id === id ? updated : (p.isCaptain ? { ...p, isCaptain: false } : p),
      ).sort(sortPlayers))
    } else {
      setPlayers((prev) => prev.map((p) => (p.id === id ? updated : p)).sort(sortPlayers))
    }
    setEditing(null)
  }

  async function handleRemove(id: string) {
    if (!confirm('¿Dar de baja al jugador? Conserva sus datos y sus goles, y puedes reactivarlo.')) return
    await removeRosterPlayer(id)
    // Baja lógica: la fila no desaparece, pasa a la sección "Dados de baja".
    setPlayers((prev) =>
      prev.map((p) => (p.id === id ? { ...p, removedAt: new Date().toISOString() } : p)),
    )
  }

  async function handleRestore(id: string) {
    const updated = await restoreRosterPlayer(id)
    setPlayers((prev) => prev.map((p) => (p.id === id ? updated : p)).sort(sortPlayers))
  }

  async function handleAddDirector() {
    setAddingDirector(true)
    setError(null)
    try {
      const row = await addDirectorAsPlayer(registrationId)
      setPlayers((prev) =>
        prev.some((p) => p.id === row.id) ? prev : [...prev, row].sort(sortPlayers),
      )
    } catch {
      setError('No se pudo agregar al delegado a la plantilla.')
    } finally {
      setAddingDirector(false)
    }
  }

  async function toggleCaptain(row: RegistrationPlayerFromApi) {
    if (!row.isCaptain) {
      const current = players.find((p) => p.isCaptain)
      if (current) await updateRosterPlayer(current.id, { isCaptain: false })
    }
    const updated = await updateRosterPlayer(row.id, { isCaptain: !row.isCaptain })
    setPlayers((prev) => prev.map((p) =>
      p.id === row.id ? updated : (p.id !== row.id && updated.isCaptain ? { ...p, isCaptain: false } : p),
    ))
  }

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 py-16 flex items-center justify-center gap-3 text-slate-400">
        <Loader2 size={18} className="animate-spin" />
        <span className="text-sm">Cargando plantilla...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
        <AlertCircle size={16} /> {error}
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-bold text-slate-900">Plantilla</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {players.length} {players.length === 1 ? 'jugador' : 'jugadores'}
            {players.some((p) => p.isCaptain) && ' · Capitán asignado'}
          </p>
          {delegates.length > 0 && (
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                {delegates.length === 1 ? 'Delegado' : 'Delegados'}
              </span>
              {delegates.map((d) => (
                <span
                  key={d.uid}
                  className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-800"
                  title={d.role === 'principal' ? 'Delegado principal' : 'Delegado adicional'}
                >
                  <ShieldCheck size={11} />
                  {d.name}
                  {d.role === 'principal' && <span className="text-[9px] font-bold uppercase text-sky-600">· principal</span>}
                  {!d.inRoster && <span className="text-[9px] font-medium text-slate-500">· no juega</span>}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleDownloadPdf}
            disabled={downloadingPdf || players.length === 0}
            className="flex items-center gap-2 px-3 py-1.5 bg-white text-slate-700 text-xs font-bold rounded-xl border border-slate-200 hover:bg-slate-50 transition-all disabled:opacity-50"
            title="Descargar la planilla en PDF"
          >
            {downloadingPdf ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />} Planilla PDF
          </button>
          <button
            onClick={handleDownloadExcel}
            disabled={players.length === 0}
            className="flex items-center gap-2 px-3 py-1.5 bg-white text-slate-700 text-xs font-bold rounded-xl border border-slate-200 hover:bg-slate-50 transition-all disabled:opacity-50"
            title="Descargar la planilla en Excel"
          >
            <Download size={12} /> Planilla Excel
          </button>
          <button
            onClick={handleAddDirector}
            disabled={addingDirector}
            className="flex items-center gap-2 px-3 py-1.5 bg-white text-slate-700 text-xs font-bold rounded-xl border border-slate-200 hover:bg-slate-50 transition-all disabled:opacity-50"
            title="Agrega al delegado del equipo como jugador"
          >
            {addingDirector ? <Loader2 size={12} className="animate-spin" /> : <ShieldCheck size={12} />} Delegado
          </button>
          <button
            onClick={() => setImporting(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-white text-slate-700 text-xs font-bold rounded-xl border border-slate-200 hover:bg-slate-50 transition-all"
          >
            <Upload size={12} /> Importar
          </button>
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-green-600 text-white text-xs font-bold rounded-xl hover:bg-green-700 transition-all shadow-sm"
          >
            <Plus size={12} /> Agregar jugador
          </button>
        </div>
      </div>

      {/* List */}
      {players.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16 bg-white rounded-2xl border-2 border-dashed border-slate-200">
          <Users size={26} className="text-slate-300" />
          <p className="text-sm font-semibold text-slate-500">Sin jugadores en la plantilla</p>
          <button
            onClick={() => setCreating(true)}
            className="text-sm font-semibold text-green-700 hover:underline"
          >
            Agregar el primero
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest px-4 py-3 w-16">#</th>
                <th className="text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest px-4 py-3">Jugador</th>
                <th className="text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest px-4 py-3 w-20">POS</th>
                <th className="text-center text-[10px] font-bold text-slate-500 uppercase tracking-widest px-4 py-3 w-16" title="Amarillas">
                  <span className="inline-block w-3 h-4 rounded-sm bg-yellow-400 align-middle" />
                </th>
                <th className="text-center text-[10px] font-bold text-slate-500 uppercase tracking-widest px-4 py-3 w-16" title="Rojas">
                  <span className="inline-block w-3 h-4 rounded-sm bg-red-500 align-middle" />
                </th>
                <th className="text-center text-[10px] font-bold text-slate-500 uppercase tracking-widest px-4 py-3 w-16" title="Walkovers / No presentados">WO</th>
                <th className="text-center text-[10px] font-bold text-slate-500 uppercase tracking-widest px-4 py-3 w-20">Multas</th>
                <th className="text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest px-4 py-3 w-32">Datos</th>
                <th className="text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest px-4 py-3 w-28">Estado</th>
                <th className="text-center text-[10px] font-bold text-slate-500 uppercase tracking-widest px-4 py-3 w-16">Cap.</th>
                <th className="text-right text-[10px] font-bold text-slate-500 uppercase tracking-widest px-4 py-3 w-24">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {players.filter((p) => !p.removedAt).map((p) => (
                <PlayerRow
                  key={p.id}
                  player={p}
                  playerStats={stats.get(p.playerUid)}
                  missing={missingFields(p, requiredPlayerFields)}
                  delegate={delegateByUid.get(p.playerUid)}
                  onEdit={() => setEditing(p)}
                  onRemove={() => handleRemove(p.id)}
                  onToggleCaptain={() => toggleCaptain(p)}
                />
              ))}
              {players.some((p) => p.removedAt) && (
                <>
                  <tr className="bg-slate-50">
                    <td colSpan={11} className="px-4 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                      Dados de baja · no cuentan para el mínimo ni pueden recibir nuevos goles
                    </td>
                  </tr>
                  {players.filter((p) => p.removedAt).map((p) => (
                    <PlayerRow
                      key={p.id}
                      player={p}
                      playerStats={stats.get(p.playerUid)}
                      missing={missingFields(p, requiredPlayerFields)}
                      delegate={delegateByUid.get(p.playerUid)}
                      onEdit={() => setEditing(p)}
                      onRemove={() => handleRestore(p.id)}
                      onToggleCaptain={() => toggleCaptain(p)}
                    />
                  ))}
                </>
              )}
            </tbody>
          </table>
        </div>
      )}

      {(creating || editing) && (
        <PlayerDetailDrawer
          player={editing}
          onClose={() => { setCreating(false); setEditing(null) }}
          onSubmit={async (values) => {
            if (editing) await handleUpdate(editing.id, values)
            else await handleCreate(values)
          }}
        />
      )}

      {importing && (
        <RosterImportDialog
          registrationId={registrationId}
          onClose={() => setImporting(false)}
          onImported={async () => {
            const fresh = await getRosterByRegistration(registrationId)
            setPlayers(fresh)
            setImporting(false)
          }}
        />
      )}
    </div>
  )
}

// ─── Row ─────────────────────────────────────────────────────────────────────

function PlayerRow({
  player, playerStats, missing = [], delegate, onEdit, onRemove, onToggleCaptain,
}: {
  player: RegistrationPlayerFromApi
  /** Si este jugador es delegado del equipo. */
  delegate?: TeamDelegate
  playerStats?: PlayerStatFromApi
  /** Campos obligatorios que le faltan a este jugador. */
  missing?: string[]
  onEdit: () => void
  onRemove: () => Promise<void>
  onToggleCaptain: () => Promise<void>
}) {
  const [busy, setBusy] = useState(false)

  async function run(fn: () => Promise<void>) {
    setBusy(true)
    try { await fn() } finally { setBusy(false) }
  }

  const yellows = playerStats?.yellowCards ?? 0
  const reds = playerStats?.redCards ?? 0
  const walkovers = 0 // Not tracked in player_stats yet
  const finesCount = 0 // Would need fines query per player
  const statusMeta = (reds > 0)
    ? { label: 'Suspendido', bg: 'bg-red-50 border-red-200', text: 'text-red-700', dot: 'bg-red-500' }
    : { label: 'Activo', bg: 'bg-green-50 border-green-200', text: 'text-green-700', dot: 'bg-green-500' }

  return (
    <tr className={clsx(
      'hover:bg-slate-50/50 transition-colors',
      player.removedAt && 'opacity-60 bg-slate-50/40',
    )}>
      {/* # */}
      <td className="px-4 py-3">
        {player.jerseyNumber != null ? (
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold border-2 border-slate-200 bg-white text-slate-700">
            {player.jerseyNumber}
          </span>
        ) : (
          <span className="text-xs text-slate-300">—</span>
        )}
      </td>

      {/* Jugador */}
      <td className="px-4 py-3 min-w-0">
        <button
          onClick={onEdit}
          className="text-left min-w-0 max-w-full"
        >
          <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-900 min-w-0 hover:text-green-700 transition-colors">
            <span className="truncate">{player.playerName}</span>
            {delegate && (
              <span
                className="shrink-0 inline-flex items-center gap-0.5 rounded-full border border-sky-200 bg-sky-50 px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-sky-700"
                title={delegate.role === 'principal' ? 'Delegado principal del equipo' : 'Delegado adicional del equipo'}
              >
                <ShieldCheck size={10} /> Delegado
              </span>
            )}
          </p>
          {player.docNumber && (
            <p className="text-[10px] text-slate-400 font-mono truncate">CC {player.docNumber}</p>
          )}
        </button>
      </td>

      {/* POS */}
      <td className="px-4 py-3">
        {player.position ? (
          <span
            className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-bold text-slate-700 uppercase tracking-wide"
            title={PLAYER_POSITION_LABEL[player.position]}
          >
            {player.position}
          </span>
        ) : (
          <span className="text-xs text-slate-300">—</span>
        )}
      </td>

      {/* Amarillas */}
      <td className="px-4 py-3 text-center">
        <StatCell value={yellows} />
      </td>

      {/* Rojas */}
      <td className="px-4 py-3 text-center">
        <StatCell value={reds} tone="red" />
      </td>

      {/* WO */}
      <td className="px-4 py-3 text-center">
        <StatCell value={walkovers} />
      </td>

      {/* Multas */}
      <td className="px-4 py-3 text-center">
        <StatCell value={finesCount} tone={finesCount > 0 ? 'amber' : 'default'} />
      </td>

      {/* Estado */}
      <td className="px-4 py-3">
        <span className={clsx(
          'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold border',
          statusMeta.bg, statusMeta.text,
        )}>
          <span className={clsx('w-1.5 h-1.5 rounded-full', statusMeta.dot)} />
          {statusMeta.label}
        </span>
      </td>

      {/* Capitán */}
      <td className="px-4 py-3 text-center">
        <button
          onClick={() => run(onToggleCaptain)}
          disabled={busy}
          className={clsx(
            'p-1.5 rounded-lg transition-colors',
            player.isCaptain ? 'text-yellow-500 hover:bg-yellow-50' : 'text-slate-300 hover:bg-slate-100 hover:text-yellow-500',
          )}
          title={player.isCaptain ? 'Quitar capitanía' : 'Hacer capitán'}
        >
          <Crown size={14} fill={player.isCaptain ? 'currentColor' : 'none'} />
        </button>
      </td>

      {/* Datos: completo o qué le falta */}
      <td className="px-4 py-3">
        {missing.length === 0 ? (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-green-700">
            <CheckCircle2 size={13} /> Completo
          </span>
        ) : (
          <span
            className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 cursor-help"
            title={`Falta: ${missing.join(', ')}`}
          >
            <AlertCircle size={13} />
            {missing.length === 1 ? missing[0] : `Faltan ${missing.length}`}
          </span>
        )}
      </td>

      {/* Acciones */}
      <td className="px-4 py-3 text-right">
        <div className="inline-flex items-center gap-1">
          <button
            onClick={onEdit}
            disabled={busy}
            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors disabled:opacity-50"
            title="Editar / Ver detalle"
          >
            <Pencil size={13} />
          </button>
          {player.removedAt ? (
            <button
              onClick={() => run(onRemove)}
              disabled={busy}
              className="p-1.5 rounded-lg text-slate-400 hover:bg-green-50 hover:text-green-700 transition-colors disabled:opacity-50"
              title="Reactivar"
            >
              <RotateCcw size={13} />
            </button>
          ) : (
            <button
              onClick={() => run(onRemove)}
              disabled={busy}
              className="p-1.5 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-50"
              title="Dar de baja"
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </td>
    </tr>
  )
}

function StatCell({ value, tone = 'default' }: { value: number; tone?: 'default' | 'red' | 'amber' }) {
  if (value === 0) return <span className="text-xs text-slate-300">0</span>
  const colors = tone === 'red' ? 'text-red-700 bg-red-50 border-red-200'
    : tone === 'amber' ? 'text-amber-700 bg-amber-50 border-amber-200'
    : 'text-slate-700 bg-slate-100 border-slate-200'
  return (
    <span className={clsx(
      'inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-md border text-[11px] font-bold',
      colors,
    )}>
      {value}
    </span>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sortPlayers(a: RegistrationPlayerFromApi, b: RegistrationPlayerFromApi): number {
  const aj = a.jerseyNumber ?? 9999
  const bj = b.jerseyNumber ?? 9999
  if (aj !== bj) return aj - bj
  return a.playerName.localeCompare(b.playerName)
}

