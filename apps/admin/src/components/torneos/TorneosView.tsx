'use client'

import { useEffect, useState } from 'react'
import {
  ChevronDown, ChevronUp, Plus, Users, Loader2,
  AlertCircle, Trophy, Calendar, Layers, Pencil,
} from 'lucide-react'
import Link from 'next/link'
import { clsx } from 'clsx'
import {
  getLeaguesByOrg,
  getEditionsByLeague,
  type LeagueFromApi,
  type EditionFromApi,
  type EditionStatus,
} from '@/lib/leagues'
import { useActiveEdition } from '@/contexts/ActiveEditionContext'
import { useActiveOrganization } from '@/contexts/ActiveOrganizationContext'
import { LeagueEditDrawer } from './LeagueEditDrawer'

// ─── Constants ────────────────────────────────────────────────────────────────

const LEAGUE_PALETTES = [
  { color: '#16a34a', light: '#f0fdf4', border: '#bbf7d0' },
  { color: '#2563eb', light: '#eff6ff', border: '#bfdbfe' },
  { color: '#d97706', light: '#fffbeb', border: '#fde68a' },
  { color: '#7c3aed', light: '#f5f3ff', border: '#ddd6fe' },
  { color: '#dc2626', light: '#fef2f2', border: '#fecaca' },
  { color: '#0891b2', light: '#ecfeff', border: '#a5f3fc' },
]

const STATUS_LABEL: Record<EditionStatus, string> = {
  active: 'En curso',
  registration: 'Inscripción',
  finished: 'Finalizado',
  draft: 'Borrador',
}

const STATUS_STYLES: Record<EditionStatus, { dot: string; text: string; bg: string }> = {
  active:       { dot: 'bg-green-500',  text: 'text-green-700',  bg: 'bg-green-50 border-green-200' },
  registration: { dot: 'bg-blue-500',   text: 'text-blue-700',   bg: 'bg-blue-50 border-blue-200' },
  finished:     { dot: 'bg-slate-400',  text: 'text-slate-500',  bg: 'bg-slate-50 border-slate-200' },
  draft:        { dot: 'bg-slate-300',  text: 'text-slate-400',  bg: 'bg-slate-50 border-slate-200' },
}

const GENDER_LABEL: Record<string, string> = { M: 'Masculino', F: 'Femenino', Mixed: 'Mixto' }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDateRange(start: string | null, end: string | null): string {
  if (!start && !end) return 'Fechas por definir'
  const fmt = (d: string) =>
    new Date(d).toLocaleDateString('es-CO', { month: 'short', year: 'numeric' })
  if (start && end) return `${fmt(start)} – ${fmt(end)}`
  if (start) return `Desde ${fmt(start)}`
  return `Hasta ${fmt(end!)}`
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: EditionStatus }) {
  const s = STATUS_STYLES[status]
  return (
    <span className={clsx('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border', s.text, s.bg)}>
      <span className={clsx('w-1.5 h-1.5 rounded-full flex-shrink-0', s.dot)} />
      {STATUS_LABEL[status]}
    </span>
  )
}

// ─── Edition card ─────────────────────────────────────────────────────────────

function EditionCard({
  ed, color, leagueName,
}: {
  ed: EditionFromApi
  color: string
  leagueName: string
}) {
  const isActive = ed.status === 'active'
  const isManageable = ed.status === 'active' || ed.status === 'registration'
  const { setActiveEdition } = useActiveEdition()

  function activate() {
    setActiveEdition({
      id: ed.id,
      name: ed.name,
      season: ed.season,
      leagueId: ed.leagueId,
      leagueName,
      logoUrl: ed.logoUrl,
      bannerUrl: ed.bannerUrl,
    })
  }

  return (
    <div
      className={clsx(
        'relative flex flex-col gap-3 p-4 rounded-xl border transition-all group',
        isActive ? 'bg-white shadow-sm hover:shadow-md' : 'bg-slate-50 hover:bg-white hover:shadow-sm',
      )}
      style={{ borderColor: isActive ? color : '#e2e8f0', borderTopWidth: isActive ? 3 : 1 }}
    >
      {/* Banner thumbnail */}
      {ed.bannerUrl && (
        <div className="h-16 -mx-4 -mt-4 mb-0 overflow-hidden rounded-t-xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={ed.bannerUrl} alt="banner" className="w-full h-full object-cover" />
        </div>
      )}

      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {ed.logoUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={ed.logoUrl} alt="logo" className="w-7 h-7 rounded-md object-cover flex-shrink-0 border border-slate-100" />
          ) : (
            <div
              className="w-7 h-7 rounded-md flex-shrink-0 flex items-center justify-center"
              style={{ background: `${color}18`, border: `1px solid ${color}30` }}
            >
              <Layers size={13} style={{ color }} />
            </div>
          )}
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-900 leading-snug truncate">{ed.name}</p>
            <p className="text-xs text-slate-400">{ed.season}</p>
          </div>
        </div>
        <StatusBadge status={ed.status} />
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
        <span className="flex items-center gap-1">
          <Calendar size={11} />
          {formatDateRange(ed.startDate, ed.endDate)}
        </span>
        <span className="flex items-center gap-1">
          <Users size={11} />
          {ed.maxTeams} eq. máx.
        </span>
      </div>

      <div className="flex gap-2 mt-1">
        <Link
          href={`/torneos/edicion/${ed.id}`}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
        >
          <Pencil size={11} />
          Editar
        </Link>
        {isManageable && (
          <Link
            href={`/torneos/edicion/${ed.id}/gestionar`}
            onClick={activate}
            className="flex-1 text-center py-1.5 rounded-lg text-xs font-bold text-white transition-all hover:opacity-90"
            style={{ background: color }}
          >
            Gestionar →
          </Link>
        )}
      </div>
    </div>
  )
}

// ─── Liga card ────────────────────────────────────────────────────────────────

type LigaWithEditions = {
  league: LeagueFromApi
  editions: EditionFromApi[]
  palette: (typeof LEAGUE_PALETTES)[number]
}

function LigaCard({
  data,
  onLeagueUpdated,
}: {
  data: LigaWithEditions
  onLeagueUpdated: (updated: LeagueFromApi) => void
}) {
  const { league, editions, palette } = data
  const hasActive = editions.some((e) => e.status === 'active')
  const [open, setOpen] = useState(hasActive)
  const [editingLeague, setEditingLeague] = useState(false)

  const tipo = `Fútbol ${league.sportFormat} · ${GENDER_LABEL[league.gender] ?? league.gender}`

  return (
    <>
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {/* Banner */}
        {league.bannerUrl && (
          <div className="h-24 overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={league.bannerUrl} alt="banner" className="w-full h-full object-cover" />
          </div>
        )}

        {/* Header */}
        <div className="flex items-center gap-4 px-5 py-4">
          {/* Logo / icon */}
          <button onClick={() => setOpen(!open)} className="flex items-center gap-4 flex-1 min-w-0 text-left">
            {league.logoUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={league.logoUrl}
                alt="logo"
                className="w-11 h-11 rounded-xl object-cover flex-shrink-0 border border-slate-100"
              />
            ) : (
              <div
                className="w-11 h-11 rounded-xl flex-shrink-0 flex items-center justify-center"
                style={{ background: palette.light, border: `1px solid ${palette.border}` }}
              >
                <Trophy size={20} style={{ color: palette.color }} />
              </div>
            )}

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold text-slate-900">{league.name}</h3>
                {hasActive && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-50 text-green-700 border border-green-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                    Activa
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">{tipo}</p>
            </div>
          </button>

          {/* Stats */}
          <div className="hidden sm:flex items-center divide-x divide-slate-100 border border-slate-100 rounded-xl overflow-hidden bg-slate-50 flex-shrink-0">
            <div className="text-center px-4 py-2">
              <p className="text-base font-bold text-slate-900">{editions.length}</p>
              <p className="text-[10px] text-slate-400 uppercase tracking-wide leading-none mt-0.5">Ediciones</p>
            </div>
            <div className="text-center px-4 py-2">
              <p className="text-base font-bold text-slate-900">
                {editions.filter((e) => e.status === 'active' || e.status === 'registration').length}
              </p>
              <p className="text-[10px] text-slate-400 uppercase tracking-wide leading-none mt-0.5">Activas</p>
            </div>
            <div className="text-center px-4 py-2">
              <p className="text-base font-bold text-slate-900">
                {editions.reduce((acc, e) => acc + e.maxTeams, 0) || 0}
              </p>
              <p className="text-[10px] text-slate-400 uppercase tracking-wide leading-none mt-0.5">Equipos</p>
            </div>
          </div>

          {/* Edit league */}
          <button
            onClick={() => setEditingLeague(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors flex-shrink-0"
          >
            <Pencil size={12} />
            Editar liga
          </button>

          {/* New edition */}
          <Link
            href={`/torneos/edicion/nueva?leagueId=${league.id}`}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors flex-shrink-0"
          >
            <Plus size={12} />
            Nueva edición
          </Link>

          <button onClick={() => setOpen(!open)} className="text-slate-400 flex-shrink-0">
            {open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
        </div>

        {/* Divider */}
        {open && <div className="h-px bg-slate-100 mx-5" />}

        {/* Editions panel */}
        {open && (
          <div className="px-5 pb-5 pt-3">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Ediciones</p>
            {editions.length === 0 ? (
              <Link
                href={`/torneos/edicion/nueva?leagueId=${league.id}`}
                className="flex flex-col items-center justify-center gap-2 py-8 rounded-xl border-2 border-dashed border-slate-200 text-slate-400 cursor-pointer hover:border-slate-300 hover:text-slate-500 transition-colors"
              >
                <Layers size={24} />
                <p className="text-sm">Sin ediciones. Crea la primera.</p>
              </Link>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {editions.map((ed) => (
                  <EditionCard
                    key={ed.id}
                    ed={ed}
                    color={palette.color}
                    leagueName={league.name}
                  />
                ))}
                <Link
                  href={`/torneos/edicion/nueva?leagueId=${league.id}`}
                  className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl border-2 border-dashed border-slate-200 text-slate-400 hover:border-slate-300 hover:text-slate-500 transition-colors min-h-[120px]"
                >
                  <Plus size={20} />
                  <span className="text-xs font-medium">Nueva edición</span>
                </Link>
              </div>
            )}
          </div>
        )}
      </div>

      {editingLeague && (
        <LeagueEditDrawer
          league={league}
          onClose={() => setEditingLeague(false)}
          onSaved={(updated) => { onLeagueUpdated(updated); setEditingLeague(false) }}
        />
      )}

    </>
  )
}

// ─── Main view ────────────────────────────────────────────────────────────────

export function TorneosView() {
  const { activeOrg } = useActiveOrganization()
  const [ligas, setLigas] = useState<LigaWithEditions[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)
      try {
        if (!activeOrg) { setLigas([]); return }
        const leagues = await getLeaguesByOrg(activeOrg.id)
        const withEditions = await Promise.all(
          leagues.map(async (league, i) => ({
            league,
            editions: await getEditionsByLeague(league.id),
            palette: LEAGUE_PALETTES[i % LEAGUE_PALETTES.length],
          })),
        )
        setLigas(withEditions)
      } catch {
        setError('No se pudieron cargar los torneos. Verifica tu conexión.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [activeOrg?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleLeagueUpdated(updated: LeagueFromApi) {
    setLigas((prev) =>
      prev.map((l) => l.league.id === updated.id ? { ...l, league: updated } : l),
    )
  }

  const totalEdiciones = ligas.reduce((acc, l) => acc + l.editions.length, 0)

  return (
    <div>
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Torneos y Ligas</h1>
          {!loading && !error && (
            <p className="text-sm text-slate-500 mt-1">
              {ligas.length} {ligas.length === 1 ? 'liga' : 'ligas'} · {totalEdiciones} ediciones en total
            </p>
          )}
        </div>
        <button className="flex items-center gap-2 px-4 py-2.5 bg-green-600 text-white text-sm font-bold rounded-xl hover:bg-green-700 active:scale-[0.98] transition-all shadow-sm">
          <Plus size={15} />
          Nueva liga
        </button>
      </div>

      {loading && (
        <div className="flex items-center justify-center gap-3 py-24 text-slate-400">
          <Loader2 size={22} className="animate-spin" />
          <span className="text-sm">Cargando torneos...</span>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3.5 text-sm text-red-600">
          <AlertCircle size={16} className="flex-shrink-0" />
          {error}
        </div>
      )}

      {!loading && !error && ligas.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-4 py-24 rounded-2xl border-2 border-dashed border-slate-200">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center">
            <Trophy size={28} className="text-slate-300" />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-slate-500">No hay ligas creadas</p>
            <p className="text-xs text-slate-400 mt-1">Crea tu primera liga para empezar a gestionar torneos</p>
          </div>
          <button className="flex items-center gap-2 px-4 py-2.5 bg-green-600 text-white text-sm font-bold rounded-xl hover:bg-green-700 transition-colors shadow-sm">
            <Plus size={15} />
            Crear primera liga
          </button>
        </div>
      )}

      {!loading && !error && ligas.length > 0 && (
        <div className="flex flex-col gap-4">
          {ligas.map((data) => (
            <LigaCard
              key={data.league.id}
              data={data}
              onLeagueUpdated={handleLeagueUpdated}
            />
          ))}
        </div>
      )}
    </div>
  )
}
