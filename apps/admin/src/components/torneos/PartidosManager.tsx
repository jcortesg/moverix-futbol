'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  AlertCircle, Calendar, ChevronLeft, Loader2, Shield,
  Wand2, Clock, MapPin, UserCheck, X, Save, Trash2, Pencil, CheckCircle2, Award,
} from 'lucide-react'
import { clsx } from 'clsx'
import { getEdition, getMyOrganization, type EditionFromApi, type OrganizationFromApi } from '@/lib/leagues'
import { getMatchdays, type MatchdayFromApi } from '@/lib/matchdays'
import {
  generateFixture,
  finalizeMatch,
  updateMatch,
  deleteMatch,
  getMatchesByEdition,
  type MatchFromApi,
  type MatchStatus,
} from '@/lib/matches'
import { getGroupsByEdition, type GroupFromApi } from '@/lib/groups'
import { getRegistrationsByEdition, type RegistrationFromApi } from '@/lib/registrations'
import { getVenues, type VenueFromApi } from '@/lib/venues'
import { getReferees, type RefereeFromApi } from '@/lib/referees'
import { Field, inputCls } from '@/components/ui/form'
import { MatchEventsDrawer } from './MatchEventsDrawer'

const STATUS_STYLE: Record<MatchStatus, { label: string; bg: string; text: string; dot: string }> = {
  scheduled: { label: 'Programado', bg: 'bg-slate-50 border-slate-200',  text: 'text-slate-600', dot: 'bg-slate-400' },
  live:      { label: 'En vivo',    bg: 'bg-red-50 border-red-200',      text: 'text-red-700',   dot: 'bg-red-500' },
  finished:  { label: 'Finalizado', bg: 'bg-green-50 border-green-200',  text: 'text-green-700', dot: 'bg-green-500' },
  postponed: { label: 'Aplazado',   bg: 'bg-amber-50 border-amber-200',  text: 'text-amber-700', dot: 'bg-amber-500' },
  cancelled: { label: 'Cancelado',  bg: 'bg-slate-50 border-slate-200',  text: 'text-slate-400', dot: 'bg-slate-300' },
  walkover:  { label: 'W.O.',       bg: 'bg-indigo-50 border-indigo-200', text: 'text-indigo-700', dot: 'bg-indigo-500' },
}

export function PartidosManager({
  editionId,
  backHref,
  backLabel = 'Gestionar',
}: {
  editionId: string
  backHref?: string
  backLabel?: string
}) {
  const [, setOrg] = useState<OrganizationFromApi | null>(null)
  const [edition, setEdition] = useState<EditionFromApi | null>(null)
  const [matchdays, setMatchdays] = useState<MatchdayFromApi[]>([])
  const [matches, setMatches] = useState<MatchFromApi[]>([])
  const [groups, setGroups] = useState<GroupFromApi[]>([])
  const [registrations, setRegistrations] = useState<RegistrationFromApi[]>([])
  const [venues, setVenues] = useState<VenueFromApi[]>([])
  const [referees, setReferees] = useState<RefereeFromApi[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [activeMatchdayId, setActiveMatchdayId] = useState<string | null>(null)
  const [editing, setEditing] = useState<MatchFromApi | null>(null)
  const [finalizing, setFinalizing] = useState<MatchFromApi | null>(null)
  const [eventsFor, setEventsFor] = useState<MatchFromApi | null>(null)

  async function reload() {
    const [mdays, ms, grps, regs] = await Promise.all([
      getMatchdays(editionId),
      getMatchesByEdition(editionId),
      getGroupsByEdition(editionId),
      getRegistrationsByEdition(editionId),
    ])
    setMatchdays(mdays)
    setMatches(ms)
    setGroups(grps)
    setRegistrations(regs)
    if (!activeMatchdayId && mdays.length > 0) setActiveMatchdayId(mdays[0].id)
  }

  useEffect(() => {
    Promise.all([
      getMyOrganization().then(async (o) => {
        setOrg(o)
        if (o) {
          const [v, r] = await Promise.all([getVenues(o.id), getReferees(o.id)])
          setVenues(v)
          setReferees(r)
        }
      }),
      getEdition(editionId).then(setEdition),
      reload(),
    ])
      .catch(() => setError('No se pudieron cargar los partidos.'))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editionId])

  const teamMap = useMemo(() => {
    const m = new Map<string, RegistrationFromApi['team']>()
    for (const r of registrations) m.set(r.teamId, r.team)
    return m
  }, [registrations])

  const groupMap = useMemo(() => {
    const m = new Map<string, GroupFromApi>()
    for (const g of groups) m.set(g.id, g)
    return m
  }, [groups])

  const venueMap = useMemo(() => {
    const m = new Map<string, VenueFromApi>()
    for (const v of venues) m.set(v.id, v)
    return m
  }, [venues])

  const refereeMap = useMemo(() => {
    const m = new Map<string, RefereeFromApi>()
    for (const r of referees) m.set(r.id, r)
    return m
  }, [referees])

  const activeMatchday = matchdays.find((m) => m.id === activeMatchdayId) ?? null
  const activeMatches = matches
    .filter((m) => m.matchdayId === activeMatchdayId)
    .sort((a, b) => {
      const aGroup = a.groupId ? (groupMap.get(a.groupId)?.code ?? '') : ''
      const bGroup = b.groupId ? (groupMap.get(b.groupId)?.code ?? '') : ''
      return aGroup.localeCompare(bGroup)
    })

  // Group matches by group within the matchday
  const matchesByGroup = useMemo(() => {
    const m = new Map<string | null, MatchFromApi[]>()
    for (const match of activeMatches) {
      const key = match.groupId
      if (!m.has(key)) m.set(key, [])
      m.get(key)!.push(match)
    }
    return m
  }, [activeMatches])

  async function run<T>(key: string, fn: () => Promise<T>): Promise<T | undefined> {
    setBusy(key)
    setError(null)
    try {
      return await fn()
    } catch (err) {
      setError(extractError(err) ?? 'Algo salió mal.')
      return undefined
    } finally {
      setBusy(null)
    }
  }

  async function handleGenerate(force = false) {
    if (!force && matchdays.length > 0) {
      if (!confirm('Ya existe un fixture. ¿Regenerar? Se perderán los partidos actuales.')) return
      force = true
    } else if (!force) {
      if (!confirm('Esto generará el fixture automáticamente desde los grupos. ¿Continuar?')) return
    }
    await run('generate', async () => {
      await generateFixture(editionId, force)
      await reload()
    })
  }

  async function handleSchedule(match: MatchFromApi, patch: Parameters<typeof updateMatch>[1]) {
    const updated = await updateMatch(match.id, patch)
    setMatches((prev) => prev.map((m) => (m.id === match.id ? { ...m, ...updated } : m)))
  }

  async function handleFinalize(match: MatchFromApi, dto: { homeScore: number; awayScore: number }) {
    const updated = await finalizeMatch(match.id, dto)
    setMatches((prev) => prev.map((m) => (m.id === match.id ? { ...m, ...updated } : m)))
  }

  async function handleDelete(match: MatchFromApi) {
    if (!confirm('¿Eliminar este partido?')) return
    await deleteMatch(match.id)
    setMatches((prev) => prev.filter((m) => m.id !== match.id))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-3 py-32 text-slate-400">
        <Loader2 size={22} className="animate-spin" />
        <span className="text-sm">Cargando partidos...</span>
      </div>
    )
  }

  if (error && !edition) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
        <AlertCircle size={16} /> {error}
      </div>
    )
  }

  return (
    <div>
      {/* Top bar */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <Link
          href={backHref ?? `/torneos/edicion/${editionId}/gestionar`}
          className="flex items-center gap-1 text-sm text-slate-400 hover:text-slate-700 transition-colors"
        >
          <ChevronLeft size={15} />
          <span>{backLabel}</span>
        </Link>
        <span className="text-slate-300">/</span>
        <span className="text-sm font-semibold text-slate-900">Partidos</span>
        <div className="flex-1" />

        <button
          onClick={() => handleGenerate(matchdays.length > 0)}
          disabled={busy === 'generate'}
          className={clsx(
            'flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-50',
            matchdays.length > 0
              ? 'border border-slate-200 text-slate-700 hover:bg-slate-50'
              : 'bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100',
          )}
        >
          {busy === 'generate' ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />}
          {matchdays.length > 0 ? 'Regenerar fixture' : 'Generar fixture'}
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600 mb-4">
          <AlertCircle size={12} /> {error}
        </div>
      )}

      {matchdays.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-20 bg-white rounded-2xl border-2 border-dashed border-slate-200">
          <Calendar size={28} className="text-slate-300" />
          <p className="text-sm font-semibold text-slate-500">No hay partidos programados</p>
          <p className="text-xs text-slate-400 max-w-sm text-center">
            Genera el fixture automáticamente desde los grupos. Necesitas tener equipos aprobados asignados a grupos.
          </p>
          <button
            onClick={() => handleGenerate()}
            disabled={busy === 'generate'}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 border border-indigo-200 text-xs font-bold text-indigo-700 hover:bg-indigo-100 transition-colors disabled:opacity-50 mt-2"
          >
            <Wand2 size={12} /> Generar fixture
          </button>
        </div>
      ) : (
        <>
          {/* Matchday selector */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3 mb-5">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {matchdays.map((md) => {
                const total = matches.filter((m) => m.matchdayId === md.id).length
                const finished = matches.filter((m) => m.matchdayId === md.id && m.status === 'finished').length
                return (
                  <button
                    key={md.id}
                    onClick={() => setActiveMatchdayId(md.id)}
                    className={clsx(
                      'flex flex-col items-center gap-0.5 px-4 py-2 rounded-lg whitespace-nowrap transition-all flex-shrink-0',
                      activeMatchdayId === md.id
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-50 text-slate-600 hover:bg-slate-100',
                    )}
                  >
                    <span className="text-xs font-bold">J{md.number}</span>
                    <span className={clsx(
                      'text-[10px] font-semibold',
                      activeMatchdayId === md.id ? 'text-slate-300' : 'text-slate-400',
                    )}>
                      {finished}/{total}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Matches list */}
          {activeMatchday && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-bold text-slate-900">{activeMatchday.name}</h2>
                <span className="text-xs text-slate-500">
                  {activeMatches.length} {activeMatches.length === 1 ? 'partido' : 'partidos'}
                </span>
              </div>

              {Array.from(matchesByGroup.entries()).map(([groupId, list]) => {
                const group = groupId ? groupMap.get(groupId) : null
                return (
                  <div key={groupId ?? 'no-group'} className="mb-5">
                    {group && (
                      <div className="flex items-center gap-2 mb-2">
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-indigo-50 border border-indigo-200 text-[11px] font-bold text-indigo-700">
                          {group.code}
                        </span>
                        <p className="text-xs font-bold text-slate-700 uppercase tracking-wide">{group.name}</p>
                      </div>
                    )}
                    <div className="space-y-2">
                      {list.map((match) => (
                        <MatchCard
                          key={match.id}
                          match={match}
                          home={match.homeTeamId ? teamMap.get(match.homeTeamId) : undefined}
                          away={match.awayTeamId ? teamMap.get(match.awayTeamId) : undefined}
                          venue={match.venueId ? venueMap.get(match.venueId) : undefined}
                          referee={match.refereeId ? refereeMap.get(match.refereeId) : undefined}
                          onEdit={() => setEditing(match)}
                          onFinalize={() => setFinalizing(match)}
                          onEvents={() => setEventsFor(match)}
                          onDelete={() => handleDelete(match)}
                        />
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {editing && (
        <ScheduleDialog
          match={editing}
          venues={venues}
          referees={referees}
          home={editing.homeTeamId ? teamMap.get(editing.homeTeamId) : undefined}
          away={editing.awayTeamId ? teamMap.get(editing.awayTeamId) : undefined}
          onClose={() => setEditing(null)}
          onSubmit={async (patch) => {
            await handleSchedule(editing, patch)
            setEditing(null)
          }}
        />
      )}

      {finalizing && (
        <FinalizeDialog
          match={finalizing}
          home={finalizing.homeTeamId ? teamMap.get(finalizing.homeTeamId) : undefined}
          away={finalizing.awayTeamId ? teamMap.get(finalizing.awayTeamId) : undefined}
          onClose={() => setFinalizing(null)}
          onSubmit={async (dto) => {
            await handleFinalize(finalizing, dto)
            setFinalizing(null)
          }}
        />
      )}

      {eventsFor && (
        <MatchEventsDrawer
          match={eventsFor}
          editionId={editionId}
          onClose={() => setEventsFor(null)}
        />
      )}
    </div>
  )
}

// ─── Match card ──────────────────────────────────────────────────────────────

function MatchCard({
  match, home, away, venue, referee, onEdit, onFinalize, onEvents, onDelete,
}: {
  match: MatchFromApi
  home?: RegistrationFromApi['team']
  away?: RegistrationFromApi['team']
  venue?: VenueFromApi
  referee?: RefereeFromApi
  onEdit: () => void
  onFinalize: () => void
  onEvents: () => void
  onDelete: () => void
}) {
  const status = STATUS_STYLE[match.status]
  const isFinished = match.status === 'finished'

  return (
    <div className="bg-white rounded-xl border border-slate-200 hover:border-slate-300 transition-colors overflow-hidden">
      <div className="px-4 py-3 flex items-center gap-3">
        {/* Home team */}
        <div className="flex-1 flex items-center gap-2 justify-end min-w-0">
          <span className={clsx(
            'text-sm font-semibold truncate',
            isFinished && (match.homeScore ?? 0) > (match.awayScore ?? 0) ? 'text-slate-900' : 'text-slate-700',
          )}>
            {home?.name ?? <span className="italic text-slate-400">TBD</span>}
          </span>
          <TeamBadge team={home} />
        </div>

        {/* Score / vs */}
        <div className="flex-shrink-0 min-w-[80px] flex items-center justify-center">
          {isFinished ? (
            <div className="flex items-center gap-2">
              <span className={clsx(
                'text-lg font-bold tabular-nums',
                (match.homeScore ?? 0) > (match.awayScore ?? 0) ? 'text-slate-900' : 'text-slate-500',
              )}>
                {match.homeScore}
              </span>
              <span className="text-slate-300">-</span>
              <span className={clsx(
                'text-lg font-bold tabular-nums',
                (match.awayScore ?? 0) > (match.homeScore ?? 0) ? 'text-slate-900' : 'text-slate-500',
              )}>
                {match.awayScore}
              </span>
            </div>
          ) : (
            <span className="text-xs font-semibold text-slate-400">vs</span>
          )}
        </div>

        {/* Away team */}
        <div className="flex-1 flex items-center gap-2 min-w-0">
          <TeamBadge team={away} />
          <span className={clsx(
            'text-sm font-semibold truncate',
            isFinished && (match.awayScore ?? 0) > (match.homeScore ?? 0) ? 'text-slate-900' : 'text-slate-700',
          )}>
            {away?.name ?? <span className="italic text-slate-400">TBD</span>}
          </span>
        </div>
      </div>

      {/* Meta */}
      <div className="px-4 py-2 border-t border-slate-100 bg-slate-50/50 flex items-center gap-3 flex-wrap">
        <span className={clsx('inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold border', status.bg, status.text)}>
          <span className={clsx('w-1 h-1 rounded-full', status.dot)} />
          {status.label}
        </span>
        {match.scheduledAt && (
          <span className="inline-flex items-center gap-1 text-[10px] text-slate-500">
            <Clock size={10} />
            {new Date(match.scheduledAt).toLocaleString('es-CO', {
              dateStyle: 'short', timeStyle: 'short',
            })}
          </span>
        )}
        {venue && (
          <span className="inline-flex items-center gap-1 text-[10px] text-slate-500">
            <MapPin size={10} />
            {venue.name}
          </span>
        )}
        {referee && (
          <span className="inline-flex items-center gap-1 text-[10px] text-slate-500">
            <UserCheck size={10} />
            {referee.fullName}
          </span>
        )}
        <div className="flex-1" />
        {!isFinished && (
          <button
            onClick={onFinalize}
            className="flex items-center gap-1 text-[11px] font-bold text-green-700 hover:text-green-800 transition-colors"
          >
            <CheckCircle2 size={11} /> Cargar resultado
          </button>
        )}
        <button
          onClick={onEvents}
          className="flex items-center gap-1 text-[11px] font-semibold text-indigo-700 hover:text-indigo-800 transition-colors"
          title="Eventos del partido"
        >
          <Award size={11} /> Eventos
        </button>
        <button
          onClick={onEdit}
          className="p-1 rounded text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition-colors"
          title="Programar"
        >
          <Pencil size={12} />
        </button>
        <button
          onClick={onDelete}
          className="p-1 rounded text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
          title="Eliminar"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  )
}

function TeamBadge({ team }: { team?: RegistrationFromApi['team'] }) {
  if (!team) {
    return <div className="w-7 h-7 rounded-md border border-slate-200 bg-slate-50 flex-shrink-0" />
  }
  if (team.logoUrl) {
    return (
      /* eslint-disable-next-line @next/next/no-img-element */
      <img src={team.logoUrl} alt="" className="w-7 h-7 rounded-md object-cover border border-slate-200 flex-shrink-0" />
    )
  }
  return (
    <div
      className="w-7 h-7 rounded-md border border-slate-200 flex items-center justify-center flex-shrink-0"
      style={team.primaryColor ? { background: `${team.primaryColor}18` } : undefined}
    >
      <Shield size={11} style={{ color: team.primaryColor ?? '#94a3b8' }} />
    </div>
  )
}

// ─── Schedule dialog ─────────────────────────────────────────────────────────

function ScheduleDialog({
  match, venues, referees, home, away, onClose, onSubmit,
}: {
  match: MatchFromApi
  venues: VenueFromApi[]
  referees: RefereeFromApi[]
  home?: RegistrationFromApi['team']
  away?: RegistrationFromApi['team']
  onClose: () => void
  onSubmit: (patch: Parameters<typeof updateMatch>[1]) => Promise<void>
}) {
  const [scheduledAt, setScheduledAt] = useState(
    match.scheduledAt ? new Date(match.scheduledAt).toISOString().slice(0, 16) : '',
  )
  const [venueId, setVenueId] = useState(match.venueId ?? '')
  const [refereeId, setRefereeId] = useState(match.refereeId ?? '')
  const [status, setStatus] = useState<MatchStatus>(match.status)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await onSubmit({
        scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
        venueId: venueId || undefined,
        refereeId: refereeId || undefined,
        status,
      })
    } catch (err) {
      setError(extractError(err) ?? 'No se pudo guardar.')
      setSubmitting(false)
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={submitting ? undefined : onClose} />
      <aside className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl z-50 flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h2 className="text-base font-bold text-slate-900">Programar partido</h2>
          <button onClick={onClose} disabled={submitting} className="text-slate-400 hover:text-slate-700 transition-colors disabled:opacity-50">
            <X size={18} />
          </button>
        </div>

        <div className="px-5 pt-4 pb-3 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="font-semibold text-slate-700 flex-1 text-right truncate">{home?.name ?? 'TBD'}</span>
            <span className="text-xs text-slate-400">vs</span>
            <span className="font-semibold text-slate-700 flex-1 truncate">{away?.name ?? 'TBD'}</span>
          </div>
        </div>

        <form onSubmit={submit} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <Field label="Fecha y hora">
            <input type="datetime-local" className={inputCls} value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
          </Field>

          <Field label="Cancha">
            <select className={inputCls} value={venueId} onChange={(e) => setVenueId(e.target.value)}>
              <option value="">— Sin asignar —</option>
              {venues.map((v) => (
                <option key={v.id} value={v.id}>{v.name}{v.pitchCount > 1 ? ` (${v.pitchCount} canchas)` : ''}</option>
              ))}
            </select>
          </Field>

          <Field label="Árbitro">
            <select className={inputCls} value={refereeId} onChange={(e) => setRefereeId(e.target.value)}>
              <option value="">— Sin asignar —</option>
              {referees.map((r) => (
                <option key={r.id} value={r.id}>{r.fullName}</option>
              ))}
            </select>
          </Field>

          <Field label="Estado">
            <select className={inputCls} value={status} onChange={(e) => setStatus(e.target.value as MatchStatus)}>
              <option value="scheduled">Programado</option>
              <option value="postponed">Aplazado</option>
              <option value="cancelled">Cancelado</option>
              <option value="walkover">W.O. (no presentación)</option>
            </select>
          </Field>

          {error && (
            <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
              <AlertCircle size={12} /> {error}
            </div>
          )}
        </form>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-slate-200 bg-slate-50">
          <button type="button" onClick={onClose} disabled={submitting}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-50">
            Cancelar
          </button>
          <button type="button" onClick={submit as unknown as () => void} disabled={submitting}
            className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white text-xs font-bold rounded-lg hover:bg-green-700 disabled:opacity-60 transition-colors">
            {submitting ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
            Guardar
          </button>
        </div>
      </aside>
    </>
  )
}

// ─── Finalize dialog ──────────────────────────────────────────────────────────

function FinalizeDialog({
  match, home, away, onClose, onSubmit,
}: {
  match: MatchFromApi
  home?: RegistrationFromApi['team']
  away?: RegistrationFromApi['team']
  onClose: () => void
  onSubmit: (dto: { homeScore: number; awayScore: number }) => Promise<void>
}) {
  const [homeScore, setHomeScore] = useState(match.homeScore?.toString() ?? '0')
  const [awayScore, setAwayScore] = useState(match.awayScore?.toString() ?? '0')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const hs = parseInt(homeScore)
    const as = parseInt(awayScore)
    if (!Number.isFinite(hs) || !Number.isFinite(as) || hs < 0 || as < 0) {
      setError('Marcador inválido.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await onSubmit({ homeScore: hs, awayScore: as })
    } catch (err) {
      setError(extractError(err) ?? 'No se pudo guardar.')
      setSubmitting(false)
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={submitting ? undefined : onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <form onSubmit={submit} className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200">
            <h2 className="text-base font-bold text-slate-900">Cargar resultado</h2>
          </div>
          <div className="px-5 py-5 space-y-4">
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
              <div className="text-center">
                <p className="text-xs text-slate-500 mb-2 truncate">{home?.name ?? 'Local'}</p>
                <input
                  type="number" min={0}
                  autoFocus
                  className="w-full text-center text-2xl font-bold rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-green-500 focus:bg-white focus:ring-2 focus:ring-green-500/20"
                  value={homeScore}
                  onChange={(e) => setHomeScore(e.target.value)}
                />
              </div>
              <span className="text-xl font-bold text-slate-300 mt-7">-</span>
              <div className="text-center">
                <p className="text-xs text-slate-500 mb-2 truncate">{away?.name ?? 'Visitante'}</p>
                <input
                  type="number" min={0}
                  className="w-full text-center text-2xl font-bold rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-green-500 focus:bg-white focus:ring-2 focus:ring-green-500/20"
                  value={awayScore}
                  onChange={(e) => setAwayScore(e.target.value)}
                />
              </div>
            </div>
            {error && (
              <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
                <AlertCircle size={12} /> {error}
              </div>
            )}
          </div>
          <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-slate-200 bg-slate-50">
            <button type="button" onClick={onClose} disabled={submitting}
              className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-50">
              Cancelar
            </button>
            <button type="submit" disabled={submitting}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-green-600 text-white text-xs font-bold rounded-lg hover:bg-green-700 disabled:opacity-60 transition-colors">
              {submitting ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
              Finalizar partido
            </button>
          </div>
        </form>
      </div>
    </>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractError(err: unknown): string | null {
  if (typeof err !== 'object' || err === null) return null
  const maybeAxios = err as { response?: { data?: { message?: string | string[] } } }
  const msg = maybeAxios.response?.data?.message
  if (!msg) return null
  return Array.isArray(msg) ? msg[0] ?? null : msg
}

