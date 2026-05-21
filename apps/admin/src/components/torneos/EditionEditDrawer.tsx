'use client'

import { useEffect, useRef, useState } from 'react'
import { X, Upload, Loader2, Image as ImageIcon } from 'lucide-react'
import { clsx } from 'clsx'
import {
  updateEdition,
  uploadEditionLogo,
  uploadEditionBanner,
  type EditionFromApi,
  type EditionStatus,
} from '@/lib/leagues'

const STATUSES: { value: EditionStatus; label: string }[] = [
  { value: 'draft', label: 'Borrador' },
  { value: 'registration', label: 'Inscripción' },
  { value: 'active', label: 'En curso' },
  { value: 'finished', label: 'Finalizado' },
]

function ImageUploader({
  label,
  hint,
  value,
  aspect,
  onUpload,
}: {
  label: string
  hint: string
  value: string | null
  aspect: 'square' | 'banner'
  onUpload: (file: File) => Promise<void>
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState<string | null>(value)

  async function handleFile(file: File) {
    setPreview(URL.createObjectURL(file))
    setUploading(true)
    try {
      await onUpload(file)
    } finally {
      setUploading(false)
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file?.type.startsWith('image/')) handleFile(file)
  }

  const isBanner = aspect === 'banner'

  return (
    <div>
      <p className="text-xs font-semibold text-slate-700 mb-1">{label}</p>
      <p className="text-[11px] text-slate-400 mb-2">{hint}</p>
      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => !uploading && inputRef.current?.click()}
        className={clsx(
          'relative overflow-hidden rounded-xl border-2 border-dashed border-slate-200 cursor-pointer',
          'hover:border-slate-300 hover:bg-slate-50 transition-colors group',
          isBanner ? 'h-28 w-full' : 'h-24 w-24',
        )}
      >
        {preview ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt={label} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <Upload size={20} className="text-white" />
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-1 text-slate-400">
            <ImageIcon size={isBanner ? 24 : 20} />
            <span className="text-[10px]">Subir imagen</span>
          </div>
        )}
        {uploading && (
          <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
            <Loader2 size={18} className="animate-spin text-slate-500" />
          </div>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
      />
    </div>
  )
}

type Props = {
  edition: EditionFromApi
  onClose: () => void
  onSaved: (updated: EditionFromApi) => void
}

export function EditionEditDrawer({ edition, onClose, onSaved }: Props) {
  const [current, setCurrent] = useState(edition)
  const [name, setName] = useState(edition.name)
  const [season, setSeason] = useState(edition.season)
  const [status, setStatus] = useState<EditionStatus>(edition.status)
  const [startDate, setStartDate] = useState(edition.startDate?.slice(0, 10) ?? '')
  const [endDate, setEndDate] = useState(edition.endDate?.slice(0, 10) ?? '')
  const [maxTeams, setMaxTeams] = useState(String(edition.maxTeams))
  const [registrationFee, setRegistrationFee] = useState(String(edition.registrationFee))
  const [prizePool, setPrizePool] = useState(String(edition.prizePool))
  const [currency, setCurrency] = useState(edition.currency)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      const updated = await updateEdition(edition.id, {
        name,
        season,
        status,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        maxTeams: parseInt(maxTeams) || 16,
        registrationFee: parseInt(registrationFee) || 0,
        prizePool: parseInt(prizePool) || 0,
        currency,
      })
      setCurrent(updated)
      onSaved(updated)
    } catch {
      setError('No se pudo guardar. Intenta de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  const inputCls = 'w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-green-500 focus:bg-white focus:ring-2 focus:ring-green-500/20'

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />

      <div className="fixed inset-y-0 right-0 w-full max-w-md bg-white shadow-2xl z-50 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-900">Editar edición</h2>
            <p className="text-xs text-slate-400 mt-0.5">{edition.name}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* Imágenes */}
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Imágenes</p>
            <ImageUploader
              label="Banner"
              hint="Imagen de portada de la edición. Recomendado 1200×300 px."
              value={current.bannerUrl}
              aspect="banner"
              onUpload={async (file) => {
                const updated = await uploadEditionBanner(current.id, file)
                setCurrent(updated)
                onSaved(updated)
              }}
            />
            <div className="mt-3">
              <ImageUploader
                label="Logo"
                hint="Logo cuadrado de la edición. Recomendado 200×200 px."
                value={current.logoUrl}
                aspect="square"
                onUpload={async (file) => {
                  const updated = await uploadEditionLogo(current.id, file)
                  setCurrent(updated)
                  onSaved(updated)
                }}
              />
            </div>
          </div>

          {/* Información */}
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Información</p>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Nombre</label>
                <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Código de temporada</label>
                <input className={inputCls} value={season} onChange={(e) => setSeason(e.target.value)} />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Estado</label>
                <div className="grid grid-cols-2 gap-2">
                  {STATUSES.map(({ value, label }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setStatus(value)}
                      className={clsx(
                        'py-2 rounded-lg border text-sm font-semibold transition-all',
                        status === value
                          ? 'border-green-600 bg-green-600 text-white'
                          : 'border-slate-200 text-slate-600 hover:border-slate-300',
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Fechas */}
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Fechas</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Inicio</label>
                <input type="date" className={inputCls} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Fin estimado</label>
                <input type="date" className={inputCls} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
            </div>
          </div>

          {/* Financiero */}
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Equipos y finanzas</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Máx. equipos</label>
                <input type="number" min={2} className={inputCls} value={maxTeams} onChange={(e) => setMaxTeams(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Moneda</label>
                <input className={inputCls} value={currency} maxLength={3} onChange={(e) => setCurrency(e.target.value.toUpperCase())} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Inscripción</label>
                <input type="number" min={0} className={inputCls} value={registrationFee} onChange={(e) => setRegistrationFee(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Premio</label>
                <input type="number" min={0} className={inputCls} value={prizePool} onChange={(e) => setPrizePool(e.target.value)} />
              </div>
            </div>
          </div>

          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-green-600 text-sm font-bold text-white hover:bg-green-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            Guardar cambios
          </button>
        </div>
      </div>
    </>
  )
}
