'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  AlertCircle, ChevronLeft, Loader2, Shield, CheckCircle2, XCircle,
  Plus, TrendingUp, TrendingDown, Wallet, Ban, Trash2, X, Save, Pencil, Receipt, Download,
} from 'lucide-react'
import { clsx } from 'clsx'
import {
  getPaymentsByEdition,
  getPaymentSummary,
  createPayment,
  updatePayment,
  deletePayment,
  type PaymentFromApi,
  type PaymentStatus,
  type EditionPaymentSummary,
} from '@/lib/payments'
import {
  getFinesByEdition,
  createFine,
  updateFine,
  deleteFine,
  type FineFromApi,
  type FineStatus,
} from '@/lib/fines'
import { getRegistrationsByEdition, type RegistrationFromApi } from '@/lib/registrations'
import { getRosterByRegistration, type RegistrationPlayerFromApi } from '@/lib/registration-players'
import { getMatchesByEdition, type MatchFromApi } from '@/lib/matches'
import { getEdition, type EditionFromApi } from '@/lib/leagues'
import { getPlayerStatsByEdition } from '@/lib/player-stats'
import { getEventsByMatch, type MatchEventFromApi } from '@/lib/match-events'
import { downloadFinesExcel, type CardStat, type CardDetail } from '@/lib/fines-excel'
import { Field, inputCls } from '@/components/ui/form'

type Tab = 'registrations' | 'fines' | 'all'

export function PagosManager({
  editionId,
  backHref,
  backLabel = 'Gestionar',
}: {
  editionId: string
  backHref?: string
  backLabel?: string
}) {
  const [edition, setEdition] = useState<EditionFromApi | null>(null)
  const [summary, setSummary] = useState<EditionPaymentSummary | null>(null)
  const [registrations, setRegistrations] = useState<RegistrationFromApi[]>([])
  const [payments, setPayments] = useState<PaymentFromApi[]>([])
  const [fines, setFines] = useState<FineFromApi[]>([])
  const [matches, setMatches] = useState<MatchFromApi[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('registrations')

  // Modals
  const [registerPaymentFor, setRegisterPaymentFor] = useState<RegistrationFromApi | null>(null)
  const [creatingFine, setCreatingFine] = useState(false)
  const [editingFine, setEditingFine] = useState<FineFromApi | null>(null)

  async function reload() {
    const [s, regs, pays, fns, ms] = await Promise.all([
      getPaymentSummary(editionId),
      getRegistrationsByEdition(editionId),
      getPaymentsByEdition(editionId),
      getFinesByEdition(editionId),
      getMatchesByEdition(editionId).catch(() => [] as MatchFromApi[]),
    ])
    setSummary(s)
    setRegistrations(regs)
    setPayments(pays)
    setFines(fns)
    setMatches(ms)
  }

  useEffect(() => {
    Promise.all([
      getEdition(editionId).then(setEdition),
      reload(),
    ])
      .catch(() => setError('No se pudieron cargar los pagos.'))
      .finally(() => setLoading(false))
  }, [editionId])

  // Per-team aggregated registration payments
  const paidByTeam = useMemo(() => {
    const m = new Map<string, number>()
    for (const p of payments) {
      if (p.type !== 'registration' || p.status !== 'verified') continue
      m.set(p.teamId, (m.get(p.teamId) ?? 0) + p.amount)
    }
    return m
  }, [payments])

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-3 py-32 text-slate-400">
        <Loader2 size={22} className="animate-spin" />
        <span className="text-sm">Cargando pagos...</span>
      </div>
    )
  }

  if (error || !edition || !summary) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
        <AlertCircle size={16} /> {error ?? 'No disponible.'}
      </div>
    )
  }

  const approved = registrations.filter((r) => r.status === 'approved')
  const currency = summary.edition.currency

  return (
    <div>
      {/* Top bar */}
      <div className="flex items-center gap-3 mb-6">
        <Link
          href={backHref ?? `/torneos/edicion/${editionId}/gestionar`}
          className="flex items-center gap-1 text-sm text-slate-400 hover:text-slate-700 transition-colors"
        >
          <ChevronLeft size={15} />
          <span>{backLabel}</span>
        </Link>
        <span className="text-slate-300">/</span>
        <span className="text-sm font-semibold text-slate-900">Pagos</span>
      </div>

      {/* Balance */}
      <Balance summary={summary} currency={currency} />

      {/* Tabs */}
      <div className="border-b border-slate-200 mb-5 -mx-2 overflow-x-auto">
        <div className="flex items-center gap-1 px-2">
          <TabButton active={tab === 'registrations'} onClick={() => setTab('registrations')}>
            <Receipt size={15} />
            Inscripciones
            <span className="text-[10px] font-bold text-slate-400 bg-slate-100 rounded px-1.5 py-0.5 ml-1">
              {summary.registrations.teamsPaid}/{summary.edition.teamsApproved}
            </span>
          </TabButton>
          <TabButton active={tab === 'fines'} onClick={() => setTab('fines')}>
            <Ban size={15} />
            Multas y sanciones
            <span className="text-[10px] font-bold text-slate-400 bg-slate-100 rounded px-1.5 py-0.5 ml-1">
              {fines.length}
            </span>
          </TabButton>
          <TabButton active={tab === 'all'} onClick={() => setTab('all')}>
            <Wallet size={15} />
            Movimientos
            <span className="text-[10px] font-bold text-slate-400 bg-slate-100 rounded px-1.5 py-0.5 ml-1">
              {payments.length}
            </span>
          </TabButton>
        </div>
      </div>

      {tab === 'registrations' && (
        <RegistrationsTab
          approved={approved}
          paidByTeam={paidByTeam}
          fee={summary.edition.registrationFee}
          currency={currency}
          onRegisterPayment={setRegisterPaymentFor}
        />
      )}

      {tab === 'fines' && (
        <FinesTab
          fines={fines}
          currency={currency}
          onCreate={() => setCreatingFine(true)}
          onEdit={setEditingFine}
          onDelete={async (id) => {
            if (!confirm('¿Eliminar esta multa?')) return
            await deleteFine(id)
            await reload()
          }}
          onStatusChange={async (id, status) => {
            await updateFine(id, { status })
            await reload()
          }}
          onDownload={async () => {
            // Nombres de equipo por id (desde las inscripciones) para las tarjetas.
            const teamName = new Map(registrations.map((r) => [r.team.id, r.team.name]))
            const stats = await getPlayerStatsByEdition(editionId).catch(() => [])
            const cards: CardStat[] = stats.map((s) => ({
              playerName: s.playerName,
              teamName: teamName.get(s.teamId) ?? '',
              yellow: s.yellowCards,
              red: s.redCards,
              matchesPlayed: s.matchesPlayed,
            }))
            // Detalle por partido: eventos de tarjeta de cada partido finalizado.
            const played = matches.filter((m) => m.status === 'finished' || m.status === 'live')
            const eventsPerMatch = await Promise.all(
              played.map((m) =>
                getEventsByMatch(m.id)
                  .then((evs) => ({ m, evs }))
                  .catch(() => ({ m, evs: [] as MatchEventFromApi[] })),
              ),
            )
            const cardDetails: CardDetail[] = []
            for (const { m, evs } of eventsPerMatch) {
              const home = m.homeTeamId ? teamName.get(m.homeTeamId) ?? 'Local' : 'Local'
              const away = m.awayTeamId ? teamName.get(m.awayTeamId) ?? 'Visitante' : 'Visitante'
              for (const e of evs) {
                if (e.eventType !== 'yellow_card' && e.eventType !== 'red_card') continue
                cardDetails.push({
                  playerName: e.playerName ?? '(jugador)',
                  teamName: e.teamId === m.homeTeamId ? home : e.teamId === m.awayTeamId ? away : '',
                  type: e.eventType,
                  minute: e.minute,
                  matchLabel: `${home} vs ${away}`,
                  matchdayNumber: m.matchdayNumber ?? null,
                  date: m.scheduledAt ?? null,
                })
              }
            }
            downloadFinesExcel({
              editionName: edition?.name ?? 'Campeonato',
              currency,
              fines,
              cards,
              cardDetails,
            })
          }}
        />
      )}

      {tab === 'all' && (
        <PaymentsTab
          payments={payments}
          currency={currency}
          onStatusChange={async (id, status) => {
            await updatePayment(id, { status })
            await reload()
          }}
          onDelete={async (id) => {
            if (!confirm('¿Eliminar este pago? No afecta el registro de la inscripción.')) return
            await deletePayment(id)
            await reload()
          }}
        />
      )}

      {/* Modals */}
      {registerPaymentFor && (
        <RegisterPaymentDialog
          editionId={editionId}
          registration={registerPaymentFor}
          fee={summary.edition.registrationFee}
          currentlyPaid={paidByTeam.get(registerPaymentFor.teamId) ?? 0}
          currency={currency}
          onClose={() => setRegisterPaymentFor(null)}
          onSubmit={async (dto) => {
            await createPayment(dto)
            await reload()
            setRegisterPaymentFor(null)
          }}
        />
      )}

      {(creatingFine || editingFine) && (
        <FineDialog
          editionId={editionId}
          editing={editingFine}
          approved={approved}
          matches={matches}
          currency={currency}
          onClose={() => { setCreatingFine(false); setEditingFine(null) }}
          onSubmit={async (dto) => {
            if (editingFine) {
              const { editionId: _e, teamId: _t, ...rest } = dto
              void _e; void _t
              await updateFine(editingFine.id, rest)
            } else {
              await createFine(dto)
            }
            await reload()
            setCreatingFine(false)
            setEditingFine(null)
          }}
        />
      )}
    </div>
  )
}

// ─── Balance ─────────────────────────────────────────────────────────────────

function Balance({ summary, currency }: { summary: EditionPaymentSummary; currency: string }) {
  const balance = summary.totals.income - summary.totals.pending // informativo: lo cobrado vs lo pendiente
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-5">
      <div className="px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-emerald-50/50 to-white flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center">
          <Wallet size={16} className="text-emerald-700" />
        </div>
        <div>
          <p className="text-sm font-bold text-slate-900">Balance financiero</p>
          <p className="text-xs text-slate-500">Resumen de la edición</p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-slate-100">
        <BalanceCell
          icon={TrendingUp}
          color="text-green-700"
          bg="bg-green-50"
          label="Recaudado"
          value={fmtMoney(summary.totals.income, currency)}
          sub={`Inscripciones ${fmtMoney(summary.registrations.paid, currency)} · Multas ${fmtMoney(summary.fines.paid, currency)}`}
        />
        <BalanceCell
          icon={TrendingDown}
          color="text-amber-700"
          bg="bg-amber-50"
          label="Por cobrar"
          value={fmtMoney(summary.totals.pending, currency)}
          sub={`Inscripciones ${fmtMoney(summary.registrations.pending, currency)} · Multas ${fmtMoney(summary.fines.pending, currency)}`}
        />
        <BalanceCell
          icon={Receipt}
          color="text-blue-700"
          bg="bg-blue-50"
          label="Inscripciones"
          value={`${summary.registrations.teamsPaid} / ${summary.edition.teamsApproved}`}
          sub={`equipos al día · Tarifa ${fmtMoney(summary.edition.registrationFee, currency)}`}
        />
        <BalanceCell
          icon={Ban}
          color="text-red-700"
          bg="bg-red-50"
          label="Multas"
          value={fmtMoney(summary.fines.issued, currency)}
          sub={`${fmtMoney(summary.fines.paid, currency)} pagadas · ${fmtMoney(summary.fines.waived, currency)} perdonadas`}
        />
      </div>

      <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Balance neto recaudado vs pendiente</span>
        <span className={clsx(
          'text-base font-bold tabular-nums',
          balance >= 0 ? 'text-emerald-700' : 'text-amber-700',
        )}>
          {balance >= 0 ? '+' : ''}{fmtMoney(balance, currency)}
        </span>
      </div>
    </div>
  )
}

function BalanceCell({
  icon: Icon, color, bg, label, value, sub,
}: {
  icon: React.ElementType
  color: string
  bg: string
  label: string
  value: string
  sub: string
}) {
  return (
    <div className="p-5">
      <div className="flex items-center gap-2 mb-2">
        <div className={clsx('w-7 h-7 rounded-lg flex items-center justify-center', bg)}>
          <Icon size={13} className={color} />
        </div>
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{label}</p>
      </div>
      <p className="text-lg font-bold text-slate-900 tabular-nums">{value}</p>
      <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">{sub}</p>
    </div>
  )
}

// ─── Tab buttons ──────────────────────────────────────────────────────────────

function TabButton({
  active, onClick, children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap',
        active
          ? 'border-emerald-600 text-emerald-700'
          : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300',
      )}
    >
      {children}
    </button>
  )
}

// ─── Tab: Inscripciones ──────────────────────────────────────────────────────

function RegistrationsTab({
  approved, paidByTeam, fee, currency, onRegisterPayment,
}: {
  approved: RegistrationFromApi[]
  paidByTeam: Map<string, number>
  fee: number
  currency: string
  onRegisterPayment: (reg: RegistrationFromApi) => void
}) {
  if (approved.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 bg-white rounded-2xl border-2 border-dashed border-slate-200">
        <Receipt size={28} className="text-slate-300" />
        <p className="text-sm font-semibold text-slate-500">No hay equipos aprobados</p>
        <p className="text-xs text-slate-400">Aprueba inscripciones primero desde Equipos.</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <table className="w-full">
        <thead className="bg-slate-50 border-b border-slate-100">
          <tr>
            <th className="text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest px-4 py-3">Equipo</th>
            <th className="text-right text-[10px] font-bold text-slate-500 uppercase tracking-widest px-4 py-3 w-32">Pagado</th>
            <th className="text-right text-[10px] font-bold text-slate-500 uppercase tracking-widest px-4 py-3 w-32">Tarifa</th>
            <th className="text-right text-[10px] font-bold text-slate-500 uppercase tracking-widest px-4 py-3 w-32">Saldo</th>
            <th className="text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest px-4 py-3 w-28">Estado</th>
            <th className="text-right text-[10px] font-bold text-slate-500 uppercase tracking-widest px-4 py-3 w-32">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {approved.map((reg) => {
            const paid = paidByTeam.get(reg.teamId) ?? 0
            const balance = fee - paid
            const status: 'paid' | 'partial' | 'pending' = paid >= fee
              ? 'paid' : paid > 0 ? 'partial' : 'pending'
            return (
              <tr key={reg.id} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-4 py-3">
                  <TeamCell team={reg.team} />
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-sm text-slate-700">
                  {fmtMoney(paid, currency)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-sm text-slate-500">
                  {fmtMoney(fee, currency)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-sm font-semibold">
                  <span className={clsx(
                    balance > 0 ? 'text-amber-700' : balance < 0 ? 'text-blue-700' : 'text-green-700',
                  )}>
                    {fmtMoney(Math.max(0, balance), currency)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <PaidStatusPill status={status} />
                </td>
                <td className="px-4 py-3 text-right">
                  {status !== 'paid' && (
                    <button
                      onClick={() => onRegisterPayment(reg)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-emerald-200 bg-emerald-50 text-[11px] font-bold text-emerald-700 hover:bg-emerald-100 transition-colors"
                    >
                      <Plus size={11} /> Registrar pago
                    </button>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function PaidStatusPill({ status }: { status: 'paid' | 'partial' | 'pending' }) {
  const meta = status === 'paid'
    ? { label: 'Al día', bg: 'bg-green-50 border-green-200', text: 'text-green-700', dot: 'bg-green-500' }
    : status === 'partial'
      ? { label: 'Parcial', bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', dot: 'bg-amber-500' }
      : { label: 'Pendiente', bg: 'bg-red-50 border-red-200', text: 'text-red-700', dot: 'bg-red-500' }
  return (
    <span className={clsx('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold border', meta.bg, meta.text)}>
      <span className={clsx('w-1.5 h-1.5 rounded-full', meta.dot)} />
      {meta.label}
    </span>
  )
}

// ─── Tab: Fines ──────────────────────────────────────────────────────────────

function FinesTab({
  fines, currency, onCreate, onEdit, onDelete, onStatusChange, onDownload,
}: {
  fines: FineFromApi[]
  currency: string
  onCreate: () => void
  onEdit: (f: FineFromApi) => void
  onDelete: (id: string) => Promise<void>
  onStatusChange: (id: string, status: FineStatus) => Promise<void>
  onDownload: () => Promise<void>
}) {
  const [downloading, setDownloading] = useState(false)
  return (
    <div>
      <div className="flex justify-end gap-2 mb-3">
        <button
          onClick={async () => { setDownloading(true); try { await onDownload() } finally { setDownloading(false) } }}
          disabled={downloading}
          className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-50 transition-all shadow-sm disabled:opacity-50"
        >
          <Download size={12} /> {downloading ? 'Generando…' : 'Descargar Excel'}
        </button>
        <button
          onClick={onCreate}
          className="flex items-center gap-2 px-3 py-1.5 bg-red-600 text-white text-xs font-bold rounded-xl hover:bg-red-700 transition-all shadow-sm"
        >
          <Plus size={12} /> Nueva multa
        </button>
      </div>

      {fines.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16 bg-white rounded-2xl border-2 border-dashed border-slate-200">
          <Ban size={28} className="text-slate-300" />
          <p className="text-sm font-semibold text-slate-500">Sin multas registradas</p>
          <button onClick={onCreate} className="text-sm font-semibold text-red-600 hover:underline">
            Registrar la primera
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest px-4 py-3">Equipo / Jugador</th>
                <th className="text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest px-4 py-3">Motivo</th>
                <th className="text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest px-4 py-3 w-32">Sanción</th>
                <th className="text-right text-[10px] font-bold text-slate-500 uppercase tracking-widest px-4 py-3 w-28">Monto</th>
                <th className="text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest px-4 py-3 w-28">Estado</th>
                <th className="text-right text-[10px] font-bold text-slate-500 uppercase tracking-widest px-4 py-3 w-28">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {fines.map((f) => (
                <tr key={f.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-4 py-3">
                    {f.team && <TeamCell team={f.team} subtitle={f.playerName ?? undefined} />}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-700">
                    <p className="line-clamp-2 max-w-md">{f.reason}</p>
                  </td>
                  <td className="px-4 py-3">
                    {f.sanction ? (
                      <span className="text-xs text-slate-700">{f.sanction}</span>
                    ) : (
                      <span className="text-xs text-slate-300">—</span>
                    )}
                    {f.matchesBanned > 0 && (
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {f.matchesBanned} {f.matchesBanned === 1 ? 'fecha' : 'fechas'}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-sm font-semibold text-slate-900">
                    {fmtMoney(f.amount, currency)}
                  </td>
                  <td className="px-4 py-3">
                    <FineStatusPill status={f.status} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-1">
                      {f.status === 'pending' && (
                        <>
                          <button
                            onClick={() => onStatusChange(f.id, 'paid')}
                            className="p-1.5 rounded-lg text-green-600 hover:bg-green-50 transition-colors"
                            title="Marcar pagada"
                          >
                            <CheckCircle2 size={13} />
                          </button>
                          <button
                            onClick={() => onStatusChange(f.id, 'waived')}
                            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
                            title="Perdonar"
                          >
                            <XCircle size={13} />
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => onEdit(f)}
                        className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={() => onDelete(f.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function FineStatusPill({ status }: { status: FineStatus }) {
  const meta = status === 'paid'
    ? { label: 'Pagada', bg: 'bg-green-50 border-green-200', text: 'text-green-700', dot: 'bg-green-500' }
    : status === 'waived'
      ? { label: 'Perdonada', bg: 'bg-slate-50 border-slate-200', text: 'text-slate-500', dot: 'bg-slate-400' }
      : { label: 'Pendiente', bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', dot: 'bg-amber-500' }
  return (
    <span className={clsx('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold border', meta.bg, meta.text)}>
      <span className={clsx('w-1.5 h-1.5 rounded-full', meta.dot)} />
      {meta.label}
    </span>
  )
}

// ─── Tab: All payments / movimientos ─────────────────────────────────────────

function PaymentsTab({
  payments, currency, onStatusChange, onDelete,
}: {
  payments: PaymentFromApi[]
  currency: string
  onStatusChange: (id: string, status: PaymentStatus) => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  if (payments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 bg-white rounded-2xl border-2 border-dashed border-slate-200">
        <Wallet size={28} className="text-slate-300" />
        <p className="text-sm font-semibold text-slate-500">Sin movimientos registrados</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <table className="w-full">
        <thead className="bg-slate-50 border-b border-slate-100">
          <tr>
            <th className="text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest px-4 py-3 w-28">Fecha</th>
            <th className="text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest px-4 py-3">Equipo</th>
            <th className="text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest px-4 py-3 w-28">Tipo</th>
            <th className="text-right text-[10px] font-bold text-slate-500 uppercase tracking-widest px-4 py-3 w-28">Monto</th>
            <th className="text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest px-4 py-3 w-28">Estado</th>
            <th className="text-right text-[10px] font-bold text-slate-500 uppercase tracking-widest px-4 py-3 w-28">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {payments.map((p) => (
            <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
              <td className="px-4 py-3 text-xs text-slate-500">
                {new Date(p.createdAt).toLocaleDateString('es-CO', {
                  day: '2-digit', month: 'short', year: 'numeric',
                })}
              </td>
              <td className="px-4 py-3">
                {p.team && <TeamCell team={p.team} />}
              </td>
              <td className="px-4 py-3">
                <PaymentTypePill type={p.type} />
              </td>
              <td className="px-4 py-3 text-right tabular-nums text-sm font-semibold text-slate-900">
                {fmtMoney(p.amount, p.currency || currency)}
              </td>
              <td className="px-4 py-3">
                <PaymentStatusPill status={p.status} />
              </td>
              <td className="px-4 py-3 text-right">
                <div className="inline-flex items-center gap-1">
                  {p.status === 'pending' && (
                    <>
                      <button
                        onClick={() => onStatusChange(p.id, 'verified')}
                        className="p-1.5 rounded-lg text-green-600 hover:bg-green-50 transition-colors"
                        title="Verificar"
                      >
                        <CheckCircle2 size={13} />
                      </button>
                      <button
                        onClick={() => onStatusChange(p.id, 'rejected')}
                        className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 transition-colors"
                        title="Rechazar"
                      >
                        <XCircle size={13} />
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => onDelete(p.id)}
                    className="p-1.5 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function PaymentTypePill({ type }: { type: 'registration' | 'fine' | 'other' }) {
  const meta = type === 'registration'
    ? { label: 'Inscripción', bg: 'bg-blue-50 border-blue-200', text: 'text-blue-700' }
    : type === 'fine'
      ? { label: 'Multa', bg: 'bg-red-50 border-red-200', text: 'text-red-700' }
      : { label: 'Otro', bg: 'bg-slate-50 border-slate-200', text: 'text-slate-600' }
  return (
    <span className={clsx('inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border', meta.bg, meta.text)}>
      {meta.label}
    </span>
  )
}

function PaymentStatusPill({ status }: { status: 'pending' | 'verified' | 'rejected' }) {
  const meta = status === 'verified'
    ? { label: 'Verificado', bg: 'bg-green-50 border-green-200', text: 'text-green-700', dot: 'bg-green-500' }
    : status === 'rejected'
      ? { label: 'Rechazado', bg: 'bg-red-50 border-red-200', text: 'text-red-700', dot: 'bg-red-500' }
      : { label: 'Pendiente', bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', dot: 'bg-amber-500' }
  return (
    <span className={clsx('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold border', meta.bg, meta.text)}>
      <span className={clsx('w-1.5 h-1.5 rounded-full', meta.dot)} />
      {meta.label}
    </span>
  )
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function TeamCell({
  team, subtitle,
}: {
  team: { name: string; logoUrl: string | null; primaryColor: string | null; shortName: string | null }
  subtitle?: string
}) {
  return (
    <div className="flex items-center gap-2.5">
      {team.logoUrl ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img src={team.logoUrl} alt="" className="w-7 h-7 rounded-md object-cover border border-slate-200 flex-shrink-0" />
      ) : (
        <div
          className="w-7 h-7 rounded-md border border-slate-200 flex items-center justify-center flex-shrink-0"
          style={team.primaryColor ? { background: `${team.primaryColor}18` } : undefined}
        >
          <Shield size={11} style={{ color: team.primaryColor ?? '#94a3b8' }} />
        </div>
      )}
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-900 truncate">{team.name}</p>
        {subtitle && <p className="text-[10px] text-slate-400 truncate">{subtitle}</p>}
      </div>
    </div>
  )
}

function fmtMoney(amount: number, currency: string): string {
  return `${currency} ${amount.toLocaleString('es-CO')}`
}

// ─── Register payment dialog ─────────────────────────────────────────────────

function RegisterPaymentDialog({
  editionId, registration, fee, currentlyPaid, currency, onClose, onSubmit,
}: {
  editionId: string
  registration: RegistrationFromApi
  fee: number
  currentlyPaid: number
  currency: string
  onClose: () => void
  onSubmit: (dto: {
    editionId: string; teamId: string; registrationId: string
    type: 'registration'; amount: number; currency: string; notes?: string; receiptUrl?: string
  }) => Promise<void>
}) {
  const remaining = Math.max(0, fee - currentlyPaid)
  const [amount, setAmount] = useState(remaining.toString())
  const [notes, setNotes] = useState('')
  const [receiptUrl, setReceiptUrl] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const n = parseInt(amount)
    if (!Number.isFinite(n) || n <= 0) { setError('Monto inválido.'); return }
    setSubmitting(true)
    setError(null)
    try {
      await onSubmit({
        editionId, teamId: registration.teamId, registrationId: registration.id,
        type: 'registration', amount: n, currency,
        notes: notes.trim() || undefined,
        receiptUrl: receiptUrl.trim() || undefined,
      })
    } catch {
      setError('No se pudo registrar el pago.')
      setSubmitting(false)
    }
  }

  return (
    <Modal title={`Registrar pago — ${registration.team.name}`} onClose={onClose} disabled={submitting}>
      <form onSubmit={submit} className="space-y-4">
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Tarifa</p>
            <p className="text-sm font-bold text-slate-900 mt-1 tabular-nums">{fmtMoney(fee, currency)}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Pagado</p>
            <p className="text-sm font-bold text-emerald-700 mt-1 tabular-nums">{fmtMoney(currentlyPaid, currency)}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Saldo</p>
            <p className="text-sm font-bold text-amber-700 mt-1 tabular-nums">{fmtMoney(remaining, currency)}</p>
          </div>
        </div>

        <Field label="Monto a registrar">
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">{currency}</span>
            <input type="number" min={1} className={clsx(inputCls, 'pl-14')} value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
        </Field>

        <Field label="Comprobante (URL)" hint="Opcional · enlace a Drive, Dropbox, etc.">
          <input type="url" className={inputCls} value={receiptUrl} onChange={(e) => setReceiptUrl(e.target.value)} placeholder="https://..." />
        </Field>

        <Field label="Notas" hint="Opcional">
          <textarea rows={2} className={inputCls} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Transferencia, abono parcial, etc." />
        </Field>

        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
            <AlertCircle size={12} /> {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} disabled={submitting}
            className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
            Cancelar
          </button>
          <button type="submit" disabled={submitting}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700 disabled:opacity-60 transition-colors">
            {submitting ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
            Registrar
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ─── Fine dialog ──────────────────────────────────────────────────────────────

function FineDialog({
  editionId, editing, approved, matches, currency, onClose, onSubmit,
}: {
  editionId: string
  editing: FineFromApi | null
  approved: RegistrationFromApi[]
  matches: MatchFromApi[]
  currency: string
  onClose: () => void
  onSubmit: (dto: {
    editionId: string; teamId: string; reason: string; matchId?: string
    amount?: number; sanction?: string; matchesBanned?: number; playerName?: string; status?: FineStatus
  }) => Promise<void>
}) {
  const [teamId, setTeamId] = useState(editing?.teamId ?? approved[0]?.teamId ?? '')
  const [playerName, setPlayerName] = useState(editing?.playerName ?? '')
  const [reason, setReason] = useState(editing?.reason ?? '')
  const [amount, setAmount] = useState((editing?.amount ?? 0).toString())
  const [sanction, setSanction] = useState(editing?.sanction ?? '')
  const [matchesBanned, setMatchesBanned] = useState((editing?.matchesBanned ?? 0).toString())
  const [matchId, setMatchId] = useState<string>(editing?.matchId ?? '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Roster of the selected team
  const [roster, setRoster] = useState<RegistrationPlayerFromApi[]>([])
  const [loadingRoster, setLoadingRoster] = useState(false)
  // 'manual' = type free text; '' = no player; else = playerName from roster
  const initialMode: 'team' | 'manual' = editing?.playerName ? 'manual' : 'team'
  const [playerMode, setPlayerMode] = useState<'team' | 'manual'>(initialMode)

  useEffect(() => {
    if (!teamId) { setRoster([]); return }
    const reg = approved.find((r) => r.teamId === teamId)
    if (!reg) { setRoster([]); return }
    let cancelled = false
    setLoadingRoster(true)
    getRosterByRegistration(reg.id)
      .then((rows) => { if (!cancelled) setRoster(rows) })
      .catch(() => { if (!cancelled) setRoster([]) })
      .finally(() => { if (!cancelled) setLoadingRoster(false) })
    return () => { cancelled = true }
  }, [teamId, approved])

  // If editing has a player but it matches a roster entry, prefer the dropdown
  useEffect(() => {
    if (!editing?.playerName) return
    if (roster.some((p) => p.playerName === editing.playerName)) {
      setPlayerMode('team')
    }
  }, [editing, roster])

  // Matches involving the selected team, finalized first then scheduled
  const teamMatches = teamId
    ? matches
        .filter((m) => m.homeTeamId === teamId || m.awayTeamId === teamId)
        .sort((a, b) => {
          // finished matches up top
          if (a.status === 'finished' && b.status !== 'finished') return -1
          if (b.status === 'finished' && a.status !== 'finished') return 1
          const ad = a.scheduledAt ? new Date(a.scheduledAt).getTime() : 0
          const bd = b.scheduledAt ? new Date(b.scheduledAt).getTime() : 0
          return bd - ad
        })
    : []

  // Build a quick lookup for opponent names
  function matchLabel(m: MatchFromApi): string {
    const homeName = approved.find((r) => r.teamId === m.homeTeamId)?.team.name ?? 'Local'
    const awayName = approved.find((r) => r.teamId === m.awayTeamId)?.team.name ?? 'Visitante'
    const round = m.round ? `${m.round} · ` : ''
    const score = m.status === 'finished' ? ` (${m.homeScore ?? 0}-${m.awayScore ?? 0})` : ''
    return `${round}${homeName} vs ${awayName}${score}`
  }

  // Reset selected match when changing team if the match no longer involves the new team
  useEffect(() => {
    if (!matchId) return
    const stillValid = matches.some((m) => m.id === matchId && (m.homeTeamId === teamId || m.awayTeamId === teamId))
    if (!stillValid) setMatchId('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!teamId) { setError('Selecciona un equipo.'); return }
    if (reason.trim().length < 2) { setError('Describe el motivo.'); return }
    setSubmitting(true)
    setError(null)
    try {
      await onSubmit({
        editionId, teamId,
        reason: reason.trim(),
        amount: parseInt(amount) || 0,
        sanction: sanction.trim() || undefined,
        matchesBanned: parseInt(matchesBanned) || 0,
        playerName: playerName.trim() || undefined,
        matchId: matchId || undefined,
      })
    } catch {
      setError('No se pudo guardar.')
      setSubmitting(false)
    }
  }

  return (
    <Modal title={editing ? 'Editar multa' : 'Nueva multa / sanción'} onClose={onClose} disabled={submitting}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Equipo">
          <select className={inputCls} value={teamId} onChange={(e) => setTeamId(e.target.value)} disabled={Boolean(editing)}>
            <option value="">— Selecciona —</option>
            {approved.map((r) => (
              <option key={r.id} value={r.teamId}>{r.team.name}</option>
            ))}
          </select>
        </Field>

        <Field label="Jugador (opcional)" hint="Solo si la multa es individual">
          <div className="space-y-2">
            <div className="inline-flex items-center rounded-lg border border-slate-200 overflow-hidden text-[10px] font-bold">
              <button
                type="button"
                onClick={() => { setPlayerMode('team'); setPlayerName('') }}
                className={clsx(
                  'px-2.5 py-1 transition-colors',
                  playerMode === 'team' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-50',
                )}
              >
                De la plantilla
              </button>
              <button
                type="button"
                onClick={() => { setPlayerMode('manual'); setPlayerName('') }}
                className={clsx(
                  'px-2.5 py-1 transition-colors',
                  playerMode === 'manual' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-50',
                )}
              >
                Manual
              </button>
            </div>

            {playerMode === 'team' ? (
              <select
                className={inputCls}
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                disabled={!teamId || loadingRoster}
              >
                <option value="">
                  {!teamId
                    ? 'Selecciona un equipo primero'
                    : loadingRoster
                      ? 'Cargando jugadores...'
                      : roster.length === 0
                        ? 'Sin jugadores en la plantilla'
                        : '— Selecciona —'}
                </option>
                {roster.map((p) => (
                  <option key={p.id} value={p.playerName}>
                    {p.jerseyNumber != null ? `#${p.jerseyNumber} · ` : ''}{p.playerName}
                    {p.position ? ` (${p.position})` : ''}
                  </option>
                ))}
              </select>
            ) : (
              <input
                className={inputCls}
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="Nombre del jugador (sin plantilla)"
              />
            )}
          </div>
        </Field>

        <Field label="Partido (opcional)" hint="Solo aparecen partidos del equipo seleccionado">
          <select
            className={inputCls}
            value={matchId}
            onChange={(e) => setMatchId(e.target.value)}
            disabled={!teamId || teamMatches.length === 0}
          >
            <option value="">
              {!teamId
                ? 'Selecciona un equipo primero'
                : teamMatches.length === 0
                  ? 'Sin partidos del equipo'
                  : '— Sin asignar —'}
            </option>
            {teamMatches.map((m) => (
              <option key={m.id} value={m.id}>
                {matchLabel(m)}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Motivo">
          <textarea rows={2} className={inputCls} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Acumulación de tarjetas, agresión, no presentación..." />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Monto">
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">{currency}</span>
              <input type="number" min={0} className={clsx(inputCls, 'pl-14')} value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
          </Field>
          <Field label="Fechas de suspensión">
            <input type="number" min={0} className={inputCls} value={matchesBanned} onChange={(e) => setMatchesBanned(e.target.value)} />
          </Field>
        </div>

        <Field label="Sanción" hint="Opcional · ej: Suspensión 1 partido, expulsión, etc.">
          <input className={inputCls} value={sanction} onChange={(e) => setSanction(e.target.value)} />
        </Field>

        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
            <AlertCircle size={12} /> {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} disabled={submitting}
            className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
            Cancelar
          </button>
          <button type="submit" disabled={submitting}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-red-600 text-white text-xs font-bold rounded-lg hover:bg-red-700 disabled:opacity-60 transition-colors">
            {submitting ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
            {editing ? 'Guardar' : 'Registrar multa'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ─── Modal wrapper ────────────────────────────────────────────────────────────

function Modal({
  title, children, onClose, disabled = false,
}: {
  title: string
  children: React.ReactNode
  onClose: () => void
  disabled?: boolean
}) {
  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={disabled ? undefined : onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 sticky top-0 bg-white z-10">
            <h2 className="text-base font-bold text-slate-900">{title}</h2>
            <button onClick={onClose} disabled={disabled} className="text-slate-400 hover:text-slate-700 transition-colors disabled:opacity-50">
              <X size={18} />
            </button>
          </div>
          <div className="px-5 py-4">{children}</div>
        </div>
      </div>
    </>
  )
}

