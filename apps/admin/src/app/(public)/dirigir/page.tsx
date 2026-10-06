'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Loader2, CalendarDays, MapPin, ChevronRight, ClipboardList } from 'lucide-react'
import { api } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import { LogOut } from 'lucide-react'

type RefereeMatch = {
  matchId: string
  status: 'scheduled' | 'live' | 'finished' | string
  homeScore: number | null
  awayScore: number | null
  scheduledAt: string | null
  round: number | null
  editionName: string | null
  venueName: string | null
  homeTeam: string | null
  awayTeam: string | null
  homeTeamLogo: string | null
  awayTeamLogo: string | null
}

const STATUS = {
  live: { label: 'EN VIVO', cls: 'bg-red-50 text-red-600 border-red-200' },
  finished: { label: 'Finalizado', cls: 'bg-slate-100 text-slate-500 border-slate-200' },
  scheduled: { label: 'Programado', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
} as const

function whenLabel(iso: string | null) {
  if (!iso) return 'Sin fecha'
  return new Date(iso).toLocaleString('es-CO', {
    weekday: 'short', day: '2-digit', month: 'short',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'America/Bogota',
  })
}

export default function DirigirPage() {
  // Esperar a que Firebase restaure la sesión: si se llama antes, el token
  // todavía no existe y la API responde 401.
  const { user, loading: authLoading, logout } = useAuth()
  const [matches, setMatches] = useState<RefereeMatch[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (authLoading || !user) return
    setLoading(true)
    api
      .get<RefereeMatch[]>('/mobile/referee/matches')
      .then(({ data }) => setMatches(data))
      .catch(() => setError('No se pudieron cargar tus partidos.'))
      .finally(() => setLoading(false))
  }, [authLoading, user])

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="bg-slate-900 px-5 pt-7 pb-6 text-white">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-lime-400">Moverix</p>
        <h1 className="mt-1 text-2xl font-bold">Partidos a dirigir</h1>
        <p className="mt-1 text-sm text-slate-300">
          Los partidos que te asignó el organizador.
        </p>
        {/* Quién está en sesión: evita registrar un partido con la cuenta equivocada. */}
        {user?.email && (
          <div className="mt-3 flex items-center gap-2 border-t border-white/10 pt-3">
            <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-lime-400 text-[10px] font-bold text-slate-900">
              {(user.displayName ?? user.email).slice(0, 1).toUpperCase()}
            </span>
            <span className="min-w-0 flex-1 truncate text-xs text-slate-300">
              {user.displayName ? `${user.displayName} · ` : ''}{user.email}
            </span>
            <button
              onClick={() => logout()}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400 hover:text-white"
            >
              <LogOut size={12} /> Salir
            </button>
          </div>
        )}
      </header>

      <div className="mx-auto max-w-lg px-4 py-5">
        {(loading || authLoading) && (
          <div className="flex items-center justify-center gap-2 py-16 text-slate-400">
            <Loader2 size={18} className="animate-spin" /> Cargando…
          </div>
        )}

        {error && !loading && (
          <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>
        )}

        {!loading && !error && matches.length === 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white px-5 py-12 text-center">
            <ClipboardList size={30} className="mx-auto text-slate-300" />
            <p className="mt-3 font-semibold text-slate-700">No tienes partidos asignados</p>
            <p className="mt-1 text-sm text-slate-500">
              El organizador debe asignarte un partido para que aparezca aquí.
            </p>
          </div>
        )}

        <div className="flex flex-col gap-3">
          {matches.map((m) => {
            const st = STATUS[m.status as keyof typeof STATUS] ?? STATUS.scheduled
            return (
              <Link
                key={m.matchId}
                href={`/dirigir/${m.matchId}`}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition active:scale-[0.99]"
              >
                <div className="flex items-center gap-2">
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${st.cls}`}>
                    {st.label}
                  </span>
                  <span className="truncate text-[11px] text-slate-400">{m.editionName}</span>
                  <ChevronRight size={16} className="ml-auto flex-none text-slate-300" />
                </div>

                <div className="mt-3 flex items-center gap-3">
                  <p className="flex-1 truncate text-sm font-semibold text-slate-900">{m.homeTeam ?? 'Local'}</p>
                  <span className="font-mono text-sm font-bold tabular-nums text-slate-500">
                    {m.status === 'scheduled' ? 'vs' : `${m.homeScore ?? 0} - ${m.awayScore ?? 0}`}
                  </span>
                  <p className="flex-1 truncate text-right text-sm font-semibold text-slate-900">{m.awayTeam ?? 'Visitante'}</p>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
                  <span className="inline-flex items-center gap-1">
                    <CalendarDays size={12} /> {whenLabel(m.scheduledAt)}
                  </span>
                  {m.venueName && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin size={12} /> {m.venueName}
                    </span>
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </main>
  )
}
