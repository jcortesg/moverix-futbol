'use client'

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import {
  ChevronLeft, Loader2, AlertCircle, Plus, Search, Users, Shield,
  CheckCircle2, XCircle, UserMinus, MoreVertical, X, DollarSign,
  Upload, Mail, Lock, Unlock, RotateCcw,
} from 'lucide-react'
import { clsx } from 'clsx'
import {
  getRegistrationsByEdition,
  createRegistration,
  updateRegistration,
  deleteRegistration,
  markRegistrationPaid,
  type RegistrationFromApi,
  type RegistrationStatus,
} from '@/lib/registrations'
import { searchTeams, createTeam, updateTeam, uploadTeamLogo, type TeamFromApi } from '@/lib/teams'
import { resizeImage } from '@/lib/image'
import { getGroupsByEdition, type GroupFromApi } from '@/lib/groups'
import { getEdition, updateEdition, type EditionFromApi } from '@/lib/leagues'
import { Field, inputCls } from '@/components/ui/form'

// ─── Status helpers ──────────────────────────────────────────────────────────

const STATUS_STYLE: Record<RegistrationStatus, { label: string; bg: string; text: string; dot: string }> = {
  draft:     { label: 'Sin enviar',   bg: 'bg-slate-50 border-slate-200',  text: 'text-slate-600',  dot: 'bg-slate-400' },
  pending:   { label: 'Enviada',  bg: 'bg-amber-50 border-amber-200',  text: 'text-amber-700',  dot: 'bg-amber-500' },
  approved:  { label: 'Aprobado',   bg: 'bg-green-50 border-green-200',  text: 'text-green-700',  dot: 'bg-green-500' },
  rejected:  { label: 'Rechazado',  bg: 'bg-red-50 border-red-200',      text: 'text-red-700',    dot: 'bg-red-500' },
  withdrawn: { label: 'Retirado',   bg: 'bg-slate-50 border-slate-200',  text: 'text-slate-500',  dot: 'bg-slate-400' },
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function EquiposManager({
  editionId,
  backHref,
  backLabel = 'Gestionar',
}: {
  editionId: string
  backHref?: string
  backLabel?: string
}) {
  const [edition, setEdition] = useState<EditionFromApi | null>(null)
  const [registrations, setRegistrations] = useState<RegistrationFromApi[]>([])
  const [groups, setGroups] = useState<GroupFromApi[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | RegistrationStatus>('all')
  const [addOpen, setAddOpen] = useState(false)

  async function reload() {
    const [regs, grps] = await Promise.all([
      getRegistrationsByEdition(editionId),
      getGroupsByEdition(editionId),
    ])
    setRegistrations(regs)
    setGroups(grps)
  }

  useEffect(() => {
    Promise.all([
      getEdition(editionId).then(setEdition),
      reload(),
    ])
      .catch(() => setError('No se pudieron cargar los equipos.'))
      .finally(() => setLoading(false))
  }, [editionId])

  const filtered = useMemo(() => {
    if (filter === 'all') return registrations
    return registrations.filter((r) => r.status === filter)
  }, [registrations, filter])

  const counts = useMemo(() => {
    const out = { all: registrations.length, draft: 0, pending: 0, approved: 0, rejected: 0, withdrawn: 0 }
    for (const r of registrations) out[r.status]++
    return out
  }, [registrations])

  async function patchRegistration(id: string, patch: Parameters<typeof updateRegistration>[1]) {
    const updated = await updateRegistration(id, patch)
    setRegistrations((prev) => prev.map((r) => (r.id === id ? { ...r, ...updated } : r)))
  }

  async function handlePaid(id: string) {
    const updated = await markRegistrationPaid(id)
    setRegistrations((prev) => prev.map((r) => (r.id === id ? { ...r, ...updated } : r)))
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Quitar este equipo de la edición? No borra al equipo, sólo su inscripción.')) return
    await deleteRegistration(id)
    setRegistrations((prev) => prev.filter((r) => r.id !== id))
  }

  const [togglingReg, setTogglingReg] = useState(false)
  async function toggleRegistrations() {
    if (!edition) return
    const next = !edition.registrationsOpen
    if (!confirm(next ? '¿Abrir inscripciones? Los equipos podrán inscribirse.' : '¿Cerrar inscripciones? Ningún equipo nuevo podrá inscribirse.')) return
    setTogglingReg(true)
    try {
      const updated = await updateEdition(editionId, { registrationsOpen: next })
      setEdition((prev) => (prev ? { ...prev, registrationsOpen: updated.registrationsOpen } : prev))
    } finally {
      setTogglingReg(false)
    }
  }

  const [togglingRoster, setTogglingRoster] = useState(false)
  /** Cierre GENERAL de nóminas: manda sobre el candado de cada equipo. */
  async function toggleRosters() {
    if (!edition) return
    const next = !edition.rostersLocked
    if (!confirm(next
      ? '¿Cerrar las nóminas del campeonato? Ningún equipo podrá agregar, quitar ni editar jugadores.'
      : '¿Abrir las nóminas? Los equipos volverán a editar su plantilla (salvo los cerrados individualmente).')) return
    setTogglingRoster(true)
    try {
      const updated = await updateEdition(editionId, { rostersLocked: next })
      setEdition((prev) => (prev ? { ...prev, rostersLocked: updated.rostersLocked } : prev))
    } finally {
      setTogglingRoster(false)
    }
  }

  /**
   * Candado por equipo con tres estados. `value`:
   *   null  -> hereda el cierre general
   *   true  -> cerrada siempre
   *   false -> abierta aunque el general esté cerrado
   */
  async function setTeamRoster(reg: RegistrationFromApi, value: boolean | null) {
    const updated = await updateRegistration(reg.id, { rosterLocked: value })
    setRegistrations((prev) =>
      prev.map((r) => (r.id === reg.id ? { ...r, rosterLocked: updated.rosterLocked } : r)),
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-3 py-32 text-slate-400">
        <Loader2 size={22} className="animate-spin" />
        <span className="text-sm">Cargando equipos...</span>
      </div>
    )
  }

  if (error || !edition) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
        <AlertCircle size={16} /> {error ?? 'No disponible.'}
      </div>
    )
  }

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
        <span className="text-sm font-semibold text-slate-900">Equipos</span>
        <div className="flex-1" />
        <button
          onClick={toggleRegistrations}
          disabled={togglingReg}
          className={clsx(
            'flex items-center gap-2 px-3 py-2 text-xs font-bold rounded-xl border transition-all disabled:opacity-50',
            edition.registrationsOpen
              ? 'border-green-200 text-green-700 bg-green-50 hover:bg-green-100'
              : 'border-red-200 text-red-700 bg-red-50 hover:bg-red-100',
          )}
          title={edition.registrationsOpen ? 'Inscripciones abiertas — clic para cerrar' : 'Inscripciones cerradas — clic para abrir'}
        >
          {togglingReg ? <Loader2 size={13} className="animate-spin" /> : edition.registrationsOpen ? <Unlock size={13} /> : <Lock size={13} />}
          Inscripciones: {edition.registrationsOpen ? 'Abiertas' : 'Cerradas'}
        </button>
        <button
          onClick={toggleRosters}
          disabled={togglingRoster}
          className={clsx(
            'flex items-center gap-2 px-3 py-2 text-xs font-bold rounded-xl border transition-all disabled:opacity-50',
            edition.rostersLocked
              ? 'border-red-200 text-red-700 bg-red-50 hover:bg-red-100'
              : 'border-green-200 text-green-700 bg-green-50 hover:bg-green-100',
          )}
          title={edition.rostersLocked
            ? 'Nóminas cerradas para todos — clic para abrir'
            : 'Nóminas abiertas — clic para cerrar todas'}
        >
          {togglingRoster ? <Loader2 size={13} className="animate-spin" /> : edition.rostersLocked ? <Lock size={13} /> : <Unlock size={13} />}
          Nóminas: {edition.rostersLocked ? 'Cerradas' : 'Abiertas'}
        </button>
        <button
          onClick={() => setAddOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-bold rounded-xl hover:bg-green-700 transition-all shadow-sm active:scale-[0.98]"
        >
          <Plus size={14} />
          Inscribir equipo
        </button>
      </div>

      {/* Header stats */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 mb-5">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-10 h-10 rounded-xl bg-green-50 border border-green-200 flex items-center justify-center">
            <Users size={18} className="text-green-700" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900">Equipos inscritos</h1>
            <p className="text-xs text-slate-500">
              {counts.all} de {edition.maxTeams} · {counts.approved} aprobados · {counts.pending} pendientes
            </p>
          </div>
          <div className="flex-1" />
          <div className="hidden sm:flex items-center gap-3">
            <div className="w-56 bg-slate-100 rounded-full h-2 overflow-hidden">
              <div
                className="bg-green-500 h-full transition-all"
                style={{ width: `${Math.min(100, (counts.approved / edition.maxTeams) * 100)}%` }}
              />
            </div>
            <span className="text-xs font-bold text-slate-700 whitespace-nowrap">
              {Math.round((counts.approved / edition.maxTeams) * 100)}%
            </span>
          </div>
        </div>

        {/* Status filters */}
        <div className="flex items-center gap-2 overflow-x-auto">
          <FilterChip label={`Todos (${counts.all})`}    active={filter === 'all'}       onClick={() => setFilter('all')} />
          <FilterChip label={`Sin enviar (${counts.draft})`}     active={filter === 'draft'}     onClick={() => setFilter('draft')} />
          <FilterChip label={`Enviadas por revisar (${counts.pending})`} active={filter === 'pending'} onClick={() => setFilter('pending')} />
          <FilterChip label={`Aprobados (${counts.approved})`}   active={filter === 'approved'}  onClick={() => setFilter('approved')} />
          <FilterChip label={`Rechazados (${counts.rejected})`}  active={filter === 'rejected'}  onClick={() => setFilter('rejected')} />
          <FilterChip label={`Retirados (${counts.withdrawn})`}  active={filter === 'withdrawn'} onClick={() => setFilter('withdrawn')} />
        </div>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-20 bg-white rounded-2xl border-2 border-dashed border-slate-200">
          <Shield size={28} className="text-slate-300" />
          <p className="text-sm font-semibold text-slate-500">
            {registrations.length === 0 ? 'Aún no hay equipos inscritos' : 'Sin equipos en esta vista'}
          </p>
          {registrations.length === 0 && (
            <button
              onClick={() => setAddOpen(true)}
              className="text-sm font-semibold text-green-700 hover:underline"
            >
              Inscribir el primero
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest px-5 py-3">Equipo</th>
                <th className="text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest px-5 py-3">Plantilla</th>
                <th className="text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest px-5 py-3">Nómina</th>
                <th className="text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest px-5 py-3">Inscripción</th>
                <th className="text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest px-5 py-3">Pago</th>
                <th className="text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest px-5 py-3">Grupo</th>
                <th className="text-right text-[10px] font-bold text-slate-500 uppercase tracking-widest px-5 py-3">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((reg) => (
                <RegistrationRow
                  key={reg.id}
                  reg={reg}
                  groups={groups}
                  onPatch={(patch) => patchRegistration(reg.id, patch)}
                  onMarkPaid={() => handlePaid(reg.id)}
                  onDelete={() => handleDelete(reg.id)}
                  onSetRoster={(v) => setTeamRoster(reg, v)}
                  rostersLockedGlobally={!!edition.rostersLocked}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {addOpen && (
        <AddTeamDrawer
          editionId={editionId}
          alreadyRegisteredIds={new Set(registrations.map((r) => r.teamId))}
          onClose={() => setAddOpen(false)}
          onAdded={async () => {
            await reload()
            setAddOpen(false)
          }}
        />
      )}
    </div>
  )
}

// ─── FilterChip ──────────────────────────────────────────────────────────────

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'px-3 py-1.5 rounded-full text-xs font-semibold border whitespace-nowrap transition-colors',
        active
          ? 'bg-slate-900 text-white border-slate-900'
          : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300',
      )}
    >
      {label}
    </button>
  )
}

// ─── Row ─────────────────────────────────────────────────────────────────────

function RegistrationRow({
  reg, groups, onPatch, onMarkPaid, onDelete, onSetRoster, rostersLockedGlobally,
}: {
  reg: RegistrationFromApi
  groups: GroupFromApi[]
  onPatch: (patch: Parameters<typeof updateRegistration>[1]) => Promise<void>
  onMarkPaid: () => Promise<void>
  onDelete: () => Promise<void>
  onSetRoster: (value: boolean | null) => Promise<void>
  rostersLockedGlobally: boolean
}) {
  const [busy, setBusy] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const style = STATUS_STYLE[reg.status]

  async function run(fn: () => Promise<void>) {
    setBusy(true)
    try { await fn() } finally { setBusy(false); setMenuOpen(false) }
  }

  return (
    <tr className="hover:bg-slate-50/50 transition-colors">
      {/* Team */}
      <td className="px-5 py-3">
        <Link
          href={`/torneos/edicion/${reg.editionId}/gestionar/equipos/${reg.id}`}
          className="flex items-center gap-3 hover:opacity-80 transition-opacity"
        >
          {reg.team.logoUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={reg.team.logoUrl} alt="" className="w-9 h-9 rounded-lg object-cover border border-slate-200 flex-shrink-0" />
          ) : (
            <div
              className="w-9 h-9 rounded-lg border border-slate-200 flex items-center justify-center flex-shrink-0"
              style={reg.team.primaryColor ? { background: `${reg.team.primaryColor}18` } : undefined}
            >
              <Shield size={15} style={{ color: reg.team.primaryColor ?? '#94a3b8' }} />
            </div>
          )}
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900 truncate hover:text-green-700 transition-colors">
              {reg.team.name}
            </p>
            <p className="text-xs text-slate-400 truncate">
              {reg.team.shortName ?? reg.team.city ?? '—'}
            </p>
            {reg.team.pendingDelegateEmail && (
              <p className="text-[11px] text-amber-600 truncate flex items-center gap-1" title="Delegado por reclamar">
                <Mail size={10} /> Por reclamar: {reg.team.pendingDelegateEmail}
              </p>
            )}
          </div>
        </Link>
      </td>

      {/* Plantilla: inscritos, completos y a cuántos les falta algún dato */}
      <td className="px-5 py-3">
        {(reg.playersCount ?? 0) === 0 ? (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-400">
            <Users size={12} /> Sin jugadores
          </span>
        ) : (
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-700" title="Jugadores inscritos">
              <Users size={12} /> {reg.playersCount}
            </span>
            {(reg.playersComplete ?? 0) > 0 && (
              <span
                className="inline-flex items-center gap-0.5 text-[11px] font-bold text-green-700"
                title={`${reg.playersComplete} con todos los datos completos`}
              >
                <CheckCircle2 size={11} /> {reg.playersComplete}
              </span>
            )}
            {(reg.playersIncomplete ?? 0) > 0 && (
              <span
                className="inline-flex items-center gap-0.5 text-[11px] font-bold text-amber-700"
                title={`A ${reg.playersIncomplete} les falta algún dato obligatorio`}
              >
                <AlertCircle size={11} /> {reg.playersIncomplete}
              </span>
            )}
          </div>
        )}
      </td>

      {/* Nómina: abierta o cerrada (independiente de si ya la enviaron) */}
      <td className="px-5 py-3">
        <RosterLockBadge
          teamLocked={reg.rosterLocked}
          lockedGlobally={rostersLockedGlobally}
          busy={busy}
          onToggle={() => run(() => onSetRoster(
            // Cerrada -> abrir solo a este equipo; abierta -> cerrar solo este equipo.
            // Si el valor coincide con el del campeonato, se vuelve a heredar.
            (reg.rosterLocked ?? rostersLockedGlobally)
              ? (rostersLockedGlobally ? false : null)
              : (rostersLockedGlobally ? null : true),
          ))}
        />
      </td>

      {/* Status */}
      <td className="px-5 py-3">
        <span className={clsx('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border', style.bg, style.text)}>
          <span className={clsx('w-1.5 h-1.5 rounded-full', style.dot)} />
          {style.label}
        </span>
      </td>

      {/* Paid */}
      <td className="px-5 py-3">
        {reg.paidAt ? (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
            <CheckCircle2 size={12} /> Pagado
          </span>
        ) : (
          <button
            disabled={busy}
            onClick={() => run(onMarkPaid)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-emerald-700 transition-colors disabled:opacity-50"
          >
            <DollarSign size={12} /> Marcar pago
          </button>
        )}
      </td>

      {/* Group */}
      <td className="px-5 py-3">
        {groups.length === 0 ? (
          <span className="text-xs text-slate-400 italic">Sin grupos</span>
        ) : (
          <select
            disabled={busy}
            value={reg.groupId ?? ''}
            onChange={(e) => run(() => onPatch({ groupId: e.target.value || null }))}
            className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-700 focus:border-green-500 focus:ring-2 focus:ring-green-500/20 outline-none disabled:opacity-50"
          >
            <option value="">Sin asignar</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        )}
      </td>

      {/* Actions */}
      <td className="px-5 py-3 text-right relative">
        <div className="inline-flex items-center gap-1">
          {reg.status === 'pending' && (
            <>
              <button
                disabled={busy}
                onClick={() => run(() => onPatch({ status: 'approved' }))}
                className="p-1.5 rounded-lg text-green-600 hover:bg-green-50 transition-colors disabled:opacity-50"
                title="Aprobar"
              >
                <CheckCircle2 size={15} />
              </button>
              <button
                disabled={busy}
                onClick={() => run(() => onPatch({ status: 'rejected' }))}
                className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                title="Rechazar"
              >
                <XCircle size={15} />
              </button>
            </>
          )}
          <RowMenu open={menuOpen} onOpenChange={setMenuOpen}>
            {reg.status === 'draft' && (
              <div className="px-3 py-2 text-[11px] text-slate-400 italic max-w-[220px]">El delegado aún no envía la nómina desde la app. Igual puede seguir agregando jugadores.</div>
            )}
            {reg.status !== 'pending' && reg.status !== 'draft' && (
              <MenuItem onClick={() => run(() => onPatch({ status: 'pending' }))}>Volver a enviada (por revisar)</MenuItem>
            )}
            {reg.status !== 'approved' && reg.status !== 'draft' && (
              <MenuItem onClick={() => run(() => onPatch({ status: 'approved' }))}>Aprobar</MenuItem>
            )}
            {reg.status !== 'rejected' && reg.status !== 'draft' && (
              <MenuItem onClick={() => run(() => onPatch({ status: 'rejected' }))}>Rechazar</MenuItem>
            )}
            {reg.status !== 'withdrawn' && (
              <MenuItem onClick={() => run(() => onPatch({ status: 'withdrawn' }))}>
                <UserMinus size={12} /> Retirar
              </MenuItem>
            )}
            <div className="h-px bg-slate-100" />
            <MenuItem onClick={() => run(async () => {
              const current = reg.team.pendingDelegateEmail ?? ''
              const input = window.prompt(
                'Email del delegado (si aún no tiene cuenta, se le asignará el equipo cuando se registre):',
                current,
              )
              if (input === null) return
              await updateTeam(reg.team.id, { directorEmail: input.trim() || undefined })
            })}>
              <Mail size={12} /> {reg.team.pendingDelegateEmail ? 'Editar delegado' : 'Asignar delegado'}
            </MenuItem>
            <div className="h-px bg-slate-100" />
            {/* El equipo hereda el cierre general salvo que tenga excepción. */}
            {reg.rosterLocked === null ? (
              rostersLockedGlobally ? (
                <MenuItem onClick={() => run(() => onSetRoster(false))}>
                  <Unlock size={12} /> Abrir la nómina de este equipo
                </MenuItem>
              ) : (
                <MenuItem onClick={() => run(() => onSetRoster(true))}>
                  <Lock size={12} /> Cerrar la nómina de este equipo
                </MenuItem>
              )
            ) : (
              <MenuItem onClick={() => run(() => onSetRoster(null))}>
                <RotateCcw size={12} /> {rostersLockedGlobally ? 'Volver a cerrarla (como todo el campeonato)' : 'Volver a abrirla (como todo el campeonato)'}
              </MenuItem>
            )}
            <MenuItem danger onClick={() => run(onDelete)}>Quitar inscripción</MenuItem>
          </RowMenu>
        </div>
      </td>
    </tr>
  )
}

function RowMenu({
  open, onOpenChange, children,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  children: React.ReactNode
}) {
  const btnRef = useRef<HTMLButtonElement>(null)
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null)

  useLayoutEffect(() => {
    if (!open || !btnRef.current) return
    const rect = btnRef.current.getBoundingClientRect()
    setPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right })
  }, [open])

  useEffect(() => {
    if (!open) return
    function onScroll() { onOpenChange(false) }
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onScroll)
    }
  }, [open, onOpenChange])

  return (
    <>
      <button
        ref={btnRef}
        onClick={() => onOpenChange(!open)}
        className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
      >
        <MoreVertical size={15} />
      </button>
      {open && pos && typeof window !== 'undefined' && createPortal(
        <>
          <div className="fixed inset-0 z-40" onClick={() => onOpenChange(false)} />
          <div
            className="fixed w-44 bg-white rounded-xl border border-slate-200 shadow-lg z-50 overflow-hidden"
            style={{ top: pos.top, right: pos.right }}
          >
            {children}
          </div>
        </>,
        document.body,
      )}
    </>
  )
}

function MenuItem({ children, onClick, danger = false }: { children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-left transition-colors',
        danger ? 'text-red-600 hover:bg-red-50' : 'text-slate-700 hover:bg-slate-50',
      )}
    >
      {children}
    </button>
  )
}

// ─── Add team drawer ──────────────────────────────────────────────────────────

function AddTeamDrawer({
  editionId, alreadyRegisteredIds, onClose, onAdded,
}: {
  editionId: string
  alreadyRegisteredIds: Set<string>
  onClose: () => void
  onAdded: () => void
}) {
  const [mode, setMode] = useState<'search' | 'create'>('search')

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      <aside className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl z-50 flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h2 className="text-base font-bold text-slate-900">Inscribir equipo</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="px-5 pt-4">
          <div className="inline-flex items-center rounded-xl border border-slate-200 overflow-hidden text-xs font-semibold">
            <button
              onClick={() => setMode('search')}
              className={clsx('px-3 py-1.5', mode === 'search' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-50')}
            >
              Buscar existente
            </button>
            <button
              onClick={() => setMode('create')}
              className={clsx('px-3 py-1.5', mode === 'create' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-50')}
            >
              Crear nuevo
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {mode === 'search' ? (
            <SearchTab editionId={editionId} alreadyRegisteredIds={alreadyRegisteredIds} onAdded={onAdded} />
          ) : (
            <CreateTab editionId={editionId} onAdded={onAdded} />
          )}
        </div>
      </aside>
    </>
  )
}

function SearchTab({
  editionId, alreadyRegisteredIds, onAdded,
}: {
  editionId: string
  alreadyRegisteredIds: Set<string>
  onAdded: () => void
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<TeamFromApi[]>([])
  const [searching, setSearching] = useState(false)
  const [submittingId, setSubmittingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) {
      setResults([])
      return
    }
    let cancelled = false
    setSearching(true)
    const timer = setTimeout(async () => {
      try {
        const r = await searchTeams(q)
        if (!cancelled) setResults(r)
      } catch {
        if (!cancelled) setError('Error al buscar.')
      } finally {
        if (!cancelled) setSearching(false)
      }
    }, 250)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [query])

  async function register(team: TeamFromApi) {
    setSubmittingId(team.id)
    setError(null)
    try {
      await createRegistration({ editionId, teamId: team.id })
      onAdded()
    } catch (err) {
      const msg = extractError(err)
      setError(msg ?? 'No se pudo inscribir.')
    } finally {
      setSubmittingId(null)
    }
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        <input
          type="text"
          autoFocus
          placeholder="Buscar por nombre o sigla (mínimo 2 caracteres)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className={clsx(inputCls, 'pl-9')}
        />
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
          <AlertCircle size={12} /> {error}
        </div>
      )}

      {searching ? (
        <div className="flex items-center gap-2 text-xs text-slate-400 py-4">
          <Loader2 size={12} className="animate-spin" /> Buscando...
        </div>
      ) : results.length === 0 && query.trim().length >= 2 ? (
        <div className="text-center py-6 text-xs text-slate-400">
          Sin resultados. Puedes crear uno nuevo en la otra pestaña.
        </div>
      ) : (
        <div className="space-y-1.5">
          {results.map((t) => {
            const already = alreadyRegisteredIds.has(t.id)
            return (
              <div key={t.id} className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:border-slate-300 transition-colors">
                {t.logoUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={t.logoUrl} alt="" className="w-9 h-9 rounded-lg object-cover border border-slate-200 flex-shrink-0" />
                ) : (
                  <div className="w-9 h-9 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center flex-shrink-0">
                    <Shield size={14} className="text-slate-400" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">{t.name}</p>
                  <p className="text-xs text-slate-400 truncate">
                    {[t.shortName, t.city].filter(Boolean).join(' · ') || '—'}
                  </p>
                </div>
                {already ? (
                  <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400 bg-slate-100 rounded-full px-2 py-0.5">
                    Inscrito
                  </span>
                ) : (
                  <button
                    disabled={submittingId === t.id}
                    onClick={() => register(t)}
                    className="text-xs font-bold text-white bg-green-600 hover:bg-green-700 rounded-lg px-3 py-1.5 transition-colors disabled:opacity-60"
                  >
                    {submittingId === t.id ? <Loader2 size={12} className="animate-spin" /> : 'Inscribir'}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function CreateTab({ editionId, onAdded }: { editionId: string; onAdded: () => void }) {
  const logoRef = useRef<HTMLInputElement>(null)
  const [name, setName] = useState('')
  const [shortName, setShortName] = useState('')
  const [city, setCity] = useState('')
  const [primaryColor, setPrimaryColor] = useState('#16a34a')
  const [directorEmail, setDirectorEmail] = useState('')
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function pickLogo(file: File) {
    setLogoFile(file)
    setLogoPreview(URL.createObjectURL(file))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (name.trim().length < 2) { setError('El nombre debe tener al menos 2 caracteres.'); return }
    if (!logoFile) { setError('El logo del equipo es obligatorio.'); return }
    setSubmitting(true)
    setError(null)
    try {
      const team = await createTeam({
        name: name.trim(),
        shortName: shortName.trim() || undefined,
        city: city.trim() || undefined,
        primaryColor,
        directorEmail: directorEmail.trim() || undefined,
      })
      const resized = await resizeImage(logoFile, { maxSize: 512, quality: 0.9 })
      await uploadTeamLogo(team.id, resized)
      await createRegistration({ editionId, teamId: team.id })
      onAdded()
    } catch (err) {
      setError(extractError(err) ?? 'No se pudo crear el equipo.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="text-xs text-slate-500">
        Crea un equipo nuevo. Si defines un delegado por email, él será el propietario y podrá gestionarlo desde la app.
        Si no, tú quedas como propietario temporal.
      </p>

      {/* Logo uploader */}
      <div className="flex items-center gap-4">
        <div
          onClick={() => logoRef.current?.click()}
          className="relative w-16 h-16 rounded-xl border-2 border-dashed border-slate-200 hover:border-green-400 bg-slate-50 flex items-center justify-center cursor-pointer transition-colors overflow-hidden"
        >
          {logoPreview ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={logoPreview} alt="" className="w-full h-full object-cover" />
          ) : (
            <Shield size={20} className="text-slate-300" />
          )}
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-slate-700">Logo <span className="text-red-500">*</span></p>
          <button
            type="button"
            onClick={() => logoRef.current?.click()}
            className="flex items-center gap-1.5 text-xs font-semibold text-green-700 hover:text-green-800 transition-colors mt-0.5"
          >
            <Upload size={11} /> {logoPreview ? 'Cambiar imagen' : 'Subir imagen'}
          </button>
          {logoFile && (
            <button
              type="button"
              onClick={() => { setLogoFile(null); setLogoPreview(null) }}
              className="text-[10px] text-slate-400 hover:text-red-500 ml-2 transition-colors"
            >
              quitar
            </button>
          )}
        </div>
        <input
          ref={logoRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) pickLogo(f) }}
        />
      </div>

      <Field label="Nombre del equipo">
        <input
          autoFocus
          className={inputCls}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Real Barrio FC"
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Sigla (opcional)">
          <input
            className={inputCls}
            maxLength={10}
            value={shortName}
            onChange={(e) => setShortName(e.target.value.toUpperCase())}
            placeholder="RBFC"
          />
        </Field>
        <Field label="Ciudad (opcional)">
          <input
            className={inputCls}
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="Bogotá"
          />
        </Field>
      </div>

      <Field label="Color principal">
        <div className="flex items-center gap-3">
          <input
            type="color"
            className="w-12 h-10 rounded-lg border border-slate-200 cursor-pointer"
            value={primaryColor}
            onChange={(e) => setPrimaryColor(e.target.value)}
          />
          <span className="font-mono text-xs text-slate-500">{primaryColor}</span>
        </div>
      </Field>

      <Field label="Delegado / DT (email, opcional)" hint="Debe ser una cuenta ya registrada en Moverix. Si se deja vacío, tú quedas como propietario.">
        <div className="relative">
          <Mail size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="email"
            className={clsx(inputCls, 'pl-10')}
            value={directorEmail}
            onChange={(e) => setDirectorEmail(e.target.value)}
            placeholder="delegado@example.com"
          />
        </div>
      </Field>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
          <AlertCircle size={12} /> {error}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full flex items-center justify-center gap-2 py-2.5 bg-green-600 text-white text-sm font-bold rounded-xl hover:bg-green-700 disabled:opacity-60 transition-all"
      >
        {submitting ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
        Crear e inscribir
      </button>
    </form>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractError(err: unknown): string | null {
  if (typeof err !== 'object' || err === null) return null
  const maybeAxios = err as { response?: { data?: { message?: string | string[] } } }
  const msg = maybeAxios.response?.data?.message
  if (!msg) return null
  return Array.isArray(msg) ? msg[0] ?? null : msg
}

// ─── Nómina abierta / cerrada ───────────────────────────────────────────────

/**
 * Estado de la nómina con texto, no solo un candado. "Abierta" = el delegado puede
 * agregar, quitar y editar jugadores desde la app, aunque ya la haya enviado.
 * El candado del equipo (true/false) manda sobre el del campeonato; null hereda.
 */
function RosterLockBadge({
  teamLocked, lockedGlobally, busy, onToggle,
}: {
  teamLocked: boolean | null
  lockedGlobally: boolean
  busy: boolean
  onToggle: () => void
}) {
  const locked = teamLocked ?? lockedGlobally
  const exception = teamLocked !== null && teamLocked !== lockedGlobally
  const title = locked
    ? (exception ? 'Cerrada solo para este equipo. Clic para abrirla.' : 'Nóminas cerradas en todo el campeonato. Clic para abrirla solo a este equipo.')
    : (exception ? 'Abierta solo para este equipo (el campeonato está cerrado). Clic para cerrarla.' : 'El delegado puede agregar y editar jugadores. Clic para cerrarla.')
  return (
    <button
      type="button"
      disabled={busy}
      onClick={onToggle}
      title={title}
      className={clsx(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border transition-colors disabled:opacity-50',
        locked
          ? 'bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100'
          : 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100',
      )}
    >
      {locked ? <Lock size={11} /> : <Unlock size={11} />}
      {locked ? 'Cerrada' : 'Abierta'}
      {exception && <span className="font-medium opacity-70">· solo este</span>}
    </button>
  )
}
