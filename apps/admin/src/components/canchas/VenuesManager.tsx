'use client'

import { useEffect, useRef, useState } from 'react'
import {
  AlertCircle, Loader2, Plus, MapPin, Pencil, Trash2, X, Save, Upload, Building2,
} from 'lucide-react'
import {
  getVenues,
  createVenue,
  updateVenue,
  deleteVenue,
  uploadVenuePhoto,
  type VenueFromApi,
} from '@/lib/venues'
import { getMyOrganization, type OrganizationFromApi } from '@/lib/leagues'
import { resizeImage } from '@/lib/image'
import { Field, inputCls } from '@/components/ui/form'

type Mode = { kind: 'create' } | { kind: 'edit'; venue: VenueFromApi }

export function VenuesManager() {
  const [org, setOrg] = useState<OrganizationFromApi | null>(null)
  const [venues, setVenues] = useState<VenueFromApi[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<Mode | null>(null)

  async function reload(orgId: string) {
    const v = await getVenues(orgId)
    setVenues(v)
  }

  useEffect(() => {
    getMyOrganization()
      .then(async (o) => {
        if (!o) {
          setError('No hay organización configurada.')
          return
        }
        setOrg(o)
        await reload(o.id)
      })
      .catch(() => setError('No se pudieron cargar las canchas.'))
      .finally(() => setLoading(false))
  }, [])

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar esta cancha? No afectará partidos ya jugados.')) return
    try {
      await deleteVenue(id)
      setVenues((prev) => prev.filter((v) => v.id !== id))
    } catch (err) {
      setError(extractError(err) ?? 'No se pudo eliminar.')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-3 py-32 text-slate-400">
        <Loader2 size={22} className="animate-spin" />
        <span className="text-sm">Cargando canchas...</span>
      </div>
    )
  }

  if (error && !org) {
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
          <h1 className="text-2xl font-bold text-slate-900">Canchas</h1>
          <p className="text-sm text-slate-500 mt-1">
            Sedes y campos donde se juegan los partidos. {venues.length} {venues.length === 1 ? 'cancha' : 'canchas'}.
          </p>
        </div>
        <button
          onClick={() => setMode({ kind: 'create' })}
          className="flex items-center gap-2 px-4 py-2.5 bg-green-600 text-white text-sm font-bold rounded-xl hover:bg-green-700 transition-all shadow-sm"
        >
          <Plus size={15} /> Nueva cancha
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600 mb-4">
          <AlertCircle size={12} /> {error}
        </div>
      )}

      {venues.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-20 bg-white rounded-2xl border-2 border-dashed border-slate-200">
          <Building2 size={28} className="text-slate-300" />
          <p className="text-sm font-semibold text-slate-500">No hay canchas registradas</p>
          <button
            onClick={() => setMode({ kind: 'create' })}
            className="text-sm font-semibold text-green-700 hover:underline"
          >
            Crear la primera
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {venues.map((v) => (
            <VenueCard
              key={v.id}
              venue={v}
              onEdit={() => setMode({ kind: 'edit', venue: v })}
              onDelete={() => handleDelete(v.id)}
            />
          ))}
        </div>
      )}

      {mode && org && (
        <VenueDrawer
          mode={mode}
          orgId={org.id}
          onClose={() => setMode(null)}
          onSaved={async () => {
            await reload(org.id)
            setMode(null)
          }}
        />
      )}
    </div>
  )
}

// ─── Card ─────────────────────────────────────────────────────────────────────

function VenueCard({
  venue, onEdit, onDelete,
}: {
  venue: VenueFromApi
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="relative h-32 bg-gradient-to-br from-slate-100 to-slate-200">
        {venue.photoUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={venue.photoUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Building2 size={28} className="text-slate-300" />
          </div>
        )}
        {venue.pitchCount > 1 && (
          <span className="absolute top-2 right-2 text-[10px] font-bold uppercase tracking-wide text-indigo-700 bg-white border border-indigo-200 rounded-full px-2 py-0.5 shadow-sm">
            {venue.pitchCount} canchas
          </span>
        )}
      </div>

      <div className="px-4 py-3 flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-slate-900 truncate">{venue.name}</p>
          {venue.address && (
            <p className="text-xs text-slate-500 truncate flex items-center gap-1 mt-0.5">
              <MapPin size={10} className="flex-shrink-0" />
              {venue.address}{venue.city ? `, ${venue.city}` : ''}
            </p>
          )}
          {!venue.address && venue.city && (
            <p className="text-xs text-slate-500 truncate">{venue.city}</p>
          )}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={onEdit}
            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
            title="Editar"
          >
            <Pencil size={13} />
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
            title="Eliminar"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Drawer ───────────────────────────────────────────────────────────────────

function VenueDrawer({
  mode, orgId, onClose, onSaved,
}: {
  mode: Mode
  orgId: string
  onClose: () => void
  onSaved: () => void
}) {
  const editing = mode.kind === 'edit' ? mode.venue : null
  const photoRef = useRef<HTMLInputElement>(null)
  const [name, setName] = useState(editing?.name ?? '')
  const [address, setAddress] = useState(editing?.address ?? '')
  const [city, setCity] = useState(editing?.city ?? '')
  const [pitchCount, setPitchCount] = useState((editing?.pitchCount ?? 1).toString())
  const [lat, setLat] = useState(editing?.lat?.toString() ?? '')
  const [lng, setLng] = useState(editing?.lng?.toString() ?? '')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(editing?.photoUrl ?? null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function pickPhoto(file: File) {
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (name.trim().length < 2) { setError('Nombre muy corto.'); return }
    setSubmitting(true)
    setError(null)
    try {
      const payload = {
        name: name.trim(),
        address: address.trim() || undefined,
        city: city.trim() || undefined,
        pitchCount: parseInt(pitchCount) || 1,
        lat: lat ? parseFloat(lat) : undefined,
        lng: lng ? parseFloat(lng) : undefined,
      }
      const venue = editing
        ? await updateVenue(editing.id, payload)
        : await createVenue({ organizationId: orgId, ...payload })

      if (photoFile) {
        try {
          const resized = await resizeImage(photoFile, { maxSize: 1200, quality: 0.85 })
          await uploadVenuePhoto(venue.id, resized)
        } catch { /* non-fatal */ }
      }
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
            {editing ? 'Editar cancha' : 'Nueva cancha'}
          </h2>
          <button onClick={onClose} disabled={submitting} className="text-slate-400 hover:text-slate-700 transition-colors disabled:opacity-50">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={submit} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Photo */}
          <div className="flex items-center gap-4">
            <div
              onClick={() => photoRef.current?.click()}
              className="relative w-24 h-20 rounded-xl border-2 border-dashed border-slate-200 hover:border-green-400 bg-slate-50 flex items-center justify-center cursor-pointer transition-colors overflow-hidden"
            >
              {photoPreview ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={photoPreview} alt="" className="w-full h-full object-cover" />
              ) : (
                <Building2 size={20} className="text-slate-300" />
              )}
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-slate-700">Foto (opcional)</p>
              <button
                type="button"
                onClick={() => photoRef.current?.click()}
                className="flex items-center gap-1.5 text-xs font-semibold text-green-700 hover:text-green-800 transition-colors mt-0.5"
              >
                <Upload size={11} /> {photoPreview ? 'Cambiar' : 'Subir imagen'}
              </button>
            </div>
            <input
              ref={photoRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) pickPhoto(f) }}
            />
          </div>

          <Field label="Nombre">
            <input autoFocus className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Polideportivo CASB" />
          </Field>

          <Field label="Dirección" hint="Opcional">
            <input className={inputCls} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Calle 100 # 10-20" />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Ciudad">
              <input className={inputCls} value={city} onChange={(e) => setCity(e.target.value)} placeholder="Bogotá" />
            </Field>
            <Field label="N° de canchas" hint="Partidos simultáneos">
              <input
                type="number" min={1} max={20}
                className={inputCls}
                value={pitchCount}
                onChange={(e) => setPitchCount(e.target.value)}
              />
            </Field>
          </div>

          <details className="rounded-xl border border-slate-200 bg-slate-50">
            <summary className="px-4 py-2.5 text-xs font-semibold text-slate-600 cursor-pointer hover:text-slate-900">
              Coordenadas (opcional)
            </summary>
            <div className="px-4 pb-3 grid grid-cols-2 gap-3">
              <Field label="Latitud">
                <input
                  type="number" step="any"
                  className={inputCls}
                  value={lat}
                  onChange={(e) => setLat(e.target.value)}
                  placeholder="4.7110"
                />
              </Field>
              <Field label="Longitud">
                <input
                  type="number" step="any"
                  className={inputCls}
                  value={lng}
                  onChange={(e) => setLng(e.target.value)}
                  placeholder="-74.0721"
                />
              </Field>
            </div>
          </details>

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
            {editing ? 'Guardar' : 'Crear cancha'}
          </button>
        </div>
      </aside>
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

