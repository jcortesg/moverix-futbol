'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Loader2, AlertCircle, Plus, Trash2, CheckCircle2, XCircle, RefreshCw,
  Calendar, ExternalLink,
} from 'lucide-react'
import Link from 'next/link'
import { getMatchesByEdition, finalizeMatch, type MatchFromApi } from '@/lib/matches'
import { getRegistrationsByEdition } from '@/lib/registrations'
import {
  getPaymentsByTeam, createPayment, updatePayment, deletePayment, type PaymentFromApi,
} from '@/lib/payments'
import {
  getFinesByEdition, createFine, updateFine, deleteFine, type FineFromApi,
} from '@/lib/fines'
import { getPlayerStatsByTeam, recomputeStats, type PlayerStatFromApi } from '@/lib/player-stats'
import { getRosterByRegistration } from '@/lib/registration-players'

function fmtMoney(amount: number, currency: string) {
  return `${currency} ${Number(amount).toLocaleString('es-CO')}`
}
function fmtDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

/* ══════════════ PARTIDOS DEL EQUIPO ══════════════ */

const MATCH_STATUS: Record<string, { label: string; cls: string }> = {
  scheduled: { label: 'Programado', cls: 'bg-slate-100 text-slate-600' },
  live: { label: 'En vivo', cls: 'bg-red-100 text-red-700' },
  finished: { label: 'Finalizado', cls: 'bg-green-100 text-green-700' },
  postponed: { label: 'Aplazado', cls: 'bg-amber-100 text-amber-700' },
  cancelled: { label: 'Cancelado', cls: 'bg-slate-100 text-slate-500' },
  walkover: { label: 'W.O.', cls: 'bg-purple-100 text-purple-700' },
}

export function TeamMatchesTab({ editionId, teamId }: { editionId: string; teamId: string }) {
  const [matches, setMatches] = useState<MatchFromApi[]>([])
  const [names, setNames] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [hs, setHs] = useState('')
  const [as_, setAs] = useState('')

  async function load() {
    setLoading(true)
    try {
      const [ms, regs] = await Promise.all([
        getMatchesByEdition(editionId),
        getRegistrationsByEdition(editionId),
      ])
      const nm: Record<string, string> = {}
      regs.forEach((r) => { nm[r.team.id] = r.team.name })
      setNames(nm)
      setMatches(ms.filter((m) => m.homeTeamId === teamId || m.awayTeamId === teamId))
      setError(null)
    } catch {
      setError('No se pudieron cargar los partidos.')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [editionId, teamId])

  async function saveScore(m: MatchFromApi) {
    const h = parseInt(hs, 10), a = parseInt(as_, 10)
    if (Number.isNaN(h) || Number.isNaN(a)) return
    await finalizeMatch(m.id, { homeScore: h, awayScore: a })
    setEditing(null); setHs(''); setAs('')
    load()
  }

  if (loading) return <Loading />
  if (error) return <ErrorBox msg={error} />
  if (matches.length === 0) return <Empty msg="Este equipo no tiene partidos en la edición." />

  return (
    <div className="space-y-2">
      {matches.map((m) => {
        const isHome = m.homeTeamId === teamId
        const rivalId = isHome ? m.awayTeamId : m.homeTeamId
        const rival = rivalId ? names[rivalId] ?? 'Rival' : 'Por definir'
        const st = MATCH_STATUS[m.status] ?? MATCH_STATUS.scheduled
        const hasScore = m.homeScore != null && m.awayScore != null
        const myScore = isHome ? m.homeScore : m.awayScore
        const rivalScore = isHome ? m.awayScore : m.homeScore
        return (
          <div key={m.id} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
            <div className="flex flex-col items-center w-14 shrink-0">
              <Calendar size={13} className="text-slate-400" />
              <span className="text-[10px] text-slate-500 mt-0.5">J{m.matchdayNumber ?? '?'}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-900 truncate">
                {isHome ? 'vs' : '@'} {rival}
              </p>
              <p className="text-xs text-slate-400">{fmtDate(m.scheduledAt)}</p>
            </div>
            {editing === m.id ? (
              <div className="flex items-center gap-1">
                <input value={hs} onChange={(e) => setHs(e.target.value)} placeholder="L" className="w-10 rounded border border-slate-300 px-2 py-1 text-sm text-center" />
                <span className="text-slate-400">-</span>
                <input value={as_} onChange={(e) => setAs(e.target.value)} placeholder="V" className="w-10 rounded border border-slate-300 px-2 py-1 text-sm text-center" />
                <button onClick={() => saveScore(m)} className="rounded bg-green-600 px-2 py-1 text-xs font-semibold text-white">OK</button>
                <button onClick={() => setEditing(null)} className="rounded bg-slate-100 px-2 py-1 text-xs">✕</button>
              </div>
            ) : (
              <>
                {hasScore ? (
                  <span className="text-sm font-bold text-slate-900 tabular-nums">{myScore} - {rivalScore}</span>
                ) : null}
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${st.cls}`}>{st.label}</span>
                <button
                  onClick={() => { setEditing(m.id); setHs(String(m.homeScore ?? '')); setAs(String(m.awayScore ?? '')) }}
                  className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  {hasScore ? 'Editar' : 'Marcador'}
                </button>
                <Link href={`/torneos/edicion/${editionId}/gestionar/partidos`} className="text-slate-400 hover:text-slate-700" title="Gestión completa">
                  <ExternalLink size={15} />
                </Link>
              </>
            )}
          </div>
        )
      })}
    </div>
  )
}

/* ══════════════ PAGOS DEL EQUIPO ══════════════ */

const PAY_STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: 'Pendiente', cls: 'bg-amber-100 text-amber-700' },
  verified: { label: 'Verificado', cls: 'bg-green-100 text-green-700' },
  rejected: { label: 'Rechazado', cls: 'bg-red-100 text-red-700' },
}

export function TeamPaymentsTab({
  editionId, teamId, registrationId, currency, fee,
}: { editionId: string; teamId: string; registrationId: string; currency: string; fee: number }) {
  const [payments, setPayments] = useState<PaymentFromApi[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [amount, setAmount] = useState(String(fee || ''))
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)

  async function load() {
    setLoading(true)
    try { setPayments(await getPaymentsByTeam(editionId, teamId)); setError(null) }
    catch { setError('No se pudieron cargar los pagos.') }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [editionId, teamId])

  const verified = useMemo(
    () => payments.filter((p) => p.status === 'verified').reduce((s, p) => s + Number(p.amount), 0),
    [payments],
  )

  async function add() {
    const amt = parseFloat(amount)
    if (Number.isNaN(amt) || amt <= 0) return
    setBusy(true)
    try {
      await createPayment({ editionId, teamId, registrationId, type: 'registration', amount: amt, currency, notes: notes || undefined })
      setAdding(false); setAmount(String(fee || '')); setNotes('')
      load()
    } finally { setBusy(false) }
  }
  async function setStatus(id: string, status: 'verified' | 'rejected') {
    await updatePayment(id, { status }); load()
  }
  async function remove(id: string) {
    if (!confirm('¿Eliminar este pago?')) return
    await deletePayment(id); load()
  }

  if (loading) return <Loading />
  if (error) return <ErrorBox msg={error} />

  return (
    <div className="space-y-4">
      {/* Resumen */}
      <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
        <div>
          <p className="text-xs text-slate-500">Pagado (verificado)</p>
          <p className="text-lg font-bold text-slate-900">{fmtMoney(verified, currency)}</p>
          {fee > 0 && <p className="text-xs text-slate-400">Inscripción: {fmtMoney(fee, currency)} · {verified >= fee ? 'Al día ✓' : `Falta ${fmtMoney(fee - verified, currency)}`}</p>}
        </div>
        <button onClick={() => setAdding(true)} className="flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-2 text-sm font-semibold text-white hover:bg-green-700">
          <Plus size={15} /> Registrar pago
        </button>
      </div>

      {adding && (
        <div className="rounded-xl border border-green-200 bg-green-50/40 p-4 space-y-3">
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-xs font-semibold text-slate-600">Monto ({currency})</label>
              <input value={amount} onChange={(e) => setAmount(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="0" />
            </div>
            <div className="flex-[2]">
              <label className="text-xs font-semibold text-slate-600">Notas</label>
              <input value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Ej: transferencia, efectivo…" />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setAdding(false)} className="rounded-lg px-3 py-1.5 text-sm text-slate-500">Cancelar</button>
            <button onClick={add} disabled={busy} className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50">
              {busy ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </div>
      )}

      {payments.length === 0 ? (
        <Empty msg="Sin pagos registrados." />
      ) : (
        <div className="space-y-2">
          {payments.map((p) => {
            const st = PAY_STATUS[p.status] ?? PAY_STATUS.pending
            return (
              <div key={p.id} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-900">{fmtMoney(Number(p.amount), p.currency)}</p>
                  <p className="text-xs text-slate-400 truncate">{p.notes || p.type} · {fmtDate(p.createdAt)}</p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${st.cls}`}>{st.label}</span>
                {p.status !== 'verified' && (
                  <button onClick={() => setStatus(p.id, 'verified')} className="text-green-600 hover:text-green-700" title="Verificar"><CheckCircle2 size={17} /></button>
                )}
                {p.status !== 'rejected' && (
                  <button onClick={() => setStatus(p.id, 'rejected')} className="text-amber-500 hover:text-amber-600" title="Rechazar"><XCircle size={17} /></button>
                )}
                <button onClick={() => remove(p.id)} className="text-slate-300 hover:text-red-500" title="Eliminar"><Trash2 size={15} /></button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ══════════════ SANCIONES DEL EQUIPO ══════════════ */

const FINE_STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: 'Pendiente', cls: 'bg-amber-100 text-amber-700' },
  paid: { label: 'Pagada', cls: 'bg-green-100 text-green-700' },
  waived: { label: 'Anulada', cls: 'bg-slate-100 text-slate-500' },
}

export function TeamFinesTab({
  editionId, teamId, registrationId, currency,
}: { editionId: string; teamId: string; registrationId: string; currency: string }) {
  const [fines, setFines] = useState<FineFromApi[]>([])
  const [roster, setRoster] = useState<{ playerUid: string; playerName: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [playerUid, setPlayerUid] = useState('')
  const [reason, setReason] = useState('')
  const [amount, setAmount] = useState('')
  const [busy, setBusy] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const [fs, rs] = await Promise.all([
        getFinesByEdition(editionId),
        getRosterByRegistration(registrationId).catch(() => []),
      ])
      setFines(fs.filter((f) => f.teamId === teamId))
      setRoster((rs as any[]).map((r) => ({ playerUid: r.playerUid, playerName: r.playerName })))
      setError(null)
    } catch { setError('No se pudieron cargar las sanciones.') }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [editionId, teamId, registrationId])

  async function add() {
    if (!reason.trim()) return
    setBusy(true)
    try {
      const player = roster.find((r) => r.playerUid === playerUid)
      await createFine({
        editionId, teamId, reason: reason.trim(),
        amount: amount ? parseFloat(amount) : undefined, currency,
        playerUid: player?.playerUid, playerName: player?.playerName,
      })
      setAdding(false); setReason(''); setAmount(''); setPlayerUid('')
      load()
    } finally { setBusy(false) }
  }
  async function setStatus(id: string, status: 'paid' | 'waived') { await updateFine(id, { status }); load() }
  async function remove(id: string) { if (!confirm('¿Eliminar esta sanción?')) return; await deleteFine(id); load() }

  if (loading) return <Loading />
  if (error) return <ErrorBox msg={error} />

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setAdding(true)} className="flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-2 text-sm font-semibold text-white hover:bg-green-700">
          <Plus size={15} /> Nueva sanción
        </button>
      </div>

      {adding && (
        <div className="rounded-xl border border-green-200 bg-green-50/40 p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-600">Jugador (opcional)</label>
              <select value={playerUid} onChange={(e) => setPlayerUid(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                <option value="">— Equipo (sin jugador) —</option>
                {roster.map((r) => <option key={r.playerUid} value={r.playerUid}>{r.playerName}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600">Monto ({currency})</label>
              <input value={amount} onChange={(e) => setAmount(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="0" />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600">Motivo</label>
            <input value={reason} onChange={(e) => setReason(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Ej: tarjeta roja, conducta antideportiva…" />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setAdding(false)} className="rounded-lg px-3 py-1.5 text-sm text-slate-500">Cancelar</button>
            <button onClick={add} disabled={busy} className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50">
              {busy ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </div>
      )}

      {fines.length === 0 ? (
        <Empty msg="Sin sanciones registradas." />
      ) : (
        <div className="space-y-2">
          {fines.map((f) => {
            const st = FINE_STATUS[f.status] ?? FINE_STATUS.pending
            return (
              <div key={f.id} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">{f.reason}</p>
                  <p className="text-xs text-slate-400 truncate">
                    {f.playerName ? `${f.playerName} · ` : ''}{Number(f.amount) > 0 ? fmtMoney(Number(f.amount), f.currency) : 'Sin monto'}
                    {f.matchesBanned > 0 ? ` · ${f.matchesBanned} fecha(s)` : ''}
                  </p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${st.cls}`}>{st.label}</span>
                {f.status !== 'paid' && <button onClick={() => setStatus(f.id, 'paid')} className="text-green-600 hover:text-green-700" title="Marcar pagada"><CheckCircle2 size={17} /></button>}
                {f.status !== 'waived' && <button onClick={() => setStatus(f.id, 'waived')} className="text-slate-400 hover:text-slate-600" title="Anular"><XCircle size={17} /></button>}
                <button onClick={() => remove(f.id)} className="text-slate-300 hover:text-red-500" title="Eliminar"><Trash2 size={15} /></button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ══════════════ ESTADÍSTICAS DEL EQUIPO ══════════════ */

export function TeamStatsTab({ editionId, teamId }: { editionId: string; teamId: string }) {
  const [stats, setStats] = useState<PlayerStatFromApi[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function load() {
    setLoading(true)
    try { setStats(await getPlayerStatsByTeam(editionId, teamId)); setError(null) }
    catch { setError('No se pudieron cargar las estadísticas.') }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [editionId, teamId])

  async function recompute() {
    setBusy(true)
    try { await recomputeStats(editionId); await load() } finally { setBusy(false) }
  }

  if (loading) return <Loading />
  if (error) return <ErrorBox msg={error} />

  const sorted = [...stats].sort((a, b) => b.goals - a.goals || b.assists - a.assists)

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={recompute} disabled={busy} className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50">
          <RefreshCw size={14} className={busy ? 'animate-spin' : ''} /> Recalcular
        </button>
      </div>
      {sorted.length === 0 ? (
        <Empty msg="Sin estadísticas aún. Los datos aparecen al finalizar partidos con eventos." />
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="px-4 py-2 text-left font-semibold">Jugador</th>
                <th className="px-3 py-2 text-center font-semibold">PJ</th>
                <th className="px-3 py-2 text-center font-semibold">Goles</th>
                <th className="px-3 py-2 text-center font-semibold">Asist.</th>
                <th className="px-3 py-2 text-center font-semibold">🟨</th>
                <th className="px-3 py-2 text-center font-semibold">🟥</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sorted.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2 font-medium text-slate-900">{s.playerName}</td>
                  <td className="px-3 py-2 text-center text-slate-600">{s.matchesPlayed}</td>
                  <td className="px-3 py-2 text-center font-bold text-green-700">{s.goals}</td>
                  <td className="px-3 py-2 text-center text-slate-600">{s.assists}</td>
                  <td className="px-3 py-2 text-center text-slate-600">{s.yellowCards}</td>
                  <td className="px-3 py-2 text-center text-slate-600">{s.redCards}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

/* ══════════════ Shared ══════════════ */

function Loading() {
  return <div className="flex items-center justify-center gap-2 py-16 text-slate-400"><Loader2 size={18} className="animate-spin" /><span className="text-sm">Cargando…</span></div>
}
function ErrorBox({ msg }: { msg: string }) {
  return <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600"><AlertCircle size={16} /> {msg}</div>
}
function Empty({ msg }: { msg: string }) {
  return <div className="rounded-2xl border-2 border-dashed border-slate-200 py-14 text-center text-sm text-slate-400">{msg}</div>
}
