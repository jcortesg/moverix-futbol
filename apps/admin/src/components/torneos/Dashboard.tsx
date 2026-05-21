'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Trophy, Users, CreditCard, Calendar, AlertCircle,
  Loader2, Shield, ArrowRight, Swords,
} from 'lucide-react'
import { clsx } from 'clsx'
import { useActiveEdition } from '@/contexts/ActiveEditionContext'
import { getMatchesByEdition, type MatchFromApi } from '@/lib/matches'
import { getPaymentSummary, type EditionPaymentSummary } from '@/lib/payments'
import { getFinesByEdition, type FineFromApi } from '@/lib/fines'
import { getStandingsByEdition, type StandingGroup } from '@/lib/standings'

// ─── Types ──────────────────────────────────────────────────────────────────

type DashboardData = {
  matches: MatchFromApi[]
  paymentSummary: EditionPaymentSummary | null
  fines: FineFromApi[]
  standings: StandingGroup[]
}

// ─── Component ──────────────────────────────────────────────────────────────

export function Dashboard() {
  const { activeEdition, ready } = useActiveEdition()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async (editionId: string) => {
    setLoading(true)
    try {
      const [matches, paymentSummary, fines, standings] = await Promise.all([
        getMatchesByEdition(editionId),
        getPaymentSummary(editionId).catch(() => null),
        getFinesByEdition(editionId),
        getStandingsByEdition(editionId).catch(() => []),
      ])
      setData({ matches, paymentSummary, fines, standings })
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!ready) return
    if (activeEdition) {
      load(activeEdition.id)
    } else {
      setLoading(false)
    }
  }, [ready, activeEdition, load])

  if (!ready || loading) {
    return (
      <div className="flex items-center justify-center gap-3 py-32 text-slate-400">
        <Loader2 size={22} className="animate-spin" />
        <span className="text-sm">Cargando dashboard...</span>
      </div>
    )
  }

  if (!activeEdition) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24">
        <div className="w-16 h-16 rounded-2xl bg-slate-100 border-2 border-dashed border-slate-200 flex items-center justify-center">
          <Trophy size={28} className="text-slate-300" />
        </div>
        <h2 className="text-lg font-bold text-slate-700">Sin torneo activo</h2>
        <p className="text-sm text-slate-400 text-center max-w-sm">
          Selecciona un torneo desde el header o ve a la sección de torneos para gestionar uno.
        </p>
        <Link
          href="/torneos"
          className="mt-2 px-4 py-2.5 rounded-xl bg-green-600 text-white text-sm font-bold hover:bg-green-700 transition-colors"
        >
          Ir a Torneos
        </Link>
      </div>
    )
  }

  // ─── Compute KPIs ───────────────────────────────────────────────────────

  const today = new Date().toISOString().slice(0, 10)
  const todayMatches = data?.matches.filter((m) => m.scheduledAt?.slice(0, 10) === today) ?? []
  const pendingResults = data?.matches.filter((m) => m.status === 'scheduled' && m.scheduledAt && m.scheduledAt < new Date().toISOString()) ?? []
  const totalTeams = data?.paymentSummary?.edition.teamsApproved ?? 0
  const pendingPayments = data?.paymentSummary?.totals.pending ?? 0
  const pendingFines = data?.fines.filter((f) => f.status === 'pending') ?? []
  const currency = data?.paymentSummary?.edition.currency ?? 'COP'

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-green-50 border border-green-200 flex items-center justify-center">
          <Trophy size={18} className="text-green-700" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-slate-900">Dashboard</h1>
          <p className="text-xs text-slate-400">
            {activeEdition.leagueName} · {activeEdition.season}
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <KpiCard
          icon={<Calendar size={16} />}
          iconBg="bg-blue-50 border-blue-200"
          iconColor="text-blue-600"
          label="Partidos hoy"
          value={todayMatches.length}
          sub={`${data?.matches.filter((m) => m.status === 'finished').length ?? 0} finalizados en total`}
        />
        <KpiCard
          icon={<Users size={16} />}
          iconBg="bg-green-50 border-green-200"
          iconColor="text-green-600"
          label="Equipos inscritos"
          value={totalTeams}
          sub={`de ${data?.paymentSummary?.edition.maxTeams ?? '?'} max`}
        />
        <KpiCard
          icon={<CreditCard size={16} />}
          iconBg="bg-red-50 border-red-200"
          iconColor="text-red-600"
          label="Pagos pendientes"
          value={formatMoney(pendingPayments, currency)}
          sub={`${data?.paymentSummary?.registrations.teamsPending ?? 0} equipos deben`}
        />
        <KpiCard
          icon={<AlertCircle size={16} />}
          iconBg="bg-amber-50 border-amber-200"
          iconColor="text-amber-600"
          label="Multas pendientes"
          value={pendingFines.length}
          sub={`${formatMoney(pendingFines.reduce((s, f) => s + f.amount, 0), currency)} por cobrar`}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Today's matches */}
        <div className="lg:col-span-2">
          <SectionCard
            title="Partidos de hoy"
            emptyText="No hay partidos programados para hoy"
            items={todayMatches}
            actionHref={`/torneos/edicion/${activeEdition.id}/gestionar/partidos`}
            actionLabel="Ver fixture"
            renderItem={(match) => <MatchRow key={match.id} match={match} />}
          />

          {/* Pending results */}
          {pendingResults.length > 0 && (
            <div className="mt-6">
              <SectionCard
                title="Sin resultado"
                emptyText=""
                items={pendingResults.slice(0, 5)}
                actionHref={`/torneos/edicion/${activeEdition.id}/gestionar/partidos`}
                actionLabel="Cargar resultados"
                renderItem={(match) => <MatchRow key={match.id} match={match} />}
              />
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Standings mini */}
          {data?.standings && data.standings.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-slate-800">Posiciones</h3>
                <Link
                  href={`/torneos/edicion/${activeEdition.id}/gestionar/tabla`}
                  className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5"
                >
                  Ver tabla <ArrowRight size={10} />
                </Link>
              </div>
              <StandingsMini group={data.standings[0]} />
            </div>
          )}

          {/* Quick actions */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
            <h3 className="text-sm font-bold text-slate-800 mb-3">Acciones rápidas</h3>
            <div className="space-y-2">
              <QuickAction
                href={`/torneos/edicion/${activeEdition.id}/gestionar/partidos`}
                icon={<Calendar size={14} />}
                label="Programar partidos"
              />
              <QuickAction
                href={`/torneos/edicion/${activeEdition.id}/gestionar/pagos`}
                icon={<CreditCard size={14} />}
                label="Gestionar pagos"
              />
              <QuickAction
                href={`/torneos/edicion/${activeEdition.id}/gestionar/bracket`}
                icon={<Swords size={14} />}
                label="Fase eliminatoria"
              />
              <QuickAction
                href={`/torneos/edicion/${activeEdition.id}/gestionar/tabla`}
                icon={<Trophy size={14} />}
                label="Tabla de posiciones"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function KpiCard({
  icon, iconBg, iconColor, label, value, sub,
}: {
  icon: React.ReactNode
  iconBg: string
  iconColor: string
  label: string
  value: string | number
  sub: string
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
      <div className="flex items-center gap-2 mb-2">
        <div className={clsx('w-7 h-7 rounded-lg border flex items-center justify-center', iconBg)}>
          <span className={iconColor}>{icon}</span>
        </div>
        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      <p className="text-xs text-slate-400 mt-0.5">{sub}</p>
    </div>
  )
}

function MatchRow({ match }: { match: MatchFromApi }) {
  const time = match.scheduledAt
    ? new Date(match.scheduledAt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
    : '--:--'

  const statusColor = {
    scheduled: 'bg-blue-100 text-blue-700',
    live: 'bg-green-100 text-green-700',
    finished: 'bg-slate-100 text-slate-600',
    postponed: 'bg-amber-100 text-amber-700',
    cancelled: 'bg-red-100 text-red-700',
    walkover: 'bg-purple-100 text-purple-700',
  }[match.status] ?? 'bg-slate-100 text-slate-600'

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-slate-50 last:border-0">
      <span className="text-xs font-mono text-slate-400 w-12">{time}</span>
      <div className="flex-1 min-w-0">
        <span className="text-xs font-medium text-slate-700 truncate block">
          {match.round ?? `J${match.matchdayNumber ?? '?'}`}
        </span>
      </div>
      {match.status === 'finished' ? (
        <span className="text-sm font-bold text-slate-800 tabular-nums">
          {match.homeScore} - {match.awayScore}
        </span>
      ) : (
        <span className={clsx('text-[10px] font-bold px-1.5 py-0.5 rounded-full', statusColor)}>
          {match.status === 'scheduled' ? 'Prog.' : match.status}
        </span>
      )}
    </div>
  )
}

function SectionCard<T>({
  title, emptyText, items, actionHref, actionLabel, renderItem,
}: {
  title: string
  emptyText: string
  items: T[]
  actionHref: string
  actionLabel: string
  renderItem: (item: T) => React.ReactNode
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-slate-800">{title}</h3>
        <Link
          href={actionHref}
          className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5"
        >
          {actionLabel} <ArrowRight size={10} />
        </Link>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-slate-400 py-4 text-center">{emptyText}</p>
      ) : (
        <div>{items.map(renderItem)}</div>
      )}
    </div>
  )
}

function StandingsMini({ group }: { group: StandingGroup }) {
  const top5 = group.rows.slice(0, 5)
  return (
    <div className="space-y-1.5">
      {top5.map((row) => (
        <div key={row.teamId} className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-slate-400 w-4 text-right">{row.position}</span>
          {row.teamLogoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={row.teamLogoUrl} alt="" className="w-4 h-4 rounded object-cover" />
          ) : (
            <div className="w-4 h-4 rounded bg-slate-100 flex items-center justify-center">
              <Shield size={8} className="text-slate-400" />
            </div>
          )}
          <span className="text-xs font-medium text-slate-700 truncate flex-1">{row.teamName}</span>
          <span className="text-xs font-bold text-slate-800 tabular-nums w-6 text-right">{row.points}</span>
        </div>
      ))}
      {group.rows.length > 5 && (
        <p className="text-[10px] text-slate-400 text-center pt-1">+{group.rows.length - 5} más</p>
      )}
    </div>
  )
}

function QuickAction({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-slate-50 transition-colors group"
    >
      <span className="text-slate-400 group-hover:text-indigo-600 transition-colors">{icon}</span>
      <span className="text-xs font-medium text-slate-600 group-hover:text-slate-900">{label}</span>
      <ArrowRight size={10} className="ml-auto text-slate-300 group-hover:text-indigo-500" />
    </Link>
  )
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatMoney(amount: number, currency: string): string {
  if (currency === 'COP') {
    return `$${amount.toLocaleString('es-CO')}`
  }
  return `${amount.toLocaleString()} ${currency}`
}
