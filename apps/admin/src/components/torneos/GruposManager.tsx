'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ChevronLeft, Loader2, AlertCircle, Plus, Layers, Shuffle, Wand2, Shield,
  Pencil, Trash2, Save, X, UserMinus, Users,
} from 'lucide-react'
import { clsx } from 'clsx'
import {
  getGroupsByEdition,
  createGroup,
  updateGroup,
  deleteGroup,
  generateGroups,
  drawGroups,
  type GroupFromApi,
} from '@/lib/groups'
import {
  getRegistrationsByEdition,
  updateRegistration,
  type RegistrationFromApi,
} from '@/lib/registrations'
import { getEdition, type EditionFromApi } from '@/lib/leagues'
import { Field, inputCls } from '@/components/ui/form'

export function GruposManager({
  editionId,
  backHref,
  backLabel = 'Gestionar',
}: {
  editionId: string
  backHref?: string
  backLabel?: string
}) {
  const [edition, setEdition] = useState<EditionFromApi | null>(null)
  const [groups, setGroups] = useState<GroupFromApi[]>([])
  const [registrations, setRegistrations] = useState<RegistrationFromApi[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [assignToGroupId, setAssignToGroupId] = useState<string | null>(null)

  async function reload() {
    const [g, r] = await Promise.all([
      getGroupsByEdition(editionId),
      getRegistrationsByEdition(editionId),
    ])
    setGroups(g)
    setRegistrations(r)
  }

  useEffect(() => {
    Promise.all([
      getEdition(editionId).then(setEdition),
      reload(),
    ])
      .catch(() => setError('No se pudieron cargar los grupos.'))
      .finally(() => setLoading(false))
  }, [editionId])

  // Approved registrations grouped by group + the unassigned pool
  const approved = useMemo(() => registrations.filter((r) => r.status === 'approved'), [registrations])
  const byGroup = useMemo(() => {
    const m = new Map<string, RegistrationFromApi[]>()
    for (const g of groups) m.set(g.id, [])
    for (const r of approved) {
      if (r.groupId && m.has(r.groupId)) m.get(r.groupId)!.push(r)
    }
    return m
  }, [groups, approved])
  const unassigned = useMemo(() => approved.filter((r) => !r.groupId), [approved])

  async function run<T>(key: string, fn: () => Promise<T>): Promise<T | undefined> {
    setBusy(key)
    setError(null)
    try {
      return await fn()
    } catch (err) {
      setError(extractError(err) ?? 'Algo salió mal.')
      return undefined
    } finally {
      setBusy(null)
    }
  }

  async function handleGenerate() {
    if (groups.length > 0) {
      if (!confirm('Ya hay grupos. La generación automática solo funciona si no existen grupos. ¿Quieres eliminarlos primero?')) return
      // Delete each one
      await Promise.all(groups.map((g) => deleteGroup(g.id)))
    }
    await run('generate', async () => {
      await generateGroups(editionId)
      await reload()
    })
  }

  async function handleDraw(mode: 'all' | 'unassigned') {
    const label = mode === 'all'
      ? 'Esto redistribuye TODOS los equipos aprobados entre los grupos. ¿Continuar?'
      : '¿Asignar los equipos sin grupo a los grupos existentes?'
    if (!confirm(label)) return
    await run('draw', async () => {
      await drawGroups(editionId, mode)
      await reload()
    })
  }

  async function handleCreateGroup(name: string, code: string, maxTeams: number | null) {
    await run('create', async () => {
      await createGroup({
        editionId,
        name,
        code,
        maxTeams: maxTeams ?? undefined,
        order: groups.length,
        phase: 'groups',
      })
      await reload()
      setCreating(false)
    })
  }

  async function handleUpdateGroup(id: string, patch: { name?: string; code?: string; maxTeams?: number | null }) {
    await run(`update-${id}`, async () => {
      await updateGroup(id, {
        name: patch.name,
        code: patch.code,
        maxTeams: patch.maxTeams === null ? undefined : patch.maxTeams,
      })
      await reload()
    })
  }

  async function handleDeleteGroup(id: string) {
    const teamsIn = byGroup.get(id)?.length ?? 0
    const msg = teamsIn > 0
      ? `Este grupo tiene ${teamsIn} equipo${teamsIn === 1 ? '' : 's'}. Quedarán sin grupo. ¿Eliminar?`
      : '¿Eliminar este grupo?'
    if (!confirm(msg)) return
    await run(`delete-${id}`, async () => {
      await deleteGroup(id)
      await reload()
    })
  }

  async function assignTeam(registrationId: string, groupId: string | null) {
    const updated = await updateRegistration(registrationId, { groupId })
    setRegistrations((prev) => prev.map((r) => (r.id === registrationId ? { ...r, ...updated } : r)))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-3 py-32 text-slate-400">
        <Loader2 size={22} className="animate-spin" />
        <span className="text-sm">Cargando grupos...</span>
      </div>
    )
  }

  if (error && !edition) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
        <AlertCircle size={16} /> {error}
      </div>
    )
  }

  const canGenerate = groups.length === 0
  const canDraw = groups.length > 0 && approved.length > 0

  return (
    <div>
      {/* Top bar */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <Link
          href={backHref ?? `/torneos/edicion/${editionId}/gestionar`}
          className="flex items-center gap-1 text-sm text-slate-400 hover:text-slate-700 transition-colors"
        >
          <ChevronLeft size={15} />
          <span>{backLabel}</span>
        </Link>
        <span className="text-slate-300">/</span>
        <span className="text-sm font-semibold text-slate-900">Grupos</span>
        <div className="flex-1" />

        <button
          disabled={!canDraw || busy === 'draw'}
          onClick={() => handleDraw('all')}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          title={!canDraw ? 'Necesitas grupos y equipos aprobados' : undefined}
        >
          {busy === 'draw' ? <Loader2 size={12} className="animate-spin" /> : <Shuffle size={12} />}
          Sortear equipos
        </button>

        <button
          disabled={busy === 'generate'}
          onClick={handleGenerate}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-indigo-200 bg-indigo-50 text-xs font-bold text-indigo-700 hover:bg-indigo-100 transition-all disabled:opacity-50"
          title={canGenerate ? 'Crea grupos según el formato' : 'Reemplazará los grupos existentes'}
        >
          {busy === 'generate' ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />}
          Generar desde formato
        </button>

        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-green-600 text-white text-xs font-bold hover:bg-green-700 transition-all shadow-sm"
        >
          <Plus size={12} />
          Nuevo grupo
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600 mb-4">
          <AlertCircle size={12} /> {error}
        </div>
      )}

      {/* Stats header */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 mb-5 flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center">
            <Layers size={18} className="text-indigo-700" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-900">
              {groups.length} {groups.length === 1 ? 'grupo' : 'grupos'} · {approved.length} equipos aprobados
            </p>
            <p className="text-xs text-slate-400">
              {unassigned.length > 0
                ? `${unassigned.length} sin asignar`
                : 'Todos los aprobados están en un grupo'}
            </p>
          </div>
        </div>
        {unassigned.length > 0 && groups.length > 0 && (
          <button
            onClick={() => handleDraw('unassigned')}
            className="text-xs font-semibold text-indigo-700 hover:text-indigo-800 transition-colors"
          >
            Asignar los {unassigned.length} pendientes →
          </button>
        )}
      </div>

      {/* Groups grid */}
      {groups.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16 bg-white rounded-2xl border-2 border-dashed border-slate-200">
          <Layers size={28} className="text-slate-300" />
          <p className="text-sm font-semibold text-slate-500">Aún no hay grupos</p>
          <p className="text-xs text-slate-400 max-w-sm text-center">
            Genera grupos automáticamente desde el formato configurado, o crea uno manualmente.
          </p>
          <div className="flex items-center gap-2 mt-2">
            <button
              onClick={handleGenerate}
              disabled={busy === 'generate'}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 border border-indigo-200 text-xs font-bold text-indigo-700 hover:bg-indigo-100 transition-colors disabled:opacity-50"
            >
              <Wand2 size={12} /> Generar desde formato
            </button>
            <button
              onClick={() => setCreating(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs font-bold hover:bg-green-700 transition-colors"
            >
              <Plus size={12} /> Nuevo grupo
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-5">
          {groups.map((g) => (
            <GroupCard
              key={g.id}
              group={g}
              members={byGroup.get(g.id) ?? []}
              busy={busy?.startsWith('update-' + g.id) || busy?.startsWith('delete-' + g.id)}
              onUpdate={(patch) => handleUpdateGroup(g.id, patch)}
              onDelete={() => handleDeleteGroup(g.id)}
              onAssignClick={() => setAssignToGroupId(g.id)}
              onRemoveTeam={(regId) => assignTeam(regId, null)}
            />
          ))}
        </div>
      )}

      {/* Unassigned pool */}
      {unassigned.length > 0 && (
        <div className="bg-white rounded-2xl border border-amber-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-amber-100 bg-amber-50 flex items-center gap-2">
            <Users size={14} className="text-amber-700" />
            <p className="text-sm font-bold text-amber-800">Equipos sin grupo</p>
            <span className="text-[10px] font-bold text-amber-700 bg-white border border-amber-200 rounded-full px-2 py-0.5">
              {unassigned.length}
            </span>
          </div>
          <div className="px-5 py-3 flex flex-wrap gap-2">
            {unassigned.map((reg) => (
              <TeamChip
                key={reg.id}
                reg={reg}
                action={
                  groups.length > 0 ? (
                    <select
                      value=""
                      onChange={(e) => e.target.value && assignTeam(reg.id, e.target.value)}
                      className="text-[10px] font-semibold border border-slate-200 rounded px-1.5 py-0.5 bg-white text-slate-600 outline-none"
                    >
                      <option value="">Asignar...</option>
                      {groups.map((g) => (
                        <option key={g.id} value={g.id}>{g.name}</option>
                      ))}
                    </select>
                  ) : null
                }
              />
            ))}
          </div>
        </div>
      )}

      {creating && (
        <CreateGroupDialog
          existingCodes={groups.map((g) => g.code)}
          onClose={() => setCreating(false)}
          onSubmit={handleCreateGroup}
        />
      )}

      {assignToGroupId && (
        <AssignTeamsDialog
          group={groups.find((g) => g.id === assignToGroupId)!}
          unassigned={unassigned}
          onClose={() => setAssignToGroupId(null)}
          onAssign={async (regIds) => {
            for (const regId of regIds) await assignTeam(regId, assignToGroupId)
            setAssignToGroupId(null)
          }}
        />
      )}
    </div>
  )
}

// ─── Group card ──────────────────────────────────────────────────────────────

function GroupCard({
  group, members, busy = false, onUpdate, onDelete, onAssignClick, onRemoveTeam,
}: {
  group: GroupFromApi
  members: RegistrationFromApi[]
  busy?: boolean
  onUpdate: (patch: { name?: string; code?: string; maxTeams?: number | null }) => Promise<void>
  onDelete: () => Promise<void>
  onAssignClick: () => void
  onRemoveTeam: (registrationId: string) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState({
    name: group.name,
    code: group.code,
    maxTeams: group.maxTeams?.toString() ?? '',
  })

  async function save() {
    await onUpdate({
      name: draft.name.trim() || group.name,
      code: draft.code.trim().toUpperCase() || group.code,
      maxTeams: draft.maxTeams ? parseInt(draft.maxTeams) : null,
    })
    setEditing(false)
  }

  const capacity = group.maxTeams
  const isFull = capacity != null && members.length >= capacity
  const isOverflow = capacity != null && members.length > capacity

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-3">
        <div className={clsx(
          'w-10 h-10 rounded-xl flex items-center justify-center font-bold text-base',
          'bg-indigo-50 border border-indigo-200 text-indigo-700',
        )}>
          {group.code}
        </div>

        {editing ? (
          <div className="flex-1 flex items-center gap-2">
            <input
              autoFocus
              className="flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm font-semibold focus:border-green-500 focus:ring-2 focus:ring-green-500/20 outline-none"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="Nombre"
            />
            <input
              className="w-12 rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm font-bold uppercase text-center focus:border-green-500 focus:ring-2 focus:ring-green-500/20 outline-none"
              maxLength={5}
              value={draft.code}
              onChange={(e) => setDraft({ ...draft, code: e.target.value.toUpperCase() })}
              placeholder="A"
            />
            <input
              type="number"
              min={2}
              className="w-14 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs focus:border-green-500 focus:ring-2 focus:ring-green-500/20 outline-none"
              value={draft.maxTeams}
              onChange={(e) => setDraft({ ...draft, maxTeams: e.target.value })}
              placeholder="máx"
            />
            <button onClick={save} className="p-1.5 rounded-lg text-green-600 hover:bg-green-50 transition-colors" title="Guardar">
              <Save size={13} />
            </button>
            <button onClick={() => { setDraft({ name: group.name, code: group.code, maxTeams: group.maxTeams?.toString() ?? '' }); setEditing(false) }} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors" title="Cancelar">
              <X size={13} />
            </button>
          </div>
        ) : (
          <>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-slate-900 truncate">{group.name}</p>
              <p className={clsx(
                'text-xs',
                isOverflow ? 'text-red-600 font-semibold' : isFull ? 'text-amber-700 font-semibold' : 'text-slate-400',
              )}>
                {capacity != null ? `${members.length} / ${capacity} equipos` : `${members.length} equipos`}
                {isOverflow && ' · sobrepasa capacidad'}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setEditing(true)}
                disabled={busy}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors disabled:opacity-50"
                title="Editar"
              >
                <Pencil size={13} />
              </button>
              <button
                onClick={onDelete}
                disabled={busy}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-50"
                title="Eliminar"
              >
                <Trash2 size={13} />
              </button>
            </div>
          </>
        )}
      </div>

      {/* Members */}
      <div className="p-3 min-h-[120px]">
        {members.length === 0 ? (
          <button
            onClick={onAssignClick}
            className="w-full flex flex-col items-center justify-center gap-2 py-6 rounded-xl border-2 border-dashed border-slate-200 text-slate-400 hover:border-slate-300 hover:text-slate-500 transition-colors text-xs"
          >
            <Plus size={16} />
            <span>Asignar equipos</span>
          </button>
        ) : (
          <div className="space-y-1.5">
            {members.map((reg) => (
              <div key={reg.id} className="group flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-50 transition-colors">
                {reg.team.logoUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={reg.team.logoUrl} alt="" className="w-7 h-7 rounded-md object-cover border border-slate-200 flex-shrink-0" />
                ) : (
                  <div
                    className="w-7 h-7 rounded-md border border-slate-200 flex items-center justify-center flex-shrink-0"
                    style={reg.team.primaryColor ? { background: `${reg.team.primaryColor}18` } : undefined}
                  >
                    <Shield size={11} style={{ color: reg.team.primaryColor ?? '#94a3b8' }} />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-800 truncate">{reg.team.name}</p>
                </div>
                {reg.seedRank != null && (
                  <span className="text-[9px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded px-1 py-0.5">
                    Seed {reg.seedRank}
                  </span>
                )}
                <button
                  onClick={() => onRemoveTeam(reg.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all"
                  title="Quitar del grupo"
                >
                  <UserMinus size={11} />
                </button>
              </div>
            ))}
            <button
              onClick={onAssignClick}
              className="w-full flex items-center justify-center gap-1.5 mt-2 py-1.5 text-[10px] font-semibold text-slate-500 hover:text-slate-800 hover:bg-slate-50 rounded-lg transition-colors"
            >
              <Plus size={11} /> Agregar equipo
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Team chip ───────────────────────────────────────────────────────────────

function TeamChip({ reg, action }: { reg: RegistrationFromApi; action?: React.ReactNode }) {
  return (
    <div className="inline-flex items-center gap-2 px-2 py-1 rounded-full bg-white border border-slate-200">
      {reg.team.logoUrl ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img src={reg.team.logoUrl} alt="" className="w-5 h-5 rounded-full object-cover border border-slate-100 flex-shrink-0" />
      ) : (
        <div
          className="w-5 h-5 rounded-full border border-slate-200 flex items-center justify-center flex-shrink-0"
          style={reg.team.primaryColor ? { background: `${reg.team.primaryColor}18` } : undefined}
        >
          <Shield size={9} style={{ color: reg.team.primaryColor ?? '#94a3b8' }} />
        </div>
      )}
      <span className="text-xs font-semibold text-slate-800">{reg.team.name}</span>
      {action}
    </div>
  )
}

// ─── Create group dialog ──────────────────────────────────────────────────────

function CreateGroupDialog({
  existingCodes, onClose, onSubmit,
}: {
  existingCodes: string[]
  onClose: () => void
  onSubmit: (name: string, code: string, maxTeams: number | null) => Promise<void>
}) {
  const nextCode = String.fromCharCode(65 + existingCodes.length)
  const [name, setName] = useState(`Grupo ${nextCode}`)
  const [code, setCode] = useState(nextCode)
  const [maxTeams, setMaxTeams] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (existingCodes.includes(code.trim().toUpperCase())) {
      setError(`El código "${code}" ya existe en otro grupo.`)
      return
    }
    setSubmitting(true)
    try {
      await onSubmit(name.trim(), code.trim().toUpperCase(), maxTeams ? parseInt(maxTeams) : null)
    } catch {
      setError('No se pudo crear el grupo.')
      setSubmitting(false)
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <form onSubmit={submit} className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200">
            <h2 className="text-base font-bold text-slate-900">Nuevo grupo</h2>
          </div>
          <div className="px-5 py-4 space-y-3">
            <Field label="Nombre">
              <input autoFocus className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Grupo A" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Código" hint="Letra o sigla corta">
                <input className={clsx(inputCls, 'uppercase font-bold')} maxLength={5} value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />
              </Field>
              <Field label="Máx. equipos" hint="Opcional">
                <input type="number" min={2} className={inputCls} value={maxTeams} onChange={(e) => setMaxTeams(e.target.value)} placeholder="—" />
              </Field>
            </div>
            {error && (
              <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
                <AlertCircle size={12} /> {error}
              </div>
            )}
          </div>
          <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-slate-200 bg-slate-50">
            <button type="button" onClick={onClose} disabled={submitting}
              className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-lg transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={submitting}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-green-600 text-white text-xs font-bold rounded-lg hover:bg-green-700 disabled:opacity-60 transition-colors">
              {submitting ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
              Crear
            </button>
          </div>
        </form>
      </div>
    </>
  )
}

// ─── Assign teams dialog ──────────────────────────────────────────────────────

function AssignTeamsDialog({
  group, unassigned, onClose, onAssign,
}: {
  group: GroupFromApi
  unassigned: RegistrationFromApi[]
  onClose: () => void
  onAssign: (regIds: string[]) => Promise<void>
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [submitting, setSubmitting] = useState(false)

  function toggle(id: string) {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelected(next)
  }

  async function submit() {
    if (selected.size === 0) return
    setSubmitting(true)
    try {
      await onAssign([...selected])
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200">
            <h2 className="text-base font-bold text-slate-900">Asignar a {group.name}</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {unassigned.length === 0
                ? 'No hay equipos sin grupo'
                : `Selecciona los equipos que entrarán en este grupo`}
            </p>
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-2">
            {unassigned.length === 0 ? (
              <p className="text-center text-xs text-slate-400 py-8">
                Todos los equipos aprobados ya están en algún grupo.
              </p>
            ) : (
              unassigned.map((reg) => (
                <label
                  key={reg.id}
                  className={clsx(
                    'flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors',
                    selected.has(reg.id) ? 'bg-green-50' : 'hover:bg-slate-50',
                  )}
                >
                  <input type="checkbox" className="w-4 h-4 accent-green-600" checked={selected.has(reg.id)} onChange={() => toggle(reg.id)} />
                  {reg.team.logoUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={reg.team.logoUrl} alt="" className="w-7 h-7 rounded-md object-cover border border-slate-200 flex-shrink-0" />
                  ) : (
                    <div
                      className="w-7 h-7 rounded-md border border-slate-200 flex items-center justify-center flex-shrink-0"
                      style={reg.team.primaryColor ? { background: `${reg.team.primaryColor}18` } : undefined}
                    >
                      <Shield size={11} style={{ color: reg.team.primaryColor ?? '#94a3b8' }} />
                    </div>
                  )}
                  <span className="text-sm font-semibold text-slate-800 flex-1 truncate">{reg.team.name}</span>
                  {reg.seedRank != null && (
                    <span className="text-[9px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded px-1 py-0.5">
                      Seed {reg.seedRank}
                    </span>
                  )}
                </label>
              ))
            )}
          </div>
          <div className="flex items-center justify-between gap-2 px-5 py-3 border-t border-slate-200 bg-slate-50">
            <p className="text-xs text-slate-500">{selected.size} seleccionado{selected.size === 1 ? '' : 's'}</p>
            <div className="flex items-center gap-2">
              <button onClick={onClose} disabled={submitting}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-lg transition-colors">
                Cancelar
              </button>
              <button
                onClick={submit}
                disabled={submitting || selected.size === 0}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-green-600 text-white text-xs font-bold rounded-lg hover:bg-green-700 disabled:opacity-60 transition-colors"
              >
                {submitting ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                Asignar
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
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
