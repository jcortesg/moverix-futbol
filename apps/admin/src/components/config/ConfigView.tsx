'use client'

import { useEffect, useRef, useState } from 'react'
import {
  Settings, Building2, Upload, Save, Loader2,
  CheckCircle2, AlertCircle, User, MapPin,
} from 'lucide-react'
import {
  getMyOrganization,
  updateOrganization,
  uploadOrganizationLogo,
  type OrganizationFromApi,
} from '@/lib/leagues'
import { useAuth } from '@/contexts/AuthContext'
import { SectionCard, Field, inputCls } from '@/components/ui/form'

export function ConfigView() {
  const { user } = useAuth()
  const [org, setOrg] = useState<OrganizationFromApi | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const [name, setName] = useState('')
  const [city, setCity] = useState('')
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const logoRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    getMyOrganization()
      .then((o) => {
        if (o) {
          setOrg(o)
          setName(o.name)
          setCity(o.city ?? '')
          setLogoPreview(o.logoUrl)
        }
      })
      .catch(() => setError('No se pudo cargar la organizacion'))
      .finally(() => setLoading(false))
  }, [])

  async function handleSave() {
    if (!org) return
    setSaving(true)
    setError('')
    setSaved(false)
    try {
      const updated = await updateOrganization(org.id, { name, city: city || undefined })
      setOrg(updated)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch {
      setError('No se pudo guardar. Intenta de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  async function handleLogo(file: File) {
    if (!org) return
    setLogoPreview(URL.createObjectURL(file))
    setUploadingLogo(true)
    try {
      const updated = await uploadOrganizationLogo(org.id, file)
      setOrg(updated)
      setLogoPreview(updated.logoUrl)
    } catch {
      setError('Error al subir el logo')
    } finally {
      setUploadingLogo(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-3 py-32 text-slate-400">
        <Loader2 size={22} className="animate-spin" />
        <span className="text-sm">Cargando configuracion...</span>
      </div>
    )
  }

  if (!org) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
        <AlertCircle size={16} /> No se encontro la organizacion
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Settings size={20} />
            Configuracion
          </h1>
          <p className="text-sm text-slate-400 mt-1">Administra tu organizacion y cuenta</p>
        </div>
        <div className="flex items-center gap-3">
          {saved && (
            <span className="flex items-center gap-1.5 text-xs font-semibold text-green-600 bg-green-50 border border-green-200 rounded-full px-3 py-1">
              <CheckCircle2 size={12} /> Guardado
            </span>
          )}
          {error && (
            <span className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-full px-3 py-1">
              {error}
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-bold rounded-xl hover:bg-green-700 disabled:opacity-60 transition-all shadow-sm"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Guardar
          </button>
        </div>
      </div>

      <SectionCard icon={Building2} color="bg-blue-500" title="Organizacion" description="Datos de tu organizacion de torneos">
        <div className="flex items-start gap-6">
          <div className="flex-shrink-0">
            <div
              className="relative w-20 h-20 rounded-2xl border-2 border-slate-200 overflow-hidden bg-slate-100 cursor-pointer group"
              onClick={() => logoRef.current?.click()}
            >
              {logoPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoPreview} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Building2 size={28} className="text-slate-300" />
                </div>
              )}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                {uploadingLogo ? (
                  <Loader2 size={16} className="animate-spin text-white" />
                ) : (
                  <Upload size={16} className="text-white" />
                )}
              </div>
            </div>
            <input
              ref={logoRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleLogo(f) }}
            />
            <p className="text-[10px] text-slate-400 text-center mt-1.5">Logo</p>
          </div>
          <div className="flex-1 space-y-4">
            <Field label="Nombre de la organizacion">
              <input
                className={inputCls}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Club Atletico..."
              />
            </Field>
            <Field label="Ciudad">
              <div className="relative">
                <MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  className={inputCls + ' pl-9'}
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Bogota"
                />
              </div>
            </Field>
            <div className="flex items-center gap-3 pt-1">
              <div className="px-3 py-1.5 bg-slate-50 rounded-lg border border-slate-200">
                <p className="text-[10px] text-slate-400 uppercase tracking-wide">Slug</p>
                <p className="text-xs font-mono text-slate-600">{org.slug}</p>
              </div>
              <div className="px-3 py-1.5 bg-slate-50 rounded-lg border border-slate-200">
                <p className="text-[10px] text-slate-400 uppercase tracking-wide">Creada</p>
                <p className="text-xs text-slate-600">
                  {new Date(org.createdAt).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              </div>
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard icon={User} color="bg-green-600" title="Cuenta" description="Informacion de tu cuenta de usuario">
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
            <span className="text-sm text-slate-500">Email</span>
            <span className="text-sm font-semibold text-slate-800">{user?.email ?? '—'}</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
            <span className="text-sm text-slate-500">Nombre</span>
            <span className="text-sm font-semibold text-slate-800">{user?.displayName ?? '—'}</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
            <span className="text-sm text-slate-500">UID</span>
            <span className="text-xs font-mono text-slate-500">{user?.uid ?? '—'}</span>
          </div>
        </div>
      </SectionCard>
    </div>
  )
}
