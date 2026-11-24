'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import {
  ChevronLeft, Loader2, AlertCircle, Shield, Upload,
  Users, Calendar, DollarSign, Ban, BarChart2,
  CheckCircle2, XCircle, UserMinus, DollarSign as DollarIcon,
  Pencil, Save, X, Lock, Unlock,
} from 'lucide-react'
import { clsx } from 'clsx'
import {
  getRegistration,
  updateRegistration,
  markRegistrationPaid,
  type RegistrationFromApi,
  type RegistrationStatus,
} from '@/lib/registrations'
import { uploadTeamLogo, updateTeam } from '@/lib/teams'
import { resizeImage } from '@/lib/image'
import { getGroupsByEdition, type GroupFromApi } from '@/lib/groups'
import { getEdition, type EditionFromApi } from '@/lib/leagues'
import { RosterTab } from './RosterTab'
import { TeamMatchesTab, TeamPaymentsTab, TeamFinesTab, TeamStatsTab } from './TeamTabs'
import { inputCls } from '@/components/ui/form'

// ─── Tab metadata ────────────────────────────────────────────────────────────

const TABS = [
  { key: 'roster',   label: 'Plantilla',     icon: Users,      enabled: true },
  { key: 'matches',  label: 'Partidos',      icon: Calendar,   enabled: true },
  { key: 'payments', label: 'Pagos',         icon: DollarSign, enabled: true },
  { key: 'fines',    label: 'Sanciones',     icon: Ban,        enabled: true },
  { key: 'stats',    label: 'Estadísticas',  icon: BarChart2,  enabled: true },
] as const

type TabKey = typeof TABS[number]['key']

const STATUS_STYLE: Record<RegistrationStatus, { label: string; bg: string; text: string; dot: string }> = {
  draft:     { label: 'Sin enviar',   bg: 'bg-slate-50 border-slate-200',  text: 'text-slate-600',  dot: 'bg-slate-400' },
  pending:   { label: 'Enviada',  bg: 'bg-amber-50 border-amber-200',  text: 'text-amber-700',  dot: 'bg-amber-500' },
  approved:  { label: 'Aprobado',   bg: 'bg-green-50 border-green-200',  text: 'text-green-700',  dot: 'bg-green-500' },
  rejected:  { label: 'Rechazado',  bg: 'bg-red-50 border-red-200',      text: 'text-red-700',    dot: 'bg-red-500' },
  withdrawn: { label: 'Retirado',   bg: 'bg-slate-50 border-slate-200',  text: 'text-slate-500',  dot: 'bg-slate-400' },
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function TeamDetailView({ editionId, registrationId }: { editionId: string; registrationId: string }) {
  const [reg, setReg] = useState<RegistrationFromApi | null>(null)
  const [edition, setEdition] = useState<EditionFromApi | null>(null)
  const [groups, setGroups] = useState<GroupFromApi[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<TabKey>('roster')

  useEffect(() => {
    Promise.all([
      getRegistration(registrationId).then(setReg),
      getEdition(editionId).then(setEdition),
      getGroupsByEdition(editionId).then(setGroups),
    ])
      .catch(() => setError('No se pudo cargar el equipo.'))
      .finally(() => setLoading(false))
  }, [editionId, registrationId])

  async function patchRegistration(patch: Parameters<typeof updateRegistration>[1]) {
    if (!reg) return
    const updated = await updateRegistration(reg.id, patch)
    setReg({ ...reg, ...updated })
  }

  const [rosterBusy, setRosterBusy] = useState(false)
  const [rosterError, setRosterError] = useState<string | null>(null)

  /** Abre o cierra la nómina de ESTE equipo. Si queda igual que el campeonato, vuelve a heredar. */
  async function toggleRoster() {
    if (!reg || !edition) return
    const global = !!edition.rostersLocked
    const locked = reg.rosterLocked ?? global
    const next: boolean | null = locked ? (global ? false : null) : (global ? null : true)
    setRosterBusy(true)
    setRosterError(null)
    try {
      const updated = await updateRegistration(reg.id, { rosterLocked: next })
      setReg({ ...reg, rosterLocked: updated.rosterLocked })
    } catch {
      setRosterError('No se pudo cambiar. Intenta de nuevo.')
    } finally {
      setRosterBusy(false)
    }
  }

  async function handleMarkPaid() {
    if (!reg) return
    const updated = await markRegistrationPaid(reg.id)
    setReg({ ...reg, ...updated })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-3 py-32 text-slate-400">
        <Loader2 size={22} className="animate-spin" />
        <span className="text-sm">Cargando equipo...</span>
      </div>
    )
  }

  if (error || !reg || !edition) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
        <AlertCircle size={16} /> {error ?? 'Equipo no disponible.'}
      </div>
    )
  }

  const status = STATUS_STYLE[reg.status]
  const rostersLockedGlobally = !!edition.rostersLocked
  const rosterLocked = reg.rosterLocked ?? rostersLockedGlobally
  const rosterException = reg.rosterLocked !== null && reg.rosterLocked !== rostersLockedGlobally
  const group = groups.find((g) => g.id === reg.groupId)

  return (
    <div>
      {/* Breadcrumb */}
      <div className="flex items-center gap-3 mb-6">
        <Link
          href={`/torneos/edicion/${editionId}/gestionar/equipos`}
          className="flex items-center gap-1 text-sm text-slate-400 hover:text-slate-700 transition-colors"
        >
          <ChevronLeft size={15} />
          <span>Equipos</span>
        </Link>
        <span className="text-slate-300">/</span>
        <span className="text-sm font-semibold text-slate-900 truncate max-w-xs">{reg.team.name}</span>
      </div>

      {/* Compact header: team info + stats in one row */}
      <TeamHero
        reg={reg}
        onLogoUpdated={(logoUrl) => setReg({ ...reg, team: { ...reg.team, logoUrl } })}
        onTeamUpdated={(patch) => setReg({ ...reg, team: { ...reg.team, ...patch } })}
      >
        {/* Right column: status metrics */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-4 justify-end">
          {/* Nómina: abierta = el delegado puede agregar y editar jugadores, aunque ya la haya enviado */}
          <div className="flex flex-col items-end gap-1">
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Nómina</p>
            <span className={clsx(
              'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold border',
              rosterLocked ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-emerald-50 border-emerald-200 text-emerald-700',
            )}>
              {rosterLocked ? <Lock size={10} /> : <Unlock size={10} />}
              {rosterLocked ? 'Cerrada' : 'Abierta'}
              {rosterException && <span className="font-medium opacity-70">· solo este equipo</span>}
            </span>
            <button
              onClick={toggleRoster}
              disabled={rosterBusy}
              className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500 hover:text-slate-900 transition-colors disabled:opacity-50"
              title={rosterLocked
                ? 'El delegado podrá volver a agregar, quitar y editar jugadores desde la app'
                : 'El delegado ya no podrá cambiar la nómina'}
            >
              {rosterBusy && <Loader2 size={10} className="animate-spin" />}
              {rosterLocked ? 'Reabrir nómina' : 'Cerrar nómina'}
            </button>
            {rosterError && <span className="text-[10px] text-red-600">{rosterError}</span>}
          </div>

          <div className="h-10 w-px bg-slate-200" />

          {/* Status */}
          <div className="flex flex-col items-end gap-1">
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Inscripción</p>
            <span className={clsx('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold border', status.bg, status.text)}>
              <span className={clsx('w-1.5 h-1.5 rounded-full', status.dot)} />
              {status.label}
            </span>
            <div className="flex items-center gap-1">
              {reg.status === 'draft' && (
                <span className="text-[10px] text-slate-400 italic mr-1" title="El delegado aún no envía la nómina desde la app; igual puede seguir agregando jugadores">
                  El delegado aún no la envía
                </span>
              )}
              {reg.status !== 'approved' && reg.status !== 'draft' && (
                <button
                  onClick={() => patchRegistration({ status: 'approved' })}
                  className="p-1 rounded-md text-green-600 hover:bg-green-50 transition-colors"
                  title="Aprobar"
                >
                  <CheckCircle2 size={13} />
                </button>
              )}
              {reg.status !== 'rejected' && reg.status !== 'draft' && (
                <button
                  onClick={() => patchRegistration({ status: 'rejected' })}
                  className="p-1 rounded-md text-red-500 hover:bg-red-50 transition-colors"
                  title="Rechazar"
                >
                  <XCircle size={13} />
                </button>
              )}
              {reg.status !== 'withdrawn' && reg.status !== 'rejected' && reg.status !== 'draft' && (
                <button
                  onClick={() => patchRegistration({ status: 'withdrawn' })}
                  className="p-1 rounded-md text-slate-500 hover:bg-slate-100 transition-colors"
                  title="Retirar"
                >
                  <UserMinus size={13} />
                </button>
              )}
            </div>
          </div>

          <div className="h-10 w-px bg-slate-200" />

          {/* Pago */}
          <div className="flex flex-col items-end gap-1">
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Pago</p>
            {reg.paidAt ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700">
                <CheckCircle2 size={11} /> Pagado
              </span>
            ) : (
              <button
                onClick={handleMarkPaid}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-emerald-700 transition-colors"
              >
                <DollarIcon size={11} /> Marcar
              </button>
            )}
            {reg.paidAt && (
              <span className="text-[9px] text-slate-400">{new Date(reg.paidAt).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })}</span>
            )}
          </div>

          <div className="h-10 w-px bg-slate-200" />

          {/* Grupo */}
          <div className="flex flex-col items-end gap-1">
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Grupo</p>
            {groups.length === 0 ? (
              <span className="text-[11px] text-slate-400 italic">Sin grupos</span>
            ) : (
              <select
                value={reg.groupId ?? ''}
                onChange={(e) => patchRegistration({ groupId: e.target.value || null })}
                className="text-[11px] font-semibold border border-slate-200 rounded-md px-1.5 py-0.5 bg-white text-slate-700 focus:border-green-500 focus:ring-2 focus:ring-green-500/20 outline-none"
              >
                <option value="">—</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            )}
            {group && (
              <span className="text-[9px] text-slate-400">Código {group.code}</span>
            )}
          </div>

          <div className="h-10 w-px bg-slate-200" />

          {/* Seed */}
          <div className="flex flex-col items-end gap-1">
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest" title="Orden para sortear grupos y llaves">Cabeza de serie</p>
            <SeedEditor value={reg.seedRank} onChange={(v) => patchRegistration({ seedRank: v ?? undefined })} />
          </div>
        </div>
      </TeamHero>

      {/* Tabs nav */}
      <div className="border-b border-slate-200 mb-6 -mx-2 overflow-x-auto">
        <div className="flex items-center gap-1 px-2">
          {TABS.map(({ key, label, icon: Icon, enabled }) => (
            <button
              key={key}
              type="button"
              disabled={!enabled}
              onClick={() => enabled && setTab(key)}
              className={clsx(
                'flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap',
                !enabled && 'opacity-40 cursor-not-allowed',
                enabled && tab === key
                  ? 'border-green-600 text-green-700'
                  : enabled
                    ? 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
                    : 'border-transparent text-slate-400',
              )}
            >
              <Icon size={15} />
              {label}
              {!enabled && (
                <span className="text-[9px] font-bold uppercase tracking-wide text-slate-400 bg-slate-100 rounded px-1.5 py-0.5 ml-1">
                  Pronto
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      {tab === 'roster' && (
        <RosterTab
          registrationId={reg.id}
          editionId={editionId}
          teamId={reg.team.id}
          editionName={edition?.name}
          teamName={reg.team.name}
          teamLogoUrl={reg.team.logoUrl}
          groupName={groups.find((g) => g.id === reg.groupId)?.name ?? null}
          city={reg.team.city}
          requiredPlayerFields={edition?.requiredPlayerFields ?? []}
        />
      )}
      {tab === 'matches' && <TeamMatchesTab editionId={editionId} teamId={reg.team.id} />}
      {tab === 'payments' && (
        <TeamPaymentsTab
          editionId={editionId}
          teamId={reg.team.id}
          registrationId={reg.id}
          currency={edition.currency}
          fee={edition.registrationFee}
        />
      )}
      {tab === 'fines' && (
        <TeamFinesTab editionId={editionId} teamId={reg.team.id} registrationId={reg.id} currency={edition.currency} />
      )}
      {tab === 'stats' && <TeamStatsTab editionId={editionId} teamId={reg.team.id} />}
    </div>
  )
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

function TeamHero({
  reg, onLogoUpdated, onTeamUpdated, children,
}: {
  reg: RegistrationFromApi
  onLogoUpdated: (logoUrl: string | null) => void
  onTeamUpdated: (patch: { name?: string; shortName?: string; city?: string; primaryColor?: string }) => void
  children?: React.ReactNode
}) {
  const logoRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState({
    name: reg.team.name,
    shortName: reg.team.shortName ?? '',
    city: reg.team.city ?? '',
    primaryColor: reg.team.primaryColor ?? '#16a34a',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleLogo(file: File) {
    setUploading(true)
    try {
      const resized = await resizeImage(file, { maxSize: 512, quality: 0.9 })
      if (resized.size > 5 * 1024 * 1024) {
        alert('La imagen es demasiado grande. Usa una menor a 5 MB.')
        return
      }
      const updated = await uploadTeamLogo(reg.team.id, resized)
      onLogoUpdated(updated.logoUrl)
    } finally {
      setUploading(false)
    }
  }

  async function saveEdit() {
    setSaving(true)
    setError(null)
    try {
      const updated = await updateTeam(reg.team.id, {
        name: draft.name.trim(),
        shortName: draft.shortName.trim() || undefined,
        city: draft.city.trim() || undefined,
        primaryColor: draft.primaryColor,
      })
      onTeamUpdated({
        name: updated.name,
        shortName: updated.shortName ?? undefined,
        city: updated.city ?? undefined,
        primaryColor: updated.primaryColor ?? undefined,
      })
      setEditing(false)
    } catch (err) {
      setError(extractError(err) ?? 'No se pudo actualizar el equipo.')
    } finally {
      setSaving(false)
    }
  }

  function cancelEdit() {
    setDraft({
      name: reg.team.name,
      shortName: reg.team.shortName ?? '',
      city: reg.team.city ?? '',
      primaryColor: reg.team.primaryColor ?? '#16a34a',
    })
    setError(null)
    setEditing(false)
  }

  return (
    <div
      className="relative rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-5 bg-white"
      style={reg.team.primaryColor ? {
        backgroundImage: `linear-gradient(to right, ${reg.team.primaryColor}14, transparent 40%)`,
      } : undefined}
    >
      <div className="flex items-center gap-4 px-5 py-4 flex-wrap">
        {/* Logo */}
        <div
          className="relative w-14 h-14 rounded-xl border border-slate-200 overflow-hidden flex-shrink-0 bg-white cursor-pointer group"
          onClick={() => logoRef.current?.click()}
          title="Cambiar logo"
        >
          {reg.team.logoUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={reg.team.logoUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <div
              className="w-full h-full flex items-center justify-center"
              style={reg.team.primaryColor ? { background: `${reg.team.primaryColor}18` } : { background: '#f1f5f9' }}
            >
              <Shield size={22} style={{ color: reg.team.primaryColor ?? '#94a3b8' }} />
            </div>
          )}
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            {uploading
              ? <Loader2 size={14} className="animate-spin text-white" />
              : <Upload size={14} className="text-white" />
            }
          </div>
          <input
            ref={logoRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleLogo(f) }}
          />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          {editing ? (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <input
                  autoFocus
                  className={inputCls}
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  placeholder="Nombre"
                />
                <input
                  className={inputCls}
                  maxLength={10}
                  value={draft.shortName}
                  onChange={(e) => setDraft({ ...draft, shortName: e.target.value.toUpperCase() })}
                  placeholder="Sigla"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  className={inputCls}
                  value={draft.city}
                  onChange={(e) => setDraft({ ...draft, city: e.target.value })}
                  placeholder="Ciudad"
                />
                <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3">
                  <input
                    type="color"
                    className="w-6 h-7 cursor-pointer"
                    value={draft.primaryColor}
                    onChange={(e) => setDraft({ ...draft, primaryColor: e.target.value })}
                  />
                  <span className="font-mono text-xs text-slate-500">{draft.primaryColor}</span>
                </div>
              </div>
              {error && (
                <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-600">
                  <AlertCircle size={12} /> {error}
                </div>
              )}
              <div className="flex items-center gap-2">
                <button
                  onClick={saveEdit}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-3 py-1 bg-green-600 text-white text-xs font-bold rounded-lg hover:bg-green-700 disabled:opacity-60 transition-colors"
                >
                  {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                  Guardar
                </button>
                <button
                  onClick={cancelEdit}
                  disabled={saving}
                  className="flex items-center gap-1 px-3 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <X size={12} /> Cancelar
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 min-w-0">
                <h1 className="text-base font-bold text-slate-900 truncate">{reg.team.name}</h1>
                {reg.team.shortName && (
                  <span className="text-[10px] font-bold text-slate-500 bg-slate-100 rounded px-1.5 py-0.5 uppercase tracking-wide flex-shrink-0">
                    {reg.team.shortName}
                  </span>
                )}
                <button
                  onClick={() => setEditing(true)}
                  className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors flex-shrink-0"
                  title="Editar"
                >
                  <Pencil size={11} />
                </button>
              </div>
              <div className="flex items-center flex-wrap gap-x-2 gap-y-0.5 mt-0.5 text-[11px] text-slate-500">
                {reg.team.city && <span>{reg.team.city}</span>}
                {reg.team.directorUid && (
                  <span className="inline-flex items-center gap-1 font-mono text-[10px] text-slate-400">
                    DT {reg.team.directorUid.slice(0, 8)}...
                  </span>
                )}
                {reg.team.primaryColor && (
                  <span className="inline-flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full border border-slate-200" style={{ background: reg.team.primaryColor }} />
                    <span className="font-mono text-[10px] text-slate-400">{reg.team.primaryColor}</span>
                  </span>
                )}
              </div>
            </>
          )}
        </div>

        {/* Right: stats slot */}
        {!editing && children && (
          <div className="flex-shrink-0 ml-auto">{children}</div>
        )}
      </div>
    </div>
  )
}

// ─── Seed editor ──────────────────────────────────────────────────────────────

function SeedEditor({ value, onChange }: { value: number | null; onChange: (v: number | null) => void }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value?.toString() ?? '')

  if (!editing) {
    return (
      <button
        onClick={() => { setDraft(value?.toString() ?? ''); setEditing(true) }}
        className="text-sm font-semibold text-slate-700 hover:text-green-700 transition-colors"
      >
        {value ?? '—'} <Pencil size={10} className="inline" />
      </button>
    )
  }

  return (
    <div className="flex items-center gap-1">
      <input
        type="number"
        min={1}
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          const n = parseInt(draft)
          onChange(Number.isFinite(n) && n > 0 ? n : null)
          setEditing(false)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur()
          if (e.key === 'Escape') { setDraft(value?.toString() ?? ''); setEditing(false) }
        }}
        className="w-16 text-xs border border-slate-200 rounded-lg px-2 py-1 bg-white text-slate-700 focus:border-green-500 focus:ring-2 focus:ring-green-500/20 outline-none"
        placeholder="—"
      />
    </div>
  )
}

function extractError(err: unknown): string | null {
  if (typeof err !== 'object' || err === null) return null
  const maybeAxios = err as { response?: { data?: { message?: string | string[] } } }
  const msg = maybeAxios.response?.data?.message
  if (!msg) return null
  return Array.isArray(msg) ? msg[0] ?? null : msg
}
