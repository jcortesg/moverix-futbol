'use client'

import { Award, Goal, Square, Users, ArrowLeftRight } from 'lucide-react'
import type { MatchEventFromApi } from '@/lib/match-events'
import type { RegistrationPlayerFromApi } from '@/lib/registration-players'

/**
 * Vista de resumen (solo lectura) de un partido: MVP destacado, goles con minuto,
 * tarjetas/sanciones y alineaciones de cada equipo.
 */
export function MatchSummary({
  homeTeamName, awayTeamName, homeTeamId, awayTeamId,
  homeScore, awayScore, homePenalties, awayPenalties, status,
  events, homePlayers, awayPlayers,
}: {
  homeTeamName: string
  awayTeamName: string
  homeTeamId: string | null
  awayTeamId: string | null
  homeScore: number | null
  awayScore: number | null
  homePenalties: number | null
  awayPenalties: number | null
  status: string
  events: MatchEventFromApi[]
  homePlayers: RegistrationPlayerFromApi[]
  awayPlayers: RegistrationPlayerFromApi[]
}) {
  const sortByMin = (a: MatchEventFromApi, b: MatchEventFromApi) => (a.minute ?? 999) - (b.minute ?? 999)
  const goalTypes = ['goal', 'own_goal', 'penalty_scored']
  const goals = events.filter((e) => goalTypes.includes(e.eventType)).sort(sortByMin)
  const cards = events.filter((e) => e.eventType === 'yellow_card' || e.eventType === 'red_card').sort(sortByMin)
  const subs = events.filter((e) => e.eventType === 'substitution').sort(sortByMin)
  const mvp = events.find((e) => e.eventType === 'mvp')

  const homeGoals = goals.filter((e) => e.teamId === homeTeamId)
  const awayGoals = goals.filter((e) => e.teamId === awayTeamId)
  const finished = status === 'finished'

  return (
    <div className="space-y-5">
      {/* Marcador */}
      <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1 text-right">
            <p className="text-sm font-bold text-slate-900 truncate">{homeTeamName}</p>
          </div>
          <div className="flex items-center gap-2 px-3">
            <span className="text-3xl font-black text-slate-900 tabular-nums">{homeScore ?? '–'}</span>
            <span className="text-xl text-slate-300">-</span>
            <span className="text-3xl font-black text-slate-900 tabular-nums">{awayScore ?? '–'}</span>
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-slate-900 truncate">{awayTeamName}</p>
          </div>
        </div>
        {homePenalties != null && awayPenalties != null && (
          <p className="text-center text-xs text-slate-500 mt-1">Penales: {homePenalties} - {awayPenalties}</p>
        )}
        {!finished && (
          <p className="text-center text-[11px] font-semibold uppercase tracking-wide text-amber-600 mt-2">Partido no finalizado</p>
        )}
      </div>

      {/* MVP destacado */}
      {mvp && (
        <div className="flex items-center gap-3 rounded-2xl border border-yellow-200 bg-yellow-50 px-4 py-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-yellow-400/20">
            <Award size={20} className="text-yellow-600" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-yellow-700">MVP del partido</p>
            <p className="text-sm font-bold text-slate-900">{mvp.playerName ?? 'Jugador'}</p>
          </div>
        </div>
      )}

      {/* Goles */}
      <SummarySection title={`Goles (${goals.length})`} icon={Goal} color="text-green-600">
        {goals.length === 0 ? (
          <Empty msg="Sin goles registrados." />
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <GoalColumn goals={homeGoals} align="left" />
            <GoalColumn goals={awayGoals} align="right" />
          </div>
        )}
      </SummarySection>

      {/* Tarjetas */}
      <SummarySection title={`Tarjetas (${cards.length})`} icon={Square} color="text-amber-500">
        {cards.length === 0 ? (
          <Empty msg="Sin tarjetas." />
        ) : (
          <div className="space-y-1.5">
            {cards.map((c) => {
              const isHome = c.teamId === homeTeamId
              const red = c.eventType === 'red_card'
              return (
                <div key={c.id} className="flex items-center gap-2 text-sm">
                  <span className={`inline-block h-3.5 w-2.5 rounded-sm ${red ? 'bg-red-500' : 'bg-amber-400'}`} />
                  <span className="w-10 text-xs text-slate-400 tabular-nums">{c.minute != null ? `${c.minute}'` : '—'}</span>
                  <span className="font-medium text-slate-800">{c.playerName ?? 'Jugador'}</span>
                  <span className="text-xs text-slate-400">· {isHome ? homeTeamName : awayTeamName}</span>
                </div>
              )
            })}
          </div>
        )}
      </SummarySection>

      {/* Sustituciones */}
      {subs.length > 0 && (
        <SummarySection title={`Sustituciones (${subs.length})`} icon={ArrowLeftRight} color="text-blue-500">
          <div className="space-y-1.5">
            {subs.map((s) => {
              const isHome = s.teamId === homeTeamId
              return (
                <div key={s.id} className="flex items-center gap-2 text-sm">
                  <span className="w-10 text-xs text-slate-400 tabular-nums">{s.minute != null ? `${s.minute}'` : '—'}</span>
                  <span className="font-medium text-slate-800">{s.assistPlayerName ?? '—'}</span>
                  <ArrowLeftRight size={12} className="text-slate-300" />
                  <span className="text-slate-500">{s.playerName ?? '—'}</span>
                  <span className="text-xs text-slate-400">· {isHome ? homeTeamName : awayTeamName}</span>
                </div>
              )
            })}
          </div>
        </SummarySection>
      )}

      {/* Alineaciones */}
      <SummarySection title="Alineaciones" icon={Users} color="text-slate-500">
        <div className="grid grid-cols-2 gap-4">
          <Lineup title={homeTeamName} players={homePlayers} />
          <Lineup title={awayTeamName} players={awayPlayers} />
        </div>
      </SummarySection>
    </div>
  )
}

function GoalColumn({ goals, align }: { goals: MatchEventFromApi[]; align: 'left' | 'right' }) {
  if (goals.length === 0) return <div className="text-xs text-slate-300">—</div>
  return (
    <div className={`space-y-1.5 ${align === 'right' ? 'text-right' : ''}`}>
      {goals.map((g) => (
        <div key={g.id} className={`flex items-center gap-1.5 text-sm ${align === 'right' ? 'flex-row-reverse' : ''}`}>
          <Goal size={13} className={g.eventType === 'own_goal' ? 'text-red-500' : 'text-green-600'} />
          <span className="text-xs text-slate-400 tabular-nums">{g.minute != null ? `${g.minute}'` : ''}</span>
          <span className="font-medium text-slate-800 truncate">
            {g.playerName ?? 'Gol'}
            {g.eventType === 'own_goal' && <span className="text-[10px] text-red-500"> (ec)</span>}
            {g.eventType === 'penalty_scored' && <span className="text-[10px] text-slate-400"> (pen)</span>}
          </span>
          {g.assistPlayerName && <span className="text-[11px] text-slate-400 truncate">↳ {g.assistPlayerName}</span>}
        </div>
      ))}
    </div>
  )
}

function Lineup({ title, players }: { title: string; players: RegistrationPlayerFromApi[] }) {
  return (
    <div>
      <p className="text-xs font-bold text-slate-700 mb-2 truncate">{title} <span className="text-slate-400 font-normal">({players.length})</span></p>
      <div className="space-y-1">
        {players.length === 0 ? (
          <p className="text-xs text-slate-300">Sin nómina</p>
        ) : (
          players.map((p) => (
            <div key={p.id} className="flex items-center gap-2 text-xs">
              <span className="w-5 text-slate-400 tabular-nums text-right">{p.jerseyNumber ?? '–'}</span>
              <span className="text-slate-700 truncate">{p.playerName}{p.isCaptain ? ' (C)' : ''}</span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function SummarySection({ title, icon: Icon, color, children }: {
  title: string; icon: any; color: string; children: React.ReactNode
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2.5">
        <Icon size={15} className={color} />
        <h3 className="text-sm font-bold text-slate-800">{title}</h3>
      </div>
      {children}
    </div>
  )
}

function Empty({ msg }: { msg: string }) {
  return <p className="text-xs text-slate-400">{msg}</p>
}
