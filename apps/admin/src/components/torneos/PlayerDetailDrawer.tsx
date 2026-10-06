'use client'

import { useRef, useState } from 'react'
import {
  AlertCircle, BarChart2, Calendar, Crown, Download, FileText, Loader2, Mail,
  Pencil, Phone, Save, Shield, Trash2, Upload, User, X,
} from 'lucide-react'
import { clsx } from 'clsx'
import {
  PLAYER_POSITIONS,
  PLAYER_POSITION_LABEL,
  uploadPlayerFile,
  fetchPlayerFileUrl,
  removePlayerFile,
  type PlayerFileKind,
  type PlayerPosition,
  type RegistrationPlayerFromApi,
} from '@/lib/registration-players'
import { Field, inputCls } from '@/components/ui/form'

export type PlayerFormValues = {
  firstName: string
  lastName: string
  docNumber: string
  birthDate: string
  employer: string
  phone: string
  email: string
  healthProvider: string
  jerseyNumber: string
  position: PlayerPosition | ''
  isCaptain: boolean
  emergencyContactName: string
  emergencyContactPhone: string
}

export const EMPTY_PLAYER_FORM: PlayerFormValues = {
  firstName: '', lastName: '', docNumber: '', birthDate: '',
  employer: '', phone: '', email: '', healthProvider: '',
  jerseyNumber: '', position: '', isCaptain: false,
  emergencyContactName: '', emergencyContactPhone: '',
}

export function fromPlayer(p: RegistrationPlayerFromApi): PlayerFormValues {
  return {
    firstName: p.firstName ?? '',
    lastName: p.lastName ?? '',
    docNumber: p.docNumber ?? '',
    birthDate: p.birthDate ?? '',
    employer: p.employer ?? '',
    phone: p.phone ?? '',
    email: p.email ?? '',
    healthProvider: p.healthProvider ?? '',
    jerseyNumber: p.jerseyNumber?.toString() ?? '',
    position: p.position ?? '',
    isCaptain: p.isCaptain,
    emergencyContactName: p.emergencyContactName ?? '',
    emergencyContactPhone: p.emergencyContactPhone ?? '',
  }
}

type Mode = 'view' | 'edit'
type TabKey = 'profile' | 'history' | 'attendance'

const TABS: { key: TabKey; label: string; icon: React.ElementType; enabled: boolean }[] = [
  { key: 'profile',    label: 'Datos personales', icon: User,      enabled: true },
  { key: 'history',    label: 'Historial',        icon: BarChart2, enabled: false },
  { key: 'attendance', label: 'Asistencia',       icon: Calendar,  enabled: false },
]

export function PlayerDetailDrawer({
  player, onClose, onSubmit,
}: {
  // Null when creating
  player: RegistrationPlayerFromApi | null
  onClose: () => void
  onSubmit: (values: PlayerFormValues) => Promise<void>
}) {
  const [mode, setMode] = useState<Mode>(player ? 'view' : 'edit')
  const [tab, setTab] = useState<TabKey>('profile')
  const [values, setValues] = useState<PlayerFormValues>(
    player ? fromPlayer(player) : EMPTY_PLAYER_FORM,
  )
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function patch(p: Partial<PlayerFormValues>) {
    setValues((v) => ({ ...v, ...p }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await onSubmit(values)
      if (player) setMode('view') // back to view on successful edit
    } catch (err) {
      setError(err instanceof Error ? err.message : extractError(err) ?? 'No se pudo guardar.')
      setSubmitting(false)
    }
  }

  function cancelEdit() {
    if (player) {
      setValues(fromPlayer(player))
      setMode('view')
    } else {
      onClose()
    }
    setError(null)
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={submitting ? undefined : onClose} />
      <aside className="fixed right-0 top-0 h-full w-full max-w-lg bg-white shadow-2xl z-50 flex flex-col">
        {/* Close */}
        <button
          onClick={onClose}
          disabled={submitting}
          className="absolute top-3 right-3 z-10 text-slate-400 hover:text-slate-700 transition-colors disabled:opacity-50 bg-white/80 backdrop-blur-sm rounded-lg p-1.5"
        >
          <X size={16} />
        </button>

        {/* Hero */}
        {player ? (
          <PlayerHero player={player} onEdit={mode === 'view' ? () => setMode('edit') : undefined} />
        ) : (
          <div className="px-5 pt-5 pb-4 border-b border-slate-100">
            <h2 className="text-base font-bold text-slate-900">Agregar jugador</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Completa los datos básicos. El resto se puede editar después.
            </p>
          </div>
        )}

        {/* Tabs (only when viewing existing) */}
        {player && (
          <div className="border-b border-slate-200 px-3">
            <div className="flex items-center gap-1 overflow-x-auto">
              {TABS.map(({ key, label, icon: Icon, enabled }) => (
                <button
                  key={key}
                  type="button"
                  disabled={!enabled}
                  onClick={() => enabled && setTab(key)}
                  className={clsx(
                    'flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap',
                    !enabled && 'opacity-40 cursor-not-allowed',
                    enabled && tab === key
                      ? 'border-green-600 text-green-700'
                      : enabled
                        ? 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
                        : 'border-transparent text-slate-400',
                  )}
                >
                  <Icon size={13} />
                  {label}
                  {!enabled && (
                    <span className="text-[9px] font-bold uppercase tracking-wide text-slate-400 bg-slate-100 rounded px-1.5 py-0.5">
                      Pronto
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Profile tab — view or edit */}
          {(!player || tab === 'profile') && mode === 'view' && player && (
            <ProfileView player={player} />
          )}
          {(!player || tab === 'profile') && mode === 'edit' && (
            <ProfileForm
              values={values}
              onPatch={patch}
              onSubmit={handleSubmit}
              error={error}
            />
          )}

          {/* History tab (placeholder) */}
          {player && tab === 'history' && <ComingSoon label="Historial del torneo" />}

          {/* Attendance tab (placeholder) */}
          {player && tab === 'attendance' && <ComingSoon label="Asistencia" />}
        </div>

        {/* Footer — only in edit mode */}
        {mode === 'edit' && (
          <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-slate-200 bg-slate-50">
            <button
              type="button"
              onClick={cancelEdit}
              disabled={submitting}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSubmit as unknown as () => void}
              disabled={submitting}
              className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white text-xs font-bold rounded-lg hover:bg-green-700 disabled:opacity-60 transition-colors"
            >
              {submitting ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
              Guardar
            </button>
          </div>
        )}
      </aside>
    </>
  )
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

function PlayerHero({ player, onEdit }: { player: RegistrationPlayerFromApi; onEdit?: () => void }) {
  return (
    <div className="relative px-5 pt-8 pb-4 border-b border-slate-100 bg-gradient-to-br from-slate-50 to-white">
      <div className="flex items-start gap-4">
        {/* Dorsal disc */}
        <div className="flex-shrink-0 w-16 h-16 rounded-2xl border-2 border-slate-200 bg-white flex items-center justify-center shadow-sm">
          {player.jerseyNumber != null ? (
            <span className="text-2xl font-bold text-slate-800">{player.jerseyNumber}</span>
          ) : (
            <Shield size={24} className="text-slate-300" />
          )}
        </div>

        <div className="flex-1 min-w-0 pt-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-base font-bold text-slate-900 truncate">{player.playerName}</h2>
            {player.isCaptain && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-full px-2 py-0.5">
                <Crown size={10} fill="currentColor" /> Capitán
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
            {player.position ? (
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-flex items-center rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-bold text-slate-700 uppercase tracking-wide">
                  {player.position}
                </span>
                {PLAYER_POSITION_LABEL[player.position]}
              </span>
            ) : (
              <span className="italic text-slate-400">Sin posición asignada</span>
            )}
          </div>
        </div>

        {onEdit && (
          <button
            onClick={onEdit}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors flex-shrink-0"
          >
            <Pencil size={11} /> Editar
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Profile view (read-only) ────────────────────────────────────────────────

function ProfileView({ player }: { player: RegistrationPlayerFromApi }) {
  return (
    <div className="px-5 py-5 flex flex-col gap-5">
      <Section title="Identidad">
        <InfoRow label="Cédula" value={player.docNumber} mono />
        <InfoRow
          label="Nacimiento"
          value={player.birthDate ? formatBirthDate(player.birthDate) : null}
        />
      </Section>

      <Section title="Contacto">
        <InfoRow
          label="Celular"
          value={player.phone}
          icon={Phone}
          href={player.phone ? `tel:${player.phone}` : undefined}
          mono
        />
        <InfoRow
          label="Correo"
          value={player.email}
          icon={Mail}
          href={player.email ? `mailto:${player.email}` : undefined}
        />
      </Section>

      <Section title="Información laboral y salud">
        <InfoRow label="Empresa" value={player.employer} />
        <InfoRow label="EPS" value={player.healthProvider} />
      </Section>

      <Section title="Contacto de emergencia">
        <InfoRow label="Nombre" value={player.emergencyContactName} />
        <InfoRow
          label="Teléfono"
          value={player.emergencyContactPhone}
          icon={Phone}
          href={player.emergencyContactPhone ? `tel:${player.emergencyContactPhone}` : undefined}
          mono
        />
      </Section>

      <FileSection
        playerId={player.id}
        kind="document"
        title="Documento de identidad"
        accept="application/pdf,image/jpeg,image/png,image/webp,image/heic"
        uploadLabel="Subir documento (PDF o imagen)"
        attachedLabel="Documento adjunto"
        initialHasFile={!!player.docFileUrl}
      />

      <FileSection
        playerId={player.id}
        kind="photo"
        title="Foto del jugador"
        accept="image/jpeg,image/png,image/webp,image/heic"
        uploadLabel="Subir foto"
        attachedLabel="Foto adjunta"
        initialHasFile={!!player.photoFileUrl}
      />
    </div>
  )
}

// ─── Archivo del jugador (cédula / foto) ───────────────────────────────────

function FileSection({
  playerId, kind, title, accept, uploadLabel, attachedLabel, initialHasFile,
}: {
  playerId: string
  kind: PlayerFileKind
  title: string
  accept: string
  uploadLabel: string
  attachedLabel: string
  initialHasFile: boolean
}) {
  const [hasFile, setHasFile] = useState(initialHasFile)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setBusy(true)
    setError(null)
    try {
      await uploadPlayerFile(playerId, kind, file)
      setHasFile(true)
    } catch (err) {
      setError(extractError(err) ?? 'No se pudo subir el archivo.')
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function handleView() {
    setBusy(true)
    setError(null)
    try {
      const url = await fetchPlayerFileUrl(playerId, kind)
      window.open(url, '_blank', 'noopener,noreferrer')
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (err) {
      setError(extractError(err) ?? 'No se pudo abrir el archivo.')
    } finally {
      setBusy(false)
    }
  }

  async function handleRemove() {
    if (!confirm(`¿Eliminar ${title.toLowerCase()} de este jugador?`)) return
    setBusy(true)
    setError(null)
    try {
      await removePlayerFile(playerId, kind)
      setHasFile(false)
    } catch (err) {
      setError(extractError(err) ?? 'No se pudo eliminar el archivo.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2.5">{title}</p>
      <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={handleUpload} />
      <div className="rounded-xl border border-slate-200 bg-white p-3">
        {hasFile ? (
          <div className="flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-2 text-sm text-slate-700 min-w-0">
              <FileText size={15} className="text-green-600 flex-shrink-0" />
              <span className="truncate">{attachedLabel}</span>
            </span>
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                type="button" onClick={handleView} disabled={busy}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50"
              >
                {busy ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />} Ver
              </button>
              <button
                type="button" onClick={() => inputRef.current?.click()} disabled={busy}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors disabled:opacity-50"
                title="Reemplazar"
              >
                <Upload size={13} />
              </button>
              <button
                type="button" onClick={handleRemove} disabled={busy}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-50"
                title="Eliminar"
              >
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button" onClick={() => inputRef.current?.click()} disabled={busy}
            className="flex items-center justify-center gap-2 w-full py-3 rounded-lg border-2 border-dashed border-slate-200 text-sm font-semibold text-slate-500 hover:border-green-300 hover:text-green-700 transition-colors disabled:opacity-50"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            {uploadLabel}
          </button>
        )}
        {error && (
          <div className="flex items-center gap-2 mt-2 text-xs text-red-600">
            <AlertCircle size={12} /> {error}
          </div>
        )}
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2.5">{title}</p>
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden divide-y divide-slate-100">
        {children}
      </div>
    </div>
  )
}

function InfoRow({
  label, value, icon: Icon, href, mono = false,
}: {
  label: string
  value: string | null | undefined
  icon?: React.ElementType
  href?: string
  mono?: boolean
}) {
  const display = value ? (
    href ? (
      <a
        href={href}
        className={clsx(
          'inline-flex items-center gap-1.5 text-slate-800 hover:text-green-700 transition-colors',
          mono && 'font-mono',
        )}
      >
        {Icon && <Icon size={11} className="text-slate-400" />}
        {value}
      </a>
    ) : (
      <span className={clsx('inline-flex items-center gap-1.5 text-slate-800', mono && 'font-mono')}>
        {Icon && <Icon size={11} className="text-slate-400" />}
        {value}
      </span>
    )
  ) : (
    <span className="text-slate-300 italic">Sin registrar</span>
  )

  return (
    <div className="flex items-center justify-between gap-4 px-4 py-2.5">
      <span className="text-xs font-semibold text-slate-500">{label}</span>
      <span className="text-sm text-right">{display}</span>
    </div>
  )
}

function formatBirthDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  if (isNaN(d.getTime())) return iso
  const dateStr = d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
  // Age calculation
  const today = new Date()
  let age = today.getFullYear() - d.getFullYear()
  const m = today.getMonth() - d.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age--
  return `${dateStr} · ${age} años`
}

// ─── Profile form (edit) ──────────────────────────────────────────────────────

function ProfileForm({
  values, onPatch, onSubmit, error,
}: {
  values: PlayerFormValues
  onPatch: (p: Partial<PlayerFormValues>) => void
  onSubmit: (e: React.FormEvent) => void
  error: string | null
}) {
  return (
    <form onSubmit={onSubmit} className="px-5 py-5 flex flex-col gap-4">
      <FormSection title="Identidad">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nombres">
            <input autoFocus className={inputCls} value={values.firstName}
              onChange={(e) => onPatch({ firstName: e.target.value })} placeholder="Diego Alexander" />
          </Field>
          <Field label="Apellidos">
            <input className={inputCls} value={values.lastName}
              onChange={(e) => onPatch({ lastName: e.target.value })} placeholder="Espejo Lara" />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="N° Cédula">
            <input className={inputCls} value={values.docNumber}
              onChange={(e) => onPatch({ docNumber: e.target.value })} placeholder="1030553463" />
          </Field>
          <Field label="Fecha de nacimiento">
            <input type="date" className={inputCls} value={values.birthDate}
              onChange={(e) => onPatch({ birthDate: e.target.value })} />
          </Field>
        </div>
      </FormSection>

      <FormSection title="Contacto">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Celular">
            <input type="tel" className={inputCls} value={values.phone}
              onChange={(e) => onPatch({ phone: e.target.value })} placeholder="3124035940" />
          </Field>
          <Field label="Correo electrónico">
            <input type="email" className={inputCls} value={values.email}
              onChange={(e) => onPatch({ email: e.target.value })} placeholder="jugador@example.com" />
          </Field>
        </div>
      </FormSection>

      <FormSection title="Información adicional">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Empresa donde labora">
            <input className={inputCls} value={values.employer}
              onChange={(e) => onPatch({ employer: e.target.value })} placeholder="Domun Inc" />
          </Field>
          <Field label="EPS">
            <input className={inputCls} value={values.healthProvider}
              onChange={(e) => onPatch({ healthProvider: e.target.value })} placeholder="Sanitas" />
          </Field>
        </div>
      </FormSection>

      <FormSection title="Contacto de emergencia">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nombre">
            <input className={inputCls} value={values.emergencyContactName}
              onChange={(e) => onPatch({ emergencyContactName: e.target.value })} placeholder="María Pérez" />
          </Field>
          <Field label="Teléfono">
            <input type="tel" className={inputCls} value={values.emergencyContactPhone}
              onChange={(e) => onPatch({ emergencyContactPhone: e.target.value })} placeholder="3124035940" />
          </Field>
        </div>
      </FormSection>

      <FormSection title="Rol en el equipo">
        <div className="grid grid-cols-[80px_1fr] gap-3">
          <Field label="Dorsal">
            <input type="number" min={0} className={inputCls} value={values.jerseyNumber}
              onChange={(e) => onPatch({ jerseyNumber: e.target.value })} placeholder="10" />
          </Field>
          <Field label="Posición">
            <select className={inputCls} value={values.position}
              onChange={(e) => onPatch({ position: e.target.value as PlayerPosition | '' })}>
              <option value="">—</option>
              {PLAYER_POSITIONS.map((p) => (
                <option key={p} value={p}>{p} ({PLAYER_POSITION_LABEL[p]})</option>
              ))}
            </select>
          </Field>
        </div>
        <label className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 cursor-pointer hover:bg-slate-100 transition-colors">
          <input type="checkbox" className="w-4 h-4 accent-yellow-500"
            checked={values.isCaptain}
            onChange={(e) => onPatch({ isCaptain: e.target.checked })} />
          <Crown size={14} className={values.isCaptain ? 'text-yellow-500' : 'text-slate-400'} fill={values.isCaptain ? 'currentColor' : 'none'} />
          <span className="text-sm font-semibold text-slate-700">Marcar como capitán</span>
        </label>
      </FormSection>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
          <AlertCircle size={12} /> {error}
        </div>
      )}
    </form>
  )
}

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">{title}</p>
      <div className="space-y-3">{children}</div>
    </div>
  )
}

// ─── Placeholder ──────────────────────────────────────────────────────────────

function ComingSoon({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20 px-5">
      <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center">
        <BarChart2 size={22} className="text-slate-300" />
      </div>
      <div className="text-center">
        <p className="text-sm font-semibold text-slate-600">{label}</p>
        <p className="text-xs text-slate-400 mt-1">
          Disponible cuando implementemos el módulo de partidos.
        </p>
      </div>
    </div>
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
