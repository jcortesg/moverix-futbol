'use client'

import { useEffect, useState } from 'react'
import {
  FileText, Loader2, AlertCircle, Users, Calendar,
  DollarSign, Trophy, CheckCircle2, Clock, XCircle,
  Shield, TrendingUp,
} from 'lucide-react'
import {
  getLeaguesByOrg,
  getEditionsByLeague,
  type EditionFromApi,
  type LeagueFromApi,
} from '@/lib/leagues'
import { useActiveOrganization } from '@/contexts/ActiveOrganizationContext'
import { getRegistrationsByEdition, type RegistrationFromApi } from '@/lib/registrations'
import { getMatchesByEdition, type MatchFromApi } from '@/lib/matches'
import { getPaymentsByEdition, type PaymentFromApi } from '@/lib/payments'

type EditionStats = {
  edition: EditionFromApi
  league: LeagueFromApi
  registrations: RegistrationFromApi[]
  matches: MatchFromApi[]
  payments: PaymentFromApi[]
}

export function ReportesView() {
  const { activeOrg } = useActiveOrganization()
  const [editionStats, setEditionStats] = useState<EditionStats[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      try {
        if (!activeOrg) { setError('No se encontro la organizacion'); return }

        const leagues = await getLeaguesByOrg(activeOrg.id)
        const allEditions: { edition: EditionFromApi; league: LeagueFromApi }[] = []

        for (const league of leagues) {
          const editions = await getEditionsByLeague(league.id)
          for (const edition of editions) {
            allEditions.push({ edition, league })
          }
        }

        const stats = await Promise.all(
          allEditions.map(async ({ edition, league }) => {
            const [registrations, matches, payments] = await Promise.all([
              getRegistrationsByEdition(edition.id),
              getMatchesByEdition(edition.id),
              getPaymentsByEdition(edition.id),
            ])
            return { edition, league, registrations, matches, payments }
          }),
        )

        setEditionStats(stats)
      } catch {
        setError('Error al cargar los datos')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [activeOrg?.id])

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-3 py-32 text-slate-400">
        <Loader2 size={22} className="animate-spin" />
        <span className="text-sm">Cargando reportes...</span>
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

  // Aggregate across all editions
  const allRegs = editionStats.flatMap((s) => s.registrations)
  const allMatches = editionStats.flatMap((s) => s.matches)
  const allPayments = editionStats.flatMap((s) => s.payments)

  const approvedRegs = allRegs.filter((r) => r.status === 'approved').length
  const pendingRegs = allRegs.filter((r) => r.status === 'pending').length
  const rejectedRegs = allRegs.filter((r) => r.status === 'rejected').length

  const finishedMatches = allMatches.filter((m) => m.status === 'finished').length
  const scheduledMatches = allMatches.filter((m) => m.status === 'scheduled').length
  const totalGoals = allMatches.reduce((sum, m) => sum + (m.homeScore ?? 0) + (m.awayScore ?? 0), 0)
  const avgGoals = finishedMatches > 0 ? (totalGoals / finishedMatches).toFixed(1) : '—'

  const verifiedPayments = allPayments.filter((p) => p.status === 'verified')
  const pendingPayments = allPayments.filter((p) => p.status === 'pending')
  const totalCollected = verifiedPayments.reduce((sum, p) => sum + p.amount, 0)
  const totalPending = pendingPayments.reduce((sum, p) => sum + p.amount, 0)

  function fmtMoney(amount: number) {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <FileText size={20} />
          Reportes
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Resumen general — {editionStats.length} {editionStats.length === 1 ? 'torneo' : 'torneos'}
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          icon={Trophy}
          color="bg-indigo-500"
          label="Torneos"
          value={String(editionStats.length)}
          sub={`${editionStats.filter((s) => s.edition.status === 'active').length} activos`}
        />
        <KPICard
          icon={Users}
          color="bg-blue-500"
          label="Equipos inscritos"
          value={String(approvedRegs)}
          sub={pendingRegs > 0 ? `${pendingRegs} pendientes` : 'Todos aprobados'}
        />
        <KPICard
          icon={Calendar}
          color="bg-amber-500"
          label="Partidos jugados"
          value={String(finishedMatches)}
          sub={`${allMatches.length} totales`}
        />
        <KPICard
          icon={DollarSign}
          color="bg-green-600"
          label="Recaudado"
          value={fmtMoney(totalCollected)}
          sub={totalPending > 0 ? `${fmtMoney(totalPending)} pendiente` : 'Todo al dia'}
        />
      </div>

      {/* Global stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <h2 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
            <Shield size={15} className="text-blue-500" />
            Inscripciones ({allRegs.length})
          </h2>
          <div className="space-y-3">
            <StatRow icon={CheckCircle2} color="text-green-500" label="Aprobadas" value={approvedRegs} total={allRegs.length} />
            <StatRow icon={Clock} color="text-amber-500" label="Pendientes" value={pendingRegs} total={allRegs.length} />
            <StatRow icon={XCircle} color="text-red-400" label="Rechazadas" value={rejectedRegs} total={allRegs.length} />
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <h2 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
            <TrendingUp size={15} className="text-amber-500" />
            Estadisticas de partidos
          </h2>
          <div className="space-y-3">
            <StatRow icon={CheckCircle2} color="text-green-500" label="Finalizados" value={finishedMatches} total={allMatches.length} />
            <StatRow icon={Clock} color="text-blue-500" label="Programados" value={scheduledMatches} total={allMatches.length} />
            <div className="flex items-center justify-between pt-2 border-t border-slate-100 mt-2">
              <span className="text-xs text-slate-400">Total goles</span>
              <span className="text-sm font-bold text-slate-900">{totalGoals}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">Promedio por partido</span>
              <span className="text-sm font-bold text-slate-900">{avgGoals}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Per-edition breakdown */}
      {editionStats.length > 0 && (
        <div>
          <h2 className="text-sm font-bold text-slate-900 mb-3">Desglose por torneo</h2>
          <div className="space-y-3">
            {editionStats.map(({ edition, league, registrations, matches, payments }) => {
              const approved = registrations.filter((r) => r.status === 'approved').length
              const finished = matches.filter((m) => m.status === 'finished').length
              const collected = payments.filter((p) => p.status === 'verified').reduce((s, p) => s + p.amount, 0)
              const statusColors: Record<string, string> = {
                draft: 'bg-slate-100 text-slate-600',
                registration: 'bg-green-100 text-green-700',
                active: 'bg-blue-100 text-blue-700',
                finished: 'bg-slate-100 text-slate-500',
              }
              const statusLabels: Record<string, string> = {
                draft: 'Borrador',
                registration: 'Inscripciones',
                active: 'En curso',
                finished: 'Finalizado',
              }
              return (
                <div key={edition.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                  <div className="flex items-center gap-3 mb-3">
                    {edition.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={edition.logoUrl} alt="" className="w-9 h-9 rounded-lg object-cover border border-slate-200" />
                    ) : (
                      <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center">
                        <Trophy size={16} className="text-slate-400" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-900 truncate">{edition.name}</p>
                      <p className="text-xs text-slate-400">{league.name} — {edition.season}</p>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${statusColors[edition.status] ?? 'bg-slate-100 text-slate-500'}`}>
                      {statusLabels[edition.status] ?? edition.status}
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-3">
                    <MiniStat label="Equipos" value={`${approved}/${edition.maxTeams}`} />
                    <MiniStat label="Partidos" value={`${finished}/${matches.length}`} />
                    <MiniStat label="Recaudado" value={fmtMoney(collected)} />
                    <MiniStat label="Goles" value={String(matches.reduce((s, m) => s + (m.homeScore ?? 0) + (m.awayScore ?? 0), 0))} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function KPICard({
  icon: Icon,
  color,
  label,
  value,
  sub,
}: {
  icon: React.ElementType
  color: string
  label: string
  value: string
  sub: string
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${color}`}>
          <Icon size={15} className="text-white" />
        </div>
        <span className="text-xs text-slate-400 font-medium">{label}</span>
      </div>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      <p className="text-xs text-slate-400 mt-1">{sub}</p>
    </div>
  )
}

function StatRow({
  icon: Icon,
  color,
  label,
  value,
  total,
}: {
  icon: React.ElementType
  color: string
  label: string
  value: number
  total: number
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0
  return (
    <div className="flex items-center gap-3">
      <Icon size={14} className={color} />
      <span className="text-sm text-slate-700 flex-1">{label}</span>
      <span className="text-sm font-bold text-slate-900">{value}</span>
      <span className="text-xs text-slate-400 w-10 text-right">{pct}%</span>
    </div>
  )
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="text-sm font-bold text-slate-800">{value}</p>
    </div>
  )
}
