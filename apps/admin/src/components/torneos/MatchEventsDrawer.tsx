'use client'

import { useEffect, useState } from 'react'
import {
  AlertCircle, Award, Loader2, Plus, Shield, Trash2, Goal, X,
  Square, RefreshCw,
} from 'lucide-react'
import { clsx } from 'clsx'
import {
  getEventsByMatch,
  createMatchEvent,
  deleteMatchEvent,
  setMvp,
  clearMvp,
  EVENT_TYPE_LABEL,
  type EventType,
  type MatchEventFromApi,
} from '@/lib/match-events'
import {
  getRosterByRegistration,
  type RegistrationPlayerFromApi,
} from '@/lib/registration-players'
import {
  getRegistrationsByEdition,
  type RegistrationFromApi,
} from '@/lib/registrations'
import type { MatchFromApi } from '@/lib/matches'
import { Field, inputCls } from '@/components/ui/form'

type TeamRoster = {
  registration: RegistrationFromApi
  players: RegistrationPlayerFromApi[]
}

export function MatchEventsDrawer({
  match,
  editionId,
  onClose,
  onChanged,
}: {
  match: MatchFromApi
  editionId: string
  onClose: () => void
  onChanged?: () => void
}) {
  const [events, setEvents] = useState<MatchEventFromApi[]>([])
  const [home, setHome] = useState<TeamRoster | null>(null)
  const [away, setAway] = useState<TeamRoster | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function reload() {
    setEvents(await getEventsByMatch(match.id))
  }

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [evs, regs] = await Promise.all([
          getEventsByMatch(match.id),
          getRegistrationsByEdition(editionId),
        ])
        if (cancelled) return
        setEvents(evs)

        const homeReg = regs.find((r) => r.teamId === match.homeTeamId)
        const awayReg = regs.find((r) => r.teamId === match.awayTeamId)
        const [homePlayers, awayPlayers] = await Promise.all([
          homeReg ? getRosterByRegistration(homeReg.id) : Promise.resolve([] as RegistrationPlayerFromApi[]),
          awayReg ? getRosterByRegistration(awayReg.id) : Promise.resolve([] as RegistrationPlayerFromApi[]),
        ])
        if (cancelled) return
        if (homeReg) setHome({ registration: homeReg, players: homePlayers })
        if (awayReg) setAway({ registration: awayReg, players: awayPlayers })
      } catch {
        if (!cancelled) setError('No se pudo cargar el partido.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match.id])

  async function handleCreate(eventType: EventType, teamSide: 'home' | 'away', dto: {
    playerUid?: string; playerName?: string; minute?: number
    assistPlayerUid?: string; assistPlayerName?: string
  }) {
    const teamId = teamSide === 'home' ? match.homeTeamId! : match.awayTeamId!
    await createMatchEvent({ matchId: match.id, teamId, eventType, ...dto })
    await reload()
    onChanged?.()
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar este evento?')) return
    await deleteMatchEvent(id)
    await reload()
    onChanged?.()
  }

  async function handleSetMvp(teamSide: 'home' | 'away', player: RegistrationPlayerFromApi) {
    const teamId = teamSide === 'home' ? match.homeTeamId! : match.awayTeamId!
    await setMvp(match.id, teamId, player.playerUid, player.playerName)
    await reload()
    onChanged?.()
  }

  async function handleClearMvp() {
    if (!confirm('¿Quitar el MVP del partido?')) return
    await clearMvp(match.id)
    await reload()
    onChanged?.()
  }

  const goals = events.filter((e) => e.eventType === 'goal' || e.eventType === 'own_goal' || e.eventType === 'penalty_scored')
  const cards = events.filter((e) => e.eventType === 'yellow_card' || e.eventType === 'red_card')
  const subs = events.filter((e) => e.eventType === 'substitution')
  const mvp = events.find((e) => e.eventType === 'mvp')

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      <aside className="fixed right-0 top-0 h-full w-full max-w-2xl bg-white shadow-2xl z-50 flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-base font-bold text-slate-900">Eventos del partido</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {home?.registration.team.name ?? 'Local'} vs {away?.registration.team.name ?? 'Visitante'}
              {match.status === 'finished' && (
                <> · <span className="font-bold text-slate-700">{match.homeScore ?? 0}-{match.awayScore ?? 0}</span></>
              )}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-slate-400">
              <Loader2 size={16} className="animate-spin" />
              <span className="text-sm">Cargando...</span>
            </div>
          ) : error ? (
            <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
              <AlertCircle size={12} /> {error}
            </div>
          ) : (
            <>
              {/* MVP */}
              <Section title="MVP del partido" icon={Award} iconColor="text-yellow-500">
                <MvpPicker
                  mvp={mvp}
                  home={home}
                  away={away}
                  onSet={handleSetMvp}
                  onClear={handleClearMvp}
                />
              </Section>

              {/* Goals */}
              <Section title={`Goles (${goals.length})`} icon={Goal} iconColor="text-green-600">
                <EventCreator
                  type="goal"
                  home={home}
                  away={away}
                  showAssist
                  onCreate={handleCreate}
                />
                <EventList
                  events={goals}
                  homeTeamId={match.homeTeamId}
                  homeName={home?.registration.team.name}
                  awayName={away?.registration.team.name}
                  onDelete={handleDelete}
                  showAssist
                />
              </Section>

              {/* Cards */}
              <Section title={`Tarjetas (${cards.length})`} icon={Square} iconColor="text-amber-500">
                <EventCreator
                  type="yellow_card"
                  home={home}
                  away={away}
                  allowedTypes={['yellow_card', 'red_card']}
                  onCreate={handleCreate}
                />
                <EventList
                  events={cards}
                  homeTeamId={match.homeTeamId}
                  homeName={home?.registration.team.name}
                  awayName={away?.registration.team.name}
                  onDelete={handleDelete}
                />
              </Section>

              {/* Substitutions */}
              <Section title={`Sustituciones (${subs.length})`} icon={RefreshCw} iconColor="text-blue-600">
                <EventCreator
                  type="substitution"
                  home={home}
                  away={away}
                  showAssist
                  assistLabel="Entra"
                  playerLabel="Sale"
                  onCreate={handleCreate}
                />
                <EventList
                  events={subs}
                  homeTeamId={match.homeTeamId}
                  homeName={home?.registration.team.name}
                  awayName={away?.registration.team.name}
                  onDelete={handleDelete}
                  showAssist
                  assistLabel="Entra"
                  playerLabel="Sale"
                />
              </Section>
            </>
          )}
        </div>
      </aside>
    </>
  )
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({
  title, icon: Icon, iconColor, children,
}: {
  title: string
  icon: React.ElementType
  iconColor: string
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Icon size={14} className={iconColor} />
        <p className="text-xs font-bold text-slate-700 uppercase tracking-wide">{title}</p>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  )
}

// ─── MVP picker ──────────────────────────────────────────────────────────────

function MvpPicker({
  mvp, home, away, onSet, onClear,
}: {
  mvp: MatchEventFromApi | undefined
  home: TeamRoster | null
  away: TeamRoster | null
  onSet: (side: 'home' | 'away', player: RegistrationPlayerFromApi) => Promise<void>
  onClear: () => Promise<void>
}) {
  const [busy, setBusy] = useState(false)
  const [side, setSide] = useState<'home' | 'away'>('home')
  const [playerId, setPlayerId] = useState('')

  const players = side === 'home' ? home?.players ?? [] : away?.players ?? []

  async function run(fn: () => Promise<void>) {
    setBusy(true)
    try { await fn() } finally { setBusy(false) }
  }

  async function assign(e: React.FormEvent) {
    e.preventDefault()
    const player = players.find((p) => p.id === playerId)
    if (!player) return
    await run(() => onSet(side, player))
    setPlayerId('')
  }

  if (mvp) {
    return (
      <div className="flex items-center gap-3 p-3 rounded-xl border border-yellow-200 bg-yellow-50">
        <div className="w-9 h-9 rounded-full bg-yellow-100 border border-yellow-300 flex items-center justify-center flex-shrink-0">
          <Award size={16} className="text-yellow-600" fill="currentColor" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-yellow-900 truncate">{mvp.playerName}</p>
          <p className="text-[10px] text-yellow-700">
            {mvp.teamId === home?.registration.teamId
              ? home?.registration.team.name
              : away?.registration.team.name}
          </p>
        </div>
        <button
          onClick={() => run(onClear)}
          disabled={busy}
          className="p-1.5 rounded-lg text-yellow-700 hover:bg-yellow-100 transition-colors disabled:opacity-50"
          title="Quitar MVP"
        >
          <Trash2 size={13} />
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={assign} className="flex items-end gap-2">
      <div className="w-32">
        <Field label="Equipo">
          <select className={inputCls} value={side} onChange={(e) => { setSide(e.target.value as 'home' | 'away'); setPlayerId('') }}>
            <option value="home">{home?.registration.team.name ?? 'Local'}</option>
            <option value="away">{away?.registration.team.name ?? 'Visitante'}</option>
          </select>
        </Field>
      </div>
      <div className="flex-1">
        <Field label="Jugador">
          <select
            className={inputCls}
            value={playerId}
            onChange={(e) => setPlayerId(e.target.value)}
            disabled={players.length === 0}
          >
            <option value="">{players.length === 0 ? 'Sin jugadores' : '— Selecciona —'}</option>
            {players.map((p) => (
              <option key={p.id} value={p.id}>
                {p.jerseyNumber != null ? `#${p.jerseyNumber} · ` : ''}{p.playerName}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <button
        type="submit"
        disabled={busy || !playerId}
        className="flex items-center gap-1.5 px-3 py-2 bg-yellow-500 text-white text-xs font-bold rounded-lg hover:bg-yellow-600 disabled:opacity-50 transition-colors"
      >
        {busy ? <Loader2 size={12} className="animate-spin" /> : <Award size={12} />}
        Asignar MVP
      </button>
    </form>
  )
}

// ─── Event creator (compact form) ────────────────────────────────────────────

function EventCreator({
  type, home, away, showAssist = false, allowedTypes,
  playerLabel = 'Jugador', assistLabel = 'Asistente',
  onCreate,
}: {
  type: EventType
  home: TeamRoster | null
  away: TeamRoster | null
  showAssist?: boolean
  allowedTypes?: EventType[]
  playerLabel?: string
  assistLabel?: string
  onCreate: (
    eventType: EventType,
    side: 'home' | 'away',
    dto: {
      playerUid?: string; playerName?: string; minute?: number
      assistPlayerUid?: string; assistPlayerName?: string
    },
  ) => Promise<void>
}) {
  const [side, setSide] = useState<'home' | 'away'>('home')
  const [playerId, setPlayerId] = useState('')
  const [assistId, setAssistId] = useState('')
  const [minute, setMinute] = useState('')
  const [eventType, setEventType] = useState<EventType>(type)
  const [busy, setBusy] = useState(false)

  const players = side === 'home' ? home?.players ?? [] : away?.players ?? []

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const player = players.find((p) => p.id === playerId)
    if (!player) return
    setBusy(true)
    try {
      const assist = assistId ? players.find((p) => p.id === assistId) : null
      await onCreate(eventType, side, {
        playerUid: player.playerUid,
        playerName: player.playerName,
        minute: minute ? parseInt(minute) : undefined,
        assistPlayerUid: assist?.playerUid,
        assistPlayerName: assist?.playerName,
      })
      setPlayerId('')
      setAssistId('')
      setMinute('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="rounded-xl border border-dashed border-slate-200 p-3 bg-slate-50/50">
      <div className="grid grid-cols-[110px_1fr_1fr_70px_auto] gap-2 items-end">
        <Field label="Equipo">
          <select className={inputCls} value={side} onChange={(e) => { setSide(e.target.value as 'home' | 'away'); setPlayerId(''); setAssistId('') }}>
            <option value="home">{home?.registration.team.name ?? 'Local'}</option>
            <option value="away">{away?.registration.team.name ?? 'Visitante'}</option>
          </select>
        </Field>

        {allowedTypes && allowedTypes.length > 1 ? (
          <Field label="Tipo">
            <select className={inputCls} value={eventType} onChange={(e) => setEventType(e.target.value as EventType)}>
              {allowedTypes.map((t) => (
                <option key={t} value={t}>{EVENT_TYPE_LABEL[t]}</option>
              ))}
            </select>
          </Field>
        ) : (
          <Field label={playerLabel}>
            <select className={inputCls} value={playerId} onChange={(e) => setPlayerId(e.target.value)} disabled={players.length === 0}>
              <option value="">{players.length === 0 ? 'Sin jugadores' : '— Selecciona —'}</option>
              {players.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.jerseyNumber != null ? `#${p.jerseyNumber} · ` : ''}{p.playerName}
                </option>
              ))}
            </select>
          </Field>
        )}

        {allowedTypes && allowedTypes.length > 1 ? (
          <Field label={playerLabel}>
            <select className={inputCls} value={playerId} onChange={(e) => setPlayerId(e.target.value)} disabled={players.length === 0}>
              <option value="">{players.length === 0 ? 'Sin jugadores' : '— Selecciona —'}</option>
              {players.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.jerseyNumber != null ? `#${p.jerseyNumber} · ` : ''}{p.playerName}
                </option>
              ))}
            </select>
          </Field>
        ) : showAssist ? (
          <Field label={assistLabel}>
            <select className={inputCls} value={assistId} onChange={(e) => setAssistId(e.target.value)} disabled={players.length === 0}>
              <option value="">— Ninguno —</option>
              {players.filter((p) => p.id !== playerId).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.jerseyNumber != null ? `#${p.jerseyNumber} · ` : ''}{p.playerName}
                </option>
              ))}
            </select>
          </Field>
        ) : <div />}

        <Field label="Min">
          <input type="number" min={0} max={200} className={inputCls} value={minute} onChange={(e) => setMinute(e.target.value)} placeholder="—" />
        </Field>

        <button
          type="submit"
          disabled={busy || !playerId}
          className="h-[42px] flex items-center gap-1 px-3 bg-slate-900 text-white text-xs font-bold rounded-xl hover:bg-slate-800 disabled:opacity-50 transition-colors"
        >
          {busy ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
        </button>
      </div>
    </form>
  )
}

// ─── Event list ──────────────────────────────────────────────────────────────

function EventList({
  events, homeTeamId, homeName, awayName, onDelete,
  showAssist = false, playerLabel, assistLabel,
}: {
  events: MatchEventFromApi[]
  homeTeamId: string | null
  homeName?: string
  awayName?: string
  onDelete: (id: string) => Promise<void>
  showAssist?: boolean
  playerLabel?: string
  assistLabel?: string
}) {
  if (events.length === 0) {
    return <p className="text-xs text-slate-400 italic px-1">Sin eventos.</p>
  }

  return (
    <div className="space-y-1.5">
      {events.map((e) => {
        const side = e.teamId === homeTeamId ? 'home' : 'away'
        const teamName = side === 'home' ? homeName : awayName
        return (
          <div key={e.id} className="group flex items-center gap-3 px-3 py-2 rounded-lg bg-white border border-slate-200 hover:border-slate-300 transition-colors">
            <span className={clsx(
              'inline-flex items-center justify-center w-9 h-7 rounded text-[11px] font-mono font-bold',
              e.eventType === 'yellow_card' ? 'bg-amber-100 text-amber-700' :
              e.eventType === 'red_card' ? 'bg-red-100 text-red-700' :
              e.eventType === 'own_goal' ? 'bg-orange-100 text-orange-700' :
              'bg-slate-100 text-slate-600',
            )}>
              {e.minute != null ? `${e.minute}'` : '—'}
            </span>
            <Shield size={12} className="text-slate-300 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-900 truncate">
                {playerLabel && playerLabel !== 'Jugador' && <span className="text-[10px] font-bold text-slate-400 uppercase mr-1.5">{playerLabel}:</span>}
                {e.playerName ?? <span className="italic text-slate-400">Sin jugador</span>}
              </p>
              <p className="text-[10px] text-slate-400 truncate">
                {teamName}
                {e.eventType === 'own_goal' && ' · Autogol'}
                {e.eventType === 'penalty_scored' && ' · Penal'}
                {showAssist && e.assistPlayerName && (
                  <> · <span className="font-semibold">{assistLabel ?? 'Asist'}: {e.assistPlayerName}</span></>
                )}
              </p>
            </div>
            <button
              onClick={() => onDelete(e.id)}
              className="opacity-0 group-hover:opacity-100 p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all"
              title="Eliminar"
            >
              <Trash2 size={12} />
            </button>
          </div>
        )
      })}
    </div>
  )
}
