'use client'

import { useEffect, useState } from 'react'
import {
  AlertCircle, Loader2, Plus, Pencil, Trash2, X, Save, UserCheck, BadgeCheck, Phone,
} from 'lucide-react'
import {
  getReferees,
  createReferee,
  updateReferee,
  deleteReferee,
  type RefereeFromApi,
} from '@/lib/referees'
import { useActiveOrganization } from '@/contexts/ActiveOrganizationContext'
import { Field, inputCls } from '@/components/ui/form'

type Mode = { kind: 'create' } | { kind: 'edit'; referee: RefereeFromApi }

export function RefereesManager() {
  const { activeOrg } = useActiveOrganization()
  const [referees, setReferees] = useState<RefereeFromApi[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<Mode | null>(null)

  async function reload(orgId: string) {
    const r = await getReferees(orgId)
    setReferees(r)
  }

  useEffect(() => {
    if (!activeOrg) { setError('No hay organización configurada.'); setLoading(false); return }
    reload(activeOrg.id)
      .catch(() => setError('No se pudieron cargar los árbitros.'))
      .finally(() => setLoading(false))
  }, [activeOrg?.id])

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar este árbitro? Los partidos pasados no se modifican.')) return
    try {
      await deleteReferee(id)
      setReferees((prev) => prev.filter((r) => r.id !== id))
    } catch (err) {
      setError(extractError(err) ?? 'No se pudo eliminar.')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-3 py-32 text-slate-400">
        <Loader2 size={22} className="animate-spin" />
        <span className="text-sm">Cargando árbitros...</span>
      </div>
    )
  }

  if (error && !activeOrg) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
        <AlertCircle size={16} /> {error}
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Árbitros</h1>
          <p className="text-sm text-slate-500 mt-1">
            {referees.length} {referees.length === 1 ? 'árbitro registrado' : 'árbitros registrados'}.
          </p>
        </div>
        <button
          onClick={() => setMode({ kind: 'create' })}
          className="flex items-center gap-2 px-4 py-2.5 bg-green-600 text-white text-sm font-bold rounded-xl hover:bg-green-700 transition-all shadow-sm"
        >
          <Plus size={15} /> Nuevo árbitro
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600 mb-4">
          <AlertCircle size={12} /> {error}
        </div>
      )}

      {referees.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-20 bg-white rounded-2xl border-2 border-dashed border-slate-200">
          <UserCheck size={28} className="text-slate-300" />
          <p className="text-sm font-semibold text-slate-500">No hay árbitros registrados</p>
          <button
            onClick={() => setMode({ kind: 'create' })}
            className="text-sm font-semibold text-green-700 hover:underline"
          >
            Crear el primero
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest px-4 py-3">Nombre</th>
                <th className="text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest px-4 py-3 w-40">Licencia</th>
                <th className="text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest px-4 py-3 w-40">Teléfono</th>
                <th className="text-right text-[10px] font-bold text-slate-500 uppercase tracking-widest px-4 py-3 w-24">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {referees.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-4 py-3">
                    <p className="text-sm font-semibold text-slate-900">{r.fullName}</p>
                    {r.uid && <p className="text-[10px] text-slate-400 font-mono">{r.uid.slice(0, 12)}...</p>}
                  </td>
                  <td className="px-4 py-3">
                    {r.licenseNumber ? (
                      <span className="inline-flex items-center gap-1 text-xs font-mono text-slate-700">
                        <BadgeCheck size={11} className="text-slate-400" />
                        {r.licenseNumber}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {r.phone ? (
                      <a
                        href={`tel:${r.phone}`}
                        className="inline-flex items-center gap-1 text-xs font-mono text-slate-700 hover:text-green-700 transition-colors"
                      >
                        <Phone size={11} className="text-slate-400" />
                        {r.phone}
                      </a>
                    ) : (
                      <span className="text-xs text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-1">
                      <button
                        onClick={() => setMode({ kind: 'edit', referee: r })}
                        className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={() => handleDelete(r.id)}
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

      {mode && activeOrg && (
        <RefereeDrawer
          mode={mode}
          orgId={activeOrg.id}
          onClose={() => setMode(null)}
          onSaved={async () => {
            await reload(activeOrg.id)
            setMode(null)
          }}
        />
      )}
    </div>
  )
}

// ─── Drawer ───────────────────────────────────────────────────────────────────

function RefereeDrawer({
  mode, orgId, onClose, onSaved,
}: {
  mode: Mode
  orgId: string
  onClose: () => void
  onSaved: () => void
}) {
  const editing = mode.kind === 'edit' ? mode.referee : null
  const [fullName, setFullName] = useState(editing?.fullName ?? '')
  const [phone, setPhone] = useState(editing?.phone ?? '')
  const [licenseNumber, setLicenseNumber] = useState(editing?.licenseNumber ?? '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (fullName.trim().length < 2) { setError('Nombre muy corto.'); return }
    setSubmitting(true)
    setError(null)
    try {
      const payload = {
        fullName: fullName.trim(),
        phone: phone.trim() || undefined,
        licenseNumber: licenseNumber.trim() || undefined,
      }
      if (editing) await updateReferee(editing.id, payload)
      else await createReferee({ organizationId: orgId, ...payload })
      onSaved()
    } catch (err) {
      setError(extractError(err) ?? 'No se pudo guardar.')
      setSubmitting(false)
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={submitting ? undefined : onClose} />
      <aside className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl z-50 flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h2 className="text-base font-bold text-slate-900">
            {editing ? 'Editar árbitro' : 'Nuevo árbitro'}
          </h2>
          <button onClick={onClose} disabled={submitting} className="text-slate-400 hover:text-slate-700 transition-colors disabled:opacity-50">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={submit} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <Field label="Nombre completo">
            <input autoFocus className={inputCls} value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Carlos Pérez Gómez" />
          </Field>
          <Field label="N° de licencia" hint="Opcional">
            <input className={inputCls} value={licenseNumber} onChange={(e) => setLicenseNumber(e.target.value)} placeholder="ABC-12345" />
          </Field>
          <Field label="Teléfono" hint="Opcional">
            <input type="tel" className={inputCls} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="3124035940" />
          </Field>

          {error && (
            <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
              <AlertCircle size={12} /> {error}
            </div>
          )}
        </form>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-slate-200 bg-slate-50">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={submit as unknown as () => void}
            disabled={submitting}
            className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white text-xs font-bold rounded-lg hover:bg-green-700 disabled:opacity-60 transition-colors"
          >
            {submitting ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
            {editing ? 'Guardar' : 'Crear árbitro'}
          </button>
        </div>
      </aside>
    </>
  )
}

function extractError(err: unknown): string | null {
  if (typeof err !== 'object' || err === null) return null
  const maybeAxios = err as { response?: { data?: { message?: string | string[] } } }
  const msg = maybeAxios.response?.data?.message
  if (!msg) return null
  return Array.isArray(msg) ? msg[0] ?? null : msg
}
