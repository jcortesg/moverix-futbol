'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  ChevronLeft, Loader2, AlertCircle, Trophy, Pencil,
  Users, Calendar, Layers, Swords, Table2, DollarSign,
  Clock, FileText, Settings2, CheckCircle2, XCircle, Scale,
} from 'lucide-react'
import { clsx } from 'clsx'
import {
  getEdition,
  getLeague,
  normalizeFormatConfig,
  DEFAULT_TIEBREAKERS,
  TIEBREAKER_LABEL,
  PHASE_KIND_LABEL,
  type EditionFromApi,
  type PhaseGroups,
  type PhaseKnockout,
  type PhaseMultiCup,
  type TiebreakerRules,
} from '@/lib/leagues'
import { useActiveEdition } from '@/contexts/ActiveEditionContext'
import { FORMAT_TEMPLATES, STATUSES } from '@/components/torneos/edition-form'

type ManageTile = {
  label: string
  desc: string
  icon: React.ElementType
  color: string
  bg: string
  href?: string
}

const TILES = (editionId: string): ManageTile[] => [
  { label: 'Equipos',    desc: 'Inscripciones y plantilla',  icon: Users,     color: 'text-green-700',   bg: 'bg-green-50 border-green-200',   href: `/torneos/edicion/${editionId}/gestionar/equipos` },
  { label: 'Grupos',     desc: 'Sorteo y organización',      icon: Layers,    color: 'text-blue-700',    bg: 'bg-blue-50 border-blue-200',     href: `/torneos/edicion/${editionId}/gestionar/grupos` },
  { label: 'Fixture',    desc: 'Partidos y jornadas',        icon: Calendar,  color: 'text-orange-700',  bg: 'bg-orange-50 border-orange-200',   href: `/torneos/edicion/${editionId}/gestionar/partidos` },
  { label: 'Bracket',    desc: 'Llave eliminatoria',         icon: Swords,    color: 'text-indigo-700',  bg: 'bg-indigo-50 border-indigo-200', href: `/torneos/edicion/${editionId}/gestionar/bracket` },
  { label: 'Posiciones', desc: 'Tabla y estadísticas',       icon: Table2,    color: 'text-purple-700',  bg: 'bg-purple-50 border-purple-200', href: `/torneos/edicion/${editionId}/gestionar/tabla` },
  { label: 'Pagos',      desc: 'Inscripciones y multas',     icon: DollarSign, color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', href: `/torneos/edicion/${editionId}/gestionar/pagos` },
]

export default function GestionarEdicionPage({ params }: { params: { id: string } }) {
  const [edition, setEdition] = useState<EditionFromApi | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { setActiveEdition } = useActiveEdition()

  useEffect(() => {
    getEdition(params.id)
      .then(async (ed) => {
        setEdition(ed)
        const league = await getLeague(ed.leagueId).catch(() => null)
        setActiveEdition({
          id: ed.id,
          name: ed.name,
          season: ed.season,
          leagueId: ed.leagueId,
          leagueName: league?.name ?? ed.name,
          logoUrl: ed.logoUrl,
          bannerUrl: ed.bannerUrl,
        })
      })
      .catch(() => setError('No se pudo cargar la edición.'))
      .finally(() => setLoading(false))
  }, [params.id, setActiveEdition])

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-3 py-32 text-slate-400">
        <Loader2 size={22} className="animate-spin" />
        <span className="text-sm">Cargando edición...</span>
      </div>
    )
  }

  if (error || !edition) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
        <AlertCircle size={16} /> {error ?? 'Edición no encontrada.'}
      </div>
    )
  }

  return (
    <div>
      {/* Top bar */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/torneos" className="flex items-center gap-1 text-sm text-slate-400 hover:text-slate-700 transition-colors">
          <ChevronLeft size={15} />
          <span>Torneos</span>
        </Link>
        <span className="text-slate-300">/</span>
        <span className="text-sm font-semibold text-slate-900 truncate max-w-xs">{edition.name}</span>
        <span className="text-slate-300">/</span>
        <span className="text-sm text-slate-500">Gestionar</span>
        <div className="flex-1" />
        <Link
          href={`/torneos/edicion/${edition.id}`}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
        >
          <Pencil size={12} />
          Editar edición
        </Link>
      </div>

      {/* Hero mini */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-6">
        <div className="relative h-28 bg-gradient-to-br from-slate-800 to-slate-700 overflow-hidden">
          {edition.bannerUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={edition.bannerUrl} alt="" className="w-full h-full object-cover" />
          ) : null}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
        </div>
        <div className="px-6 py-4 flex items-center gap-4 -mt-8">
          <div className="w-16 h-16 rounded-2xl border-2 border-white shadow-xl overflow-hidden flex-shrink-0 bg-white relative z-10">
            {edition.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={edition.logoUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-slate-100 flex items-center justify-center">
                <Trophy size={24} className="text-slate-400" />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-slate-900 truncate">{edition.name}</h1>
            <p className="text-xs text-slate-400">{edition.season}</p>
          </div>
        </div>
      </div>

      {/* Configuración */}
      <ConfigSummary edition={edition} />

      {/* Tiles */}
      <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3">Módulos de gestión</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {TILES(edition.id).map(({ label, desc, icon: Icon, color, bg, href }) => {
          const enabled = Boolean(href)
          const inner = (
            <>
              <div className={clsx('w-10 h-10 rounded-xl flex items-center justify-center mb-3 border', bg)}>
                <Icon size={18} className={color} />
              </div>
              <p className="text-sm font-bold text-slate-900">{label}</p>
              <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
              {!enabled && (
                <span className="absolute top-4 right-4 text-[10px] font-bold uppercase tracking-wide text-slate-400 bg-slate-100 rounded px-2 py-0.5">
                  Próximamente
                </span>
              )}
            </>
          )
          const className = clsx(
            'relative rounded-2xl border p-5 transition-all block',
            enabled
              ? 'border-slate-200 bg-white hover:shadow-md hover:border-slate-300 cursor-pointer'
              : 'border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed',
          )
          return enabled ? (
            <Link key={label} href={href!} className={className}>{inner}</Link>
          ) : (
            <div key={label} className={className}>{inner}</div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Config summary ──────────────────────────────────────────────────────────

function fmtDate(d: string | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}

function fmtMoney(amount: number, currency: string): string {
  if (!amount) return '—'
  return `${currency} ${amount.toLocaleString('es-CO')}`
}

function ConfigSummary({ edition }: { edition: EditionFromApi }) {
  const status = STATUSES.find((s) => s.value === edition.status)
  const cfg = normalizeFormatConfig(edition.formatConfig as Record<string, unknown>)
  const fmt = FORMAT_TEMPLATES.find((f) => f.id === cfg.type)
  const tb: TiebreakerRules = edition.tiebreakerRules ?? DEFAULT_TIEBREAKERS
  // Primary criterion is always points; the rest are the ordered tiebreakers.
  const tbOrder = tb.order.filter((c) => c !== 'points')

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm mb-6 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-slate-50">
        <div className="flex items-center gap-2">
          <Settings2 size={14} className="text-slate-500" />
          <p className="text-sm font-bold text-slate-800">Configuración de la edición</p>
        </div>
        {status && (
          <span className={clsx('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border', status.bg, status.color)}>
            <span className={clsx('w-1.5 h-1.5 rounded-full', status.dot)} />
            {status.label}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 divide-y xl:divide-y-0 xl:divide-x md:divide-y-0 md:divide-x divide-slate-100">
        {/* Formato */}
        <div className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <Trophy size={12} className="text-indigo-500" />
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Formato</p>
          </div>
          {fmt ? (
            <>
              <p className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                <span>{fmt.icon}</span> {fmt.label}
              </p>
              <div className="mt-2 space-y-1">
                {cfg.phases.map((phase, i) => (
                  <p key={i} className="text-xs text-slate-500">
                    Fase {i + 1}: {PHASE_KIND_LABEL[phase.kind]}
                    {phase.kind === 'groups' && ` · ${(phase as PhaseGroups).groupCount} grupos · ${(phase as PhaseGroups).teamsPerGroup} eq. c/u · clasifican ${(phase as PhaseGroups).qualifiersPerGroup}`}
                    {phase.kind === 'round_robin' && (phase.doubleLeg ? ' · ida y vuelta' : '')}
                    {phase.kind === 'knockout' && ` · bracket de ${(phase as PhaseKnockout).bracketSize}${(phase as PhaseKnockout).hasThirdPlace ? ' · 3° lugar' : ''}${(phase as PhaseKnockout).hasRepechage ? ' · repechaje' : ''}`}
                    {phase.kind === 'multi_cup' && ` · ${(phase as PhaseMultiCup).cups.length} copas${(phase as PhaseMultiCup).cups.length > 0 ? `: ${(phase as PhaseMultiCup).cups.map((c) => c.name).join(', ')}` : ''}`}
                  </p>
                ))}
              </div>
            </>
          ) : (
            <p className="text-xs text-slate-400 italic">Sin formato configurado</p>
          )}
        </div>

        {/* Fechas */}
        <div className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <Calendar size={12} className="text-orange-500" />
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Fechas</p>
          </div>
          <div className="space-y-2">
            <SummaryLine label="Inscripción" value={
              cfg.registrationOpen || cfg.registrationClose
                ? `${fmtDate(cfg.registrationOpen ?? null)} → ${fmtDate(cfg.registrationClose ?? null)}`
                : '—'
            } />
            <SummaryLine label="Torneo" value={
              edition.startDate || edition.endDate
                ? `${fmtDate(edition.startDate)} → ${fmtDate(edition.endDate)}`
                : '—'
            } />
          </div>
        </div>

        {/* Equipos & Reglas */}
        <div className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <Users size={12} className="text-green-600" />
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Equipos y reglas</p>
          </div>
          <div className="space-y-2">
            <SummaryLine label="Máximo" value={`${edition.maxTeams} equipos`} />
            {cfg.minutesPerHalf ? (
              <SummaryLine
                label="Duración"
                value={<span className="inline-flex items-center gap-1"><Clock size={11} className="text-slate-400" /> {cfg.minutesPerHalf * 2} min ({cfg.minutesPerHalf}×2)</span>}
              />
            ) : (
              <SummaryLine label="Duración" value="—" />
            )}
            <SummaryLine
              label="Tiempo extra"
              value={cfg.hasExtraTime
                ? <span className="inline-flex items-center gap-1 text-green-600"><CheckCircle2 size={11} /> Sí</span>
                : <span className="inline-flex items-center gap-1 text-slate-400"><XCircle size={11} /> No</span>}
            />
            <SummaryLine
              label="Penales"
              value={cfg.hasPenalties
                ? <span className="inline-flex items-center gap-1 text-green-600"><CheckCircle2 size={11} /> Sí</span>
                : <span className="inline-flex items-center gap-1 text-slate-400"><XCircle size={11} /> No</span>}
            />
          </div>
        </div>

        {/* Finanzas & Docs */}
        <div className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <DollarSign size={12} className="text-emerald-500" />
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Finanzas y docs</p>
          </div>
          <div className="space-y-2">
            <SummaryLine label="Inscripción" value={fmtMoney(edition.registrationFee, edition.currency)} />
            <SummaryLine label="Premio" value={fmtMoney(edition.prizePool, edition.currency)} />
            <SummaryLine
              label="Reglamento"
              value={edition.rulesUrl
                ? <a href={edition.rulesUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-blue-600 hover:underline">
                    <FileText size={11} /> Ver
                  </a>
                : '—'}
            />
          </div>
        </div>
      </div>

      {/* Puntuación y desempates */}
      <div className="border-t border-slate-100 bg-slate-50/50 px-5 py-4">
        <div className="flex items-start gap-6 flex-wrap">
          <div className="flex items-center gap-2">
            <Scale size={12} className="text-slate-500" />
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
              Puntuación y desempates
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <PointsPill color="green" label="Ganado" value={tb.winPts} />
            {tb.allowDraw && <PointsPill color="amber" label="Empate" value={tb.drawPts} />}
            <PointsPill color="slate" label="Perdido" value={tb.lossPts} />
          </div>

          {tbOrder.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap min-w-0">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Orden</span>
              <div className="flex items-center flex-wrap gap-1.5">
                {tbOrder.map((c, i) => (
                  <span key={c} className="inline-flex items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white border border-slate-200 text-[11px] font-semibold text-slate-700">
                      <span className="text-slate-400 font-mono">{i + 1}</span>
                      {TIEBREAKER_LABEL[c]}
                    </span>
                    {i < tbOrder.length - 1 && <span className="text-slate-300">→</span>}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function PointsPill({
  label, value, color,
}: {
  label: string
  value: number
  color: 'green' | 'amber' | 'slate'
}) {
  const styles = color === 'green' ? 'bg-green-50 border-green-200 text-green-700'
    : color === 'amber' ? 'bg-amber-50 border-amber-200 text-amber-700'
    : 'bg-slate-100 border-slate-200 text-slate-600'
  return (
    <span className={clsx('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[11px] font-semibold', styles)}>
      {label}
      <span className="font-bold tabular-nums">{value}</span>
      <span className="text-[9px] font-bold uppercase tracking-wide opacity-60">pts</span>
    </span>
  )
}

function SummaryLine({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-xs text-slate-500">{label}</span>
      <span className="text-xs font-semibold text-slate-800 text-right">{value}</span>
    </div>
  )
}
