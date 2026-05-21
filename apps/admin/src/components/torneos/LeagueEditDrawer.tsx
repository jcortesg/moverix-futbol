'use client'

import { useEffect, useRef, useState } from 'react'
import { X, Upload, Loader2, Image as ImageIcon } from 'lucide-react'
import { clsx } from 'clsx'
import {
  updateLeague,
  uploadLeagueLogo,
  uploadLeagueBanner,
  type LeagueFromApi,
} from '@/lib/leagues'

const SPORT_FORMATS = ['F5', 'F8', 'F11'] as const
const GENDERS = [
  { value: 'M', label: 'Masculino' },
  { value: 'F', label: 'Femenino' },
  { value: 'Mixed', label: 'Mixto' },
] as const

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

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
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
        onChange={handleChange}
      />
    </div>
  )
}

type Props = {
  league: LeagueFromApi
  onClose: () => void
  onSaved: (updated: LeagueFromApi) => void
}

export function LeagueEditDrawer({ league, onClose, onSaved }: Props) {
  const [name, setName] = useState(league.name)
  const [sportFormat, setSportFormat] = useState(league.sportFormat)
  const [gender, setGender] = useState(league.gender)
  const [description, setDescription] = useState(league.description ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [current, setCurrent] = useState(league)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  async function handleSave() {
    if (!name.trim()) return
    setSaving(true)
    setError(null)
    try {
      const updated = await updateLeague(league.id, { name, sportFormat, gender, description: description || undefined })
      setCurrent(updated)
      onSaved(updated)
    } catch {
      setError('No se pudo guardar. Intenta de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  async function handleLogoUpload(file: File) {
    const updated = await uploadLeagueLogo(current.id, file)
    setCurrent(updated)
    onSaved(updated)
  }

  async function handleBannerUpload(file: File) {
    const updated = await uploadLeagueBanner(current.id, file)
    setCurrent(updated)
    onSaved(updated)
  }

  const inputCls = 'w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-green-500 focus:bg-white focus:ring-2 focus:ring-green-500/20'

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 w-full max-w-md bg-white shadow-2xl z-50 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-base font-bold text-slate-900">Editar liga</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* Banner + Logo */}
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Imágenes</p>
            <ImageUploader
              label="Banner"
              hint="Imagen de portada de la liga. Recomendado 1200×300 px."
              value={current.bannerUrl}
              aspect="banner"
              onUpload={handleBannerUpload}
            />
            <div className="mt-3">
              <ImageUploader
                label="Logo"
                hint="Logo cuadrado. Recomendado 200×200 px."
                value={current.logoUrl}
                aspect="square"
                onUpload={handleLogoUpload}
              />
            </div>
          </div>

          {/* Información */}
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Información</p>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Nombre de la liga</label>
                <input
                  className={inputCls}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Liga CASB"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Formato</label>
                <div className="flex gap-2">
                  {SPORT_FORMATS.map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setSportFormat(f)}
                      className={clsx(
                        'flex-1 py-2 rounded-lg border text-sm font-semibold transition-all',
                        sportFormat === f
                          ? 'border-green-600 bg-green-600 text-white'
                          : 'border-slate-200 text-slate-600 hover:border-slate-300',
                      )}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Género</label>
                <div className="flex gap-2">
                  {GENDERS.map(({ value, label }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setGender(value)}
                      className={clsx(
                        'flex-1 py-2 rounded-lg border text-sm font-semibold transition-all',
                        gender === value
                          ? 'border-green-600 bg-green-600 text-white'
                          : 'border-slate-200 text-slate-600 hover:border-slate-300',
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Descripción (opcional)</label>
                <textarea
                  className={clsx(inputCls, 'resize-none')}
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe la liga, sus reglas o alcance..."
                />
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
            disabled={saving || !name.trim()}
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
