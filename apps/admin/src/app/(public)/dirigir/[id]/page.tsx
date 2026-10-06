'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  Loader2, ChevronLeft, Check, X, Play, Flag, Plus, Trash2, AlertCircle, Lock,
} from 'lucide-react'
import { clsx } from 'clsx'
import { api } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'

type RosterPlayer = {
  teamId: string
  playerUid: string
  playerName: string
  jerseyNumber: number | null
  docNumber: string | null
  present: boolean
}

type MatchDetail = {
  matchId: string
  status: string
  homeScore: number | null
  awayScore: number | null
  scheduledAt: string | null
  homeTeamId: string | null
  awayTeamId: string | null
  homeTeamName: string
  awayTeamName: string
  homeRoster: RosterPlayer[]
  awayRoster: RosterPlayer[]
}

type MatchEvent = {
  id: string
  teamId: string
  eventType: string
  minute: number | null
  playerUid: string | null
  playerName: string | null
  assistPlayerUid?: string | null
  assistPlayerName?: string | null
}

const EVENT_LABEL: Record<string, string> = {
  goal: 'Gol',
  own_goal: 'Autogol',
  penalty_scored: 'Penal',
  yellow_card: 'Amarilla',
  red_card: 'Roja',
  substitution: 'Cambio',
}

const GOALS = ['goal', 'own_goal', 'penalty_scored']

export default function DirigirPartidoPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  // Igual que en la lista: sin sesión restaurada no hay token que enviar.
  const { user, loading: authLoading } = useAuth()

  const [data, setData] = useState<MatchDetail | null>(null)
  const [events, setEvents] = useState<MatchEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [tab, setTab] = useState<'planilla' | 'eventos'>('planilla')
  const [picker, setPicker] = useState<{ type: string; teamId: string; teamName: string } | null>(null)
  // Cambio: se elige primero quién SALE y luego quién ENTRA.
  const [sub, setSub] = useState<{ teamId: string; out?: RosterPlayer } | null>(null)
  const [closing, setClosing] = useState(false)

  async function load() {
    const [d, e] = await Promise.all([
      api.get<MatchDetail>(`/mobile/referee/matches/${id}`),
      api.get<MatchEvent[]>('/match-events', { params: { matchId: id } }),
    ])
    setData(d.data)
    setEvents(e.data)
  }

  useEffect(() => {
    if (authLoading || !user) return
    load()
      .catch(() => setError('No se pudo cargar el partido. ¿Sigues asignado a este partido?'))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, authLoading, user])

  async function run(fn: () => Promise<unknown>) {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      await fn()
      await load()
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'No se pudo guardar. Revisa tu conexión.')
    } finally {
      setBusy(false)
    }
  }

  if (loading || authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center gap-2 bg-slate-50 text-slate-400">
        <Loader2 size={18} className="animate-spin" /> Cargando…
      </div>
    )
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-slate-50 p-5">
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error ?? 'Partido no disponible.'}
        </p>
      </div>
    )
  }

  const goals = events.filter((e) => GOALS.includes(e.eventType))
  const liveHome = goals.filter((e) => e.teamId === data.homeTeamId).length
  const liveAway = goals.filter((e) => e.teamId === data.awayTeamId).length
  const isFinished = data.status === 'finished'
  const isLive = data.status === 'live'

  return (
    <main className="min-h-screen bg-slate-50 pb-28">
      {/* Marcador */}
      <header className="bg-slate-900 px-4 pb-5 pt-5 text-white">
        <button
          onClick={() => router.push('/dirigir')}
          className="mb-3 inline-flex items-center gap-1 text-xs text-slate-300"
        >
          <ChevronLeft size={15} /> Mis partidos
        </button>

        <div className="flex items-center gap-3">
          <p className="flex-1 text-sm font-semibold leading-tight">{data.homeTeamName}</p>
          <p className="font-mono text-3xl font-bold tabular-nums">
            {isFinished ? `${data.homeScore ?? 0}-${data.awayScore ?? 0}` : `${liveHome}-${liveAway}`}
          </p>
          <p className="flex-1 text-right text-sm font-semibold leading-tight">{data.awayTeamName}</p>
        </div>

        <p className="mt-2 text-center text-[11px] font-bold uppercase tracking-widest text-lime-400">
          {isLive ? '● En vivo' : isFinished ? 'Finalizado' : 'Programado'}
        </p>
      </header>

      {error && (
        <p className="mx-4 mt-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
          <AlertCircle size={14} className="mt-0.5 flex-none" /> {error}
        </p>
      )}

      {/* Pestañas */}
      <div className="sticky top-0 z-10 flex gap-1 border-b border-slate-200 bg-slate-50 px-4 pt-3">
        {(['planilla', 'eventos'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={clsx(
              'rounded-t-lg px-4 py-2 text-sm font-bold capitalize',
              tab === t ? 'border-b-2 border-slate-900 text-slate-900' : 'text-slate-400',
            )}
          >
            {t === 'planilla' ? 'Planilla' : `Eventos (${events.length})`}
          </button>
        ))}
      </div>

      <div className="mx-auto max-w-lg px-4 py-4">
        {tab === 'planilla' ? (
          <>
            <p className="mb-3 text-xs text-slate-500">
              Marca quién se presentó. Compara cada jugador con su documento.
            </p>
            <RosterBlock
              title={data.homeTeamName}
              players={data.homeRoster}
              disabled={busy || isFinished}
              onToggle={(p) =>
                run(() =>
                  api.put(`/mobile/referee/matches/${id}/attendance`, {
                    playerUid: p.playerUid,
                    teamId: p.teamId,
                    present: !p.present,
                  }),
                )
              }
            />
            <RosterBlock
              title={data.awayTeamName}
              players={data.awayRoster}
              disabled={busy || isFinished}
              onToggle={(p) =>
                run(() =>
                  api.put(`/mobile/referee/matches/${id}/attendance`, {
                    playerUid: p.playerUid,
                    teamId: p.teamId,
                    present: !p.present,
                  }),
                )
              }
            />
          </>
        ) : (
          <div className="flex flex-col gap-2">
            {events.length === 0 && (
              <p className="py-10 text-center text-sm text-slate-400">Sin eventos registrados.</p>
            )}
            {events.map((e) => (
              <div key={e.id} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                <span
                  className={clsx(
                    'rounded-md px-2 py-0.5 text-[10px] font-bold',
                    e.eventType === 'red_card' ? 'bg-red-50 text-red-600'
                      : e.eventType === 'yellow_card' ? 'bg-amber-50 text-amber-700'
                      : e.eventType === 'substitution' ? 'bg-sky-50 text-sky-700'
                      : 'bg-emerald-50 text-emerald-700',
                  )}
                >
                  {EVENT_LABEL[e.eventType] ?? e.eventType}
                </span>
                <p className="flex-1 truncate text-sm text-slate-700">
                  {e.eventType === 'substitution' && e.assistPlayerName
                    ? `Sale ${e.playerName ?? '—'} · Entra ${e.assistPlayerName}`
                    : e.playerName ?? 'Sin jugador'}
                </p>
                {!isFinished && (
                  <button
                    disabled={busy}
                    onClick={() => run(() => api.delete(`/match-events/${e.id}`))}
                    className="p-1 text-slate-300 hover:text-red-500 disabled:opacity-40"
                    aria-label="Borrar evento"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Cerrado el partido, el resultado es oficial: el delegado ya no toca
          nada (la API lo rechaza igual) y conviene decir por qué. */}
      {isFinished && (
        <div className="fixed inset-x-0 bottom-0 border-t border-slate-200 bg-white px-4 py-3">
          <div className="mx-auto flex max-w-lg items-start gap-2 rounded-xl bg-slate-50 px-3 py-2.5">
            <Lock size={15} className="mt-0.5 shrink-0 text-slate-400" />
            <p className="text-xs leading-relaxed text-slate-600">
              Partido finalizado. El resultado es oficial: si hay algo que corregir, lo
              hace el organizador desde el panel.
            </p>
          </div>
        </div>
      )}

      {/* Barra de acciones */}
      {!isFinished && (
        <div className="fixed inset-x-0 bottom-0 border-t border-slate-200 bg-white px-4 py-3">
          <div className="mx-auto max-w-lg">
            {!isLive ? (
              <button
                disabled={busy}
                onClick={() => run(() => api.patch(`/matches/${id}`, { status: 'live' }))}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 py-3.5 text-sm font-bold text-white disabled:opacity-50"
              >
                <Play size={16} /> Iniciar partido
              </button>
            ) : (
              <div className="flex flex-col gap-2">
                <div className="grid grid-cols-2 gap-2">
                  <ActionBtn label={`Gol ${data.homeTeamName}`} onClick={() => setPicker({ type: 'goal', teamId: data.homeTeamId!, teamName: data.homeTeamName })} />
                  <ActionBtn label={`Gol ${data.awayTeamName}`} onClick={() => setPicker({ type: 'goal', teamId: data.awayTeamId!, teamName: data.awayTeamName })} />
                  <ActionBtn label="🟨 Amarilla" onClick={() => setPicker({ type: 'yellow_card', teamId: data.homeTeamId!, teamName: 'Elige equipo' })} />
                  <ActionBtn label="🟥 Roja" onClick={() => setPicker({ type: 'red_card', teamId: data.homeTeamId!, teamName: 'Elige equipo' })} />
                  <ActionBtn label="🔁 Cambio" onClick={() => setSub({ teamId: data.homeTeamId! })} />
                </div>
                <button
                  onClick={() => setClosing(true)}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-slate-900 py-3 text-sm font-bold text-slate-900"
                >
                  <Flag size={15} /> Finalizar partido
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Cambio: dos pasos, sale y entra */}
      {sub && (
        <PlayerPicker
          title={sub.out ? `Cambio — ¿quién entra por ${sub.out.playerName}?` : 'Cambio — ¿quién sale?'}
          home={{ id: data.homeTeamId!, name: data.homeTeamName, players: data.homeRoster }}
          away={{ id: data.awayTeamId!, name: data.awayTeamName, players: data.awayRoster }}
          // Al elegir quién entra, el equipo ya está fijado por quien sale.
          lockTeamId={sub.out ? sub.out.teamId : undefined}
          excludeUid={sub.out?.playerUid}
          onClose={() => setSub(null)}
          onPick={(p) => {
            if (!sub.out) {
              setSub({ teamId: p.teamId, out: p })
              return
            }
            const out = sub.out
            setSub(null)
            run(() =>
              api.post('/match-events', {
                matchId: id,
                teamId: out.teamId,
                eventType: 'substitution',
                playerUid: out.playerUid,
                playerName: out.playerName,
                assistPlayerUid: p.playerUid,
                assistPlayerName: p.playerName,
              }),
            )
          }}
        />
      )}

      {/* Elegir jugador */}
      {picker && (
        <PlayerPicker
          title={EVENT_LABEL[picker.type] ?? picker.type}
          home={{ id: data.homeTeamId!, name: data.homeTeamName, players: data.homeRoster }}
          away={{ id: data.awayTeamId!, name: data.awayTeamName, players: data.awayRoster }}
          onClose={() => setPicker(null)}
          onPick={(p) => {
            setPicker(null)
            run(() =>
              api.post('/match-events', {
                matchId: id,
                teamId: p.teamId,
                eventType: picker.type,
                playerUid: p.playerUid,
                playerName: p.playerName,
              }),
            )
          }}
        />
      )}

      {/* Finalizar */}
      {closing && (
        <FinalizeSheet
          home={data.homeTeamName}
          away={data.awayTeamName}
          defaultHome={liveHome}
          defaultAway={liveAway}
          onClose={() => setClosing(false)}
          onConfirm={(hs, as_) => {
            setClosing(false)
            run(() => api.patch(`/matches/${id}/finalize`, { homeScore: hs, awayScore: as_ }))
          }}
        />
      )}
    </main>
  )
}

function ActionBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="truncate rounded-xl bg-slate-100 px-3 py-3 text-xs font-bold text-slate-800 active:scale-[0.98]"
    >
      {label}
    </button>
  )
}

function RosterBlock({
  title, players, disabled, onToggle,
}: {
  title: string
  players: RosterPlayer[]
  disabled: boolean
  onToggle: (p: RosterPlayer) => void
}) {
  const presentes = players.filter((p) => p.present).length
  return (
    <div className="mb-5">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-sm font-bold text-slate-900">{title}</h2>
        <span className="text-xs text-slate-500">{presentes}/{players.length} presentes</span>
      </div>
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {players.length === 0 && (
          <p className="px-4 py-6 text-center text-sm text-slate-400">Sin jugadores inscritos.</p>
        )}
        {players.map((p) => (
          <button
            key={p.playerUid}
            disabled={disabled}
            onClick={() => onToggle(p)}
            className="flex w-full items-center gap-3 border-b border-slate-100 px-3 py-3 text-left last:border-0 disabled:opacity-60"
          >
            <span className="w-7 flex-none text-center font-mono text-xs tabular-nums text-slate-400">
              {p.jerseyNumber ?? '—'}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-slate-800">{p.playerName}</span>
              {p.docNumber && (
                <span className="block truncate font-mono text-[10px] text-slate-400">CC {p.docNumber}</span>
              )}
            </span>
            <span
              className={clsx(
                'flex h-7 w-7 flex-none items-center justify-center rounded-full border-2',
                p.present ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-200 text-slate-300',
              )}
            >
              {p.present ? <Check size={15} /> : <X size={13} />}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

function PlayerPicker({
  title, home, away, onPick, onClose, lockTeamId, excludeUid,
}: {
  title: string
  home: { id: string; name: string; players: RosterPlayer[] }
  away: { id: string; name: string; players: RosterPlayer[] }
  onPick: (p: RosterPlayer) => void
  onClose: () => void
  /** Fija el equipo (en un cambio, quien entra es del mismo equipo). */
  lockTeamId?: string
  /** Oculta a un jugador (el que ya sale del campo). */
  excludeUid?: string
}) {
  const [team, setTeam] = useState<'home' | 'away'>(
    lockTeamId && lockTeamId === away.id ? 'away' : 'home',
  )
  const side = team === 'home' ? home : away
  // Se ofrecen primero los que están en cancha; el resto queda al final.
  const players = [...side.players]
    .filter((p) => p.playerUid !== excludeUid)
    .sort((a, b) => Number(b.present) - Number(a.present))

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/50">
      <button className="flex-1" onClick={onClose} aria-label="Cerrar" />
      <div className="max-h-[80vh] overflow-y-auto rounded-t-2xl bg-white">
        <div className="sticky top-0 border-b border-slate-100 bg-white px-4 pb-2 pt-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900">{title} — ¿quién?</h3>
            <button onClick={onClose} className="p-1 text-slate-400"><X size={18} /></button>
          </div>
          <div className={clsx('mt-3 flex gap-1', lockTeamId && 'hidden')}>
            {(['home', 'away'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTeam(t)}
                className={clsx(
                  'flex-1 truncate rounded-lg px-3 py-2 text-xs font-bold',
                  team === t ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600',
                )}
              >
                {t === 'home' ? home.name : away.name}
              </button>
            ))}
          </div>
        </div>
        <div className="pb-6">
          {players.map((p) => (
            <button
              key={p.playerUid}
              onClick={() => onPick(p)}
              className="flex w-full items-center gap-3 border-b border-slate-100 px-4 py-3 text-left"
            >
              <span className="w-7 text-center font-mono text-xs tabular-nums text-slate-400">
                {p.jerseyNumber ?? '—'}
              </span>
              <span className="flex-1 truncate text-sm text-slate-800">{p.playerName}</span>
              {!p.present && <span className="text-[10px] text-slate-400">no marcado</span>}
              <Plus size={15} className="text-slate-300" />
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function FinalizeSheet({
  home, away, defaultHome, defaultAway, onConfirm, onClose,
}: {
  home: string
  away: string
  defaultHome: number
  defaultAway: number
  onConfirm: (hs: number, as_: number) => void
  onClose: () => void
}) {
  const [hs, setHs] = useState(String(defaultHome))
  const [as_, setAs] = useState(String(defaultAway))

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/50">
      <button className="flex-1" onClick={onClose} aria-label="Cerrar" />
      <div className="rounded-t-2xl bg-white p-5">
        <h3 className="text-base font-bold text-slate-900">Confirmar marcador</h3>
        <p className="mt-1 text-xs text-slate-500">
          Este es el resultado oficial que va a la tabla de posiciones.
        </p>
        <div className="mt-4 flex items-center gap-3">
          <div className="flex-1">
            <label className="block truncate text-xs font-semibold text-slate-600">{home}</label>
            <input
              type="number" min={0} inputMode="numeric"
              value={hs} onChange={(e) => setHs(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-3 text-center font-mono text-2xl tabular-nums"
            />
          </div>
          <div className="flex-1">
            <label className="block truncate text-right text-xs font-semibold text-slate-600">{away}</label>
            <input
              type="number" min={0} inputMode="numeric"
              value={as_} onChange={(e) => setAs(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-3 text-center font-mono text-2xl tabular-nums"
            />
          </div>
        </div>
        <button
          onClick={() => onConfirm(parseInt(hs, 10) || 0, parseInt(as_, 10) || 0)}
          className="mt-5 w-full rounded-xl bg-slate-900 py-3.5 text-sm font-bold text-white"
        >
          Finalizar partido
        </button>
        <button onClick={onClose} className="mt-2 w-full py-2 text-sm text-slate-500">Cancelar</button>
      </div>
    </div>
  )
}
