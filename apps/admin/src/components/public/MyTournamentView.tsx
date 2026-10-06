'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Plus, CheckCircle2, Loader2, AlertCircle, Copy, Check,
  Share2, X, Upload, Users,
  ClipboardList, UserPlus, Trophy, LogOut,
  ChevronDown,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { getMyTeams, createTeam, uploadTeamLogo, type TeamFromApi } from '@/lib/teams'
import {
  createRegistration,
  getMyRegistrations,
  type MyRegistration,
} from '@/lib/registrations'
import {
  type PublicEditionData,
  getDirectorRoster,
  addDirectorPlayer,
  uploadDirectorPlayerDocument,
  type RosterPlayer,
} from '@/lib/public-api'
import { inputCls } from '@/components/ui/form'
import { InlineAuth } from './InlineAuth'

/* ── Constants ───────────────────────────────────────────── */

const POSITIONS = [
  { value: '', label: 'Seleccionar...' },
  { value: 'GK', label: 'Portero' },
  { value: 'CB', label: 'Defensa Central' },
  { value: 'LB', label: 'Lateral Izquierdo' },
  { value: 'RB', label: 'Lateral Derecho' },
  { value: 'CDM', label: 'Mediocampista Defensivo' },
  { value: 'CM', label: 'Mediocampista Central' },
  { value: 'CAM', label: 'Mediocampista Ofensivo' },
  { value: 'LW', label: 'Extremo Izquierdo' },
  { value: 'RW', label: 'Extremo Derecho' },
  { value: 'CF', label: 'Media Punta' },
  { value: 'ST', label: 'Delantero' },
]

const POSITION_SHORT: Record<string, string> = {
  GK: 'POR', CB: 'DFC', LB: 'LI', RB: 'LD', CDM: 'MCD', CM: 'MC',
  CAM: 'MCO', LW: 'EI', RW: 'ED', CF: 'MP', ST: 'DEL',
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  draft: { label: 'Proximamente', color: 'text-slate-500 bg-slate-100' },
  registration: { label: 'Inscripciones abiertas', color: 'text-green-700 bg-green-50' },
  active: { label: 'En curso', color: 'text-blue-700 bg-blue-50' },
  finished: { label: 'Finalizado', color: 'text-slate-500 bg-slate-100' },
}

const newTeamSchema = z.object({
  name: z.string().min(2, 'Minimo 2 caracteres').max(120),
  city: z.string().max(100).optional(),
})
type NewTeamForm = z.infer<typeof newTeamSchema>

/* ── Helpers ─────────────────────────────────────────────── */

function buildInviteUrl(slug: string, team: TeamFromApi) {
  const base = typeof window !== 'undefined' ? window.location.origin : ''
  return `${base}/t/${slug}/equipo/${team.slug}?code=${team.accessCode}`
}

/* ── Roster Panel ────────────────────────────────────────── */

function RosterPanel({ players }: { players: RosterPlayer[] }) {
  if (players.length === 0) {
    return (
      <div className="rounded-xl border border-slate-100 p-8 text-center">
        <ClipboardList size={32} className="mx-auto mb-3 text-slate-200" />
        <p className="text-sm text-slate-500 font-medium">Sin jugadores inscritos</p>
        <p className="text-xs text-slate-400 mt-1">Comparte el enlace de invitacion o agregalos manualmente</p>
      </div>
    )
  }

  return (
    <div className="divide-y divide-slate-100">
      {players.map((p) => (
        <div key={p.id} className="flex items-center gap-3 py-3">
          <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600 flex-shrink-0">
            {p.jerseyNumber ?? '-'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-slate-800 truncate">{p.playerName}</p>
            {(p.firstName || p.lastName) && (
              <p className="text-xs text-slate-400 truncate">
                {[p.firstName, p.lastName].filter(Boolean).join(' ')}
              </p>
            )}
          </div>
          {p.docNumber && (
            <span className="text-xs text-slate-400 hidden sm:block">CC {p.docNumber}</span>
          )}
          {p.position && (
            <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
              {POSITION_SHORT[p.position] || p.position}
            </span>
          )}
        </div>
      ))}
    </div>
  )
}

/* ── Add Player Form ─────────────────────────────────────── */

function AddPlayerForm({
  registrationId,
  onAdded,
}: {
  registrationId: string
  onAdded: () => void
}) {
  const [open, setOpen] = useState(false)
  const [playerName, setPlayerName] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [docNumber, setDocNumber] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [employer, setEmployer] = useState('')
  const [healthProvider, setHealthProvider] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [position, setPosition] = useState('')
  const [jerseyNumber, setJerseyNumber] = useState('')
  const [emergencyName, setEmergencyName] = useState('')
  const [emergencyPhone, setEmergencyPhone] = useState('')
  const [docFile, setDocFile] = useState<File | null>(null)
  const docFileRef = useRef<HTMLInputElement>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  function resetForm() {
    setPlayerName(''); setFirstName(''); setLastName('')
    setDocNumber(''); setBirthDate(''); setEmployer(''); setHealthProvider('')
    setPhone(''); setEmail('')
    setPosition(''); setJerseyNumber('')
    setEmergencyName(''); setEmergencyPhone('')
    setDocFile(null); if (docFileRef.current) docFileRef.current.value = ''
    setError('')
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!playerName.trim()) { setError('El nombre es obligatorio'); return }
    if (!docNumber.trim()) { setError('La cédula es obligatoria'); return }
    if (!docFile) { setError('Debes adjuntar la cédula (imagen o fotocopia)'); return }
    setSubmitting(true); setError('')
    try {
      const created = await addDirectorPlayer({
        registrationId,
        playerName: playerName.trim(),
        firstName: firstName.trim() || undefined,
        lastName: lastName.trim() || undefined,
        docNumber: docNumber.trim(),
        birthDate: birthDate || undefined,
        employer: employer.trim() || undefined,
        healthProvider: healthProvider.trim() || undefined,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        position: position || undefined,
        jerseyNumber: jerseyNumber ? parseInt(jerseyNumber) : undefined,
        emergencyContactName: emergencyName.trim() || undefined,
        emergencyContactPhone: emergencyPhone.trim() || undefined,
      })
      await uploadDirectorPlayerDocument(created.id, docFile)
      resetForm(); setOpen(false); onAdded()
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Error al agregar jugador')
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full py-3 border-2 border-dashed border-slate-200 text-slate-500 font-medium rounded-xl hover:border-green-300 hover:text-green-600 transition-colors flex items-center justify-center gap-2 text-sm"
      >
        <UserPlus size={16} />
        Agregar jugador manualmente
      </button>
    )
  }

  return (
    <div className="border border-slate-200 rounded-xl p-4 space-y-3 bg-slate-50">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <UserPlus size={14} className="text-green-600" />
          Agregar jugador
        </h4>
        <button type="button" onClick={() => { setOpen(false); resetForm() }} className="text-slate-400 hover:text-slate-600">
          <X size={16} />
        </button>
      </div>

      {error && (
        <div className="p-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600 flex items-start gap-1.5">
          <AlertCircle size={14} className="flex-shrink-0 mt-0.5" /> {error}
        </div>
      )}

      <form onSubmit={handleAdd} className="space-y-3">
        <input value={playerName} onChange={(e) => setPlayerName(e.target.value)} placeholder="Nombre completo *" className={inputCls} required />
        <div className="grid grid-cols-2 gap-2">
          <input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Nombres" className={inputCls} />
          <input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Apellidos" className={inputCls} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <input value={docNumber} onChange={(e) => setDocNumber(e.target.value)} placeholder="Cédula *" className={inputCls} required />
          <input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} placeholder="Fecha de nacimiento" className={inputCls} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Telefono" className={inputCls} />
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className={inputCls} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <input value={employer} onChange={(e) => setEmployer(e.target.value)} placeholder="Empresa donde labora" className={inputCls} />
          <input value={healthProvider} onChange={(e) => setHealthProvider(e.target.value)} placeholder="EPS" className={inputCls} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <input value={emergencyName} onChange={(e) => setEmergencyName(e.target.value)} placeholder="Contacto emergencia" className={inputCls} />
          <input type="tel" value={emergencyPhone} onChange={(e) => setEmergencyPhone(e.target.value)} placeholder="Tel. emergencia" className={inputCls} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <select value={position} onChange={(e) => setPosition(e.target.value)} className={inputCls + ' appearance-none'}>
            {POSITIONS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
          <input type="number" min={1} max={99} value={jerseyNumber} onChange={(e) => setJerseyNumber(e.target.value)} placeholder="Dorsal" className={inputCls} />
        </div>
        <div>
          <input
            ref={docFileRef}
            type="file"
            accept="application/pdf,image/jpeg,image/png,image/webp,image/heic"
            onChange={(e) => setDocFile(e.target.files?.[0] ?? null)}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => docFileRef.current?.click()}
            className="w-full py-2.5 border-2 border-dashed border-slate-200 rounded-xl text-sm font-medium text-slate-500 hover:border-green-300 hover:text-green-600 transition-colors flex items-center justify-center gap-2"
          >
            <Upload size={14} />
            {docFile ? docFile.name : 'Adjuntar cédula (imagen o fotocopia) *'}
          </button>
        </div>
        <button type="submit" disabled={submitting} className="w-full py-2.5 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2 text-sm">
          {submitting ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
          Agregar
        </button>
      </form>
    </div>
  )
}

/* ── Create Team Modal ───────────────────────────────────── */

function CreateTeamModal({ open, onClose, onCreated }: {
  open: boolean; onClose: () => void; onCreated: (team: TeamFromApi) => void
}) {
  const { register, handleSubmit, formState: { errors }, reset } = useForm<NewTeamForm>({
    resolver: zodResolver(newTeamSchema),
    defaultValues: { city: 'Bogota' },
  })
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoFile(file)
    const reader = new FileReader()
    reader.onload = () => setLogoPreview(reader.result as string)
    reader.readAsDataURL(file)
  }

  async function onSubmit(data: NewTeamForm) {
    if (!logoFile) { setError('El logo del equipo es obligatorio'); return }
    setSubmitting(true); setError('')
    try {
      let team = await createTeam({ name: data.name, city: data.city || 'Bogota' })
      team = await uploadTeamLogo(team.id, logoFile)
      reset(); setLogoFile(null); setLogoPreview(null)
      onCreated(team)
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Error al crear el equipo')
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-900">Crear equipo</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="px-6 py-5 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 flex items-start gap-2">
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5" /> {error}
            </div>
          )}
          <div className="flex flex-col items-center gap-3">
            <button type="button" onClick={() => fileRef.current?.click()} className="w-20 h-20 rounded-2xl border-2 border-dashed border-slate-200 hover:border-green-400 flex items-center justify-center transition-colors overflow-hidden bg-slate-50">
              {logoPreview ? <img src={logoPreview} alt="Logo" className="w-full h-full object-cover" /> : <Upload size={24} className="text-slate-300" />}
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
            <p className="text-xs text-slate-400">Logo del equipo <span className="text-red-500">*</span></p>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Nombre del equipo *</label>
            <input {...register('name')} placeholder="Ej: Real Bogota FC" className={inputCls} />
            {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Ciudad</label>
            <input {...register('city')} placeholder="Bogota" className={inputCls} />
          </div>
          <button type="submit" disabled={submitting} className="w-full py-3 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
            {submitting ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
            Crear equipo
          </button>
        </form>
      </div>
    </div>
  )
}

/* ── Register Flow (no team yet) ─────────────────────────── */

function RegisterFlow({
  editionId,
  edition,
  myTeams,
  registeredTeamIds,
  onRegistered,
}: {
  editionId: string
  edition: PublicEditionData
  myTeams: TeamFromApi[]
  registeredTeamIds: string[]
  onRegistered: (reg: MyRegistration, team: TeamFromApi) => void
}) {
  const [selectedTeamId, setSelectedTeamId] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const availableTeams = myTeams.filter((t) => !registeredTeamIds.includes(t.id))

  async function doRegister(teamId: string) {
    setSubmitting(true); setError('')
    try {
      const reg = await createRegistration({ editionId, teamId })
      const team = myTeams.find((t) => t.id === teamId)!
      onRegistered({
        id: reg.id, editionId: reg.editionId, teamId: reg.teamId,
        status: reg.status, groupId: reg.groupId, createdAt: reg.createdAt,
        team: { id: team.id, name: team.name, logoUrl: team.logoUrl },
      }, team)
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Error al inscribir el equipo')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleTeamCreated(team: TeamFromApi) {
    setShowModal(false)
    setSubmitting(true); setError('')
    try {
      const reg = await createRegistration({ editionId, teamId: team.id })
      onRegistered({
        id: reg.id, editionId: reg.editionId, teamId: reg.teamId,
        status: reg.status, groupId: reg.groupId, createdAt: reg.createdAt,
        team: { id: team.id, name: team.name, logoUrl: team.logoUrl },
      }, team)
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Error al inscribir el equipo')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <div className="max-w-md mx-auto px-4 py-12 space-y-6">
        <div className="text-center">
          <Users size={40} className="mx-auto mb-3 text-green-500" />
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Inscribe tu equipo</h2>
          <p className="text-sm text-slate-500">
            Registra tu equipo en <span className="font-semibold">{edition.name}</span>
          </p>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 flex items-start gap-2">
            <AlertCircle size={16} className="flex-shrink-0 mt-0.5" /> {error}
          </div>
        )}

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
          {availableTeams.length > 0 && (
            <>
              <p className="text-sm text-slate-500">Selecciona uno de tus equipos:</p>
              <div className="relative">
                <select value={selectedTeamId} onChange={(e) => setSelectedTeamId(e.target.value)} className={inputCls + ' appearance-none pr-10'}>
                  <option value="">Seleccionar equipo...</option>
                  {availableTeams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
              <button onClick={() => doRegister(selectedTeamId)} disabled={!selectedTeamId || submitting} className="w-full py-3 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                {submitting ? <Loader2 size={18} className="animate-spin" /> : <Users size={18} />}
                Inscribir equipo
              </button>
              <div className="relative">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200" /></div>
                <div className="relative flex justify-center"><span className="bg-white px-3 text-xs text-slate-400">o</span></div>
              </div>
            </>
          )}
          <button onClick={() => setShowModal(true)} className="w-full py-3 border border-slate-200 text-slate-700 font-medium rounded-xl hover:bg-slate-50 transition-colors flex items-center justify-center gap-2 text-sm">
            <Plus size={16} />
            {availableTeams.length > 0 ? 'Crear nuevo equipo' : 'Crear equipo e inscribir'}
          </button>
        </div>
      </div>

      <CreateTeamModal open={showModal} onClose={() => setShowModal(false)} onCreated={handleTeamCreated} />
    </>
  )
}

/* ── Team Dashboard (registered) ─────────────────────────── */

function TeamDashboard({ team, registration, slug }: {
  team: TeamFromApi; registration: MyRegistration; slug: string
}) {
  const [players, setPlayers] = useState<RosterPlayer[]>([])
  const [loadingPlayers, setLoadingPlayers] = useState(true)
  const [copied, setCopied] = useState(false)
  const inviteUrl = buildInviteUrl(slug, team)

  const fetchPlayers = useCallback(() => {
    getDirectorRoster(registration.id)
      .then(setPlayers)
      .catch(() => {})
      .finally(() => setLoadingPlayers(false))
  }, [registration.id])

  useEffect(() => {
    fetchPlayers()
    const interval = setInterval(fetchPlayers, 15000)
    return () => clearInterval(interval)
  }, [fetchPlayers])

  function handleCopy() {
    navigator.clipboard.writeText(inviteUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleWhatsApp() {
    const text = `Unete a ${team.name} en el torneo! Registrate aqui: ${inviteUrl}`
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-5">
      {/* Team card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 flex items-center gap-4">
          {team.logoUrl ? (
            <img src={team.logoUrl} alt={team.name} className="w-14 h-14 rounded-xl object-cover border border-slate-200" />
          ) : (
            <div className="w-14 h-14 rounded-xl bg-green-100 flex items-center justify-center text-green-700 text-lg font-bold">
              {team.name.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-slate-900 truncate">{team.name}</h2>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${
              registration.status === 'approved' ? 'text-green-700 bg-green-50' : 'text-amber-700 bg-amber-50'
            }`}>
              <CheckCircle2 size={10} />
              {registration.status === 'approved' ? 'Inscrito' : 'Pendiente de aprobacion'}
            </span>
          </div>
        </div>

        {/* Invite section */}
        <div className="border-t border-slate-100 p-5 space-y-3 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <Share2 size={14} className="text-green-600" />
            <h3 className="text-sm font-bold text-slate-900">Invita jugadores</h3>
          </div>
          <div className="flex items-center gap-2">
            <input readOnly value={inviteUrl} className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 outline-none" onClick={(e) => (e.target as HTMLInputElement).select()} />
            <button onClick={handleCopy} className="flex-shrink-0 px-3 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors flex items-center gap-1.5 text-xs font-medium">
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? 'Copiado' : 'Copiar'}
            </button>
          </div>
          <button onClick={handleWhatsApp} className="w-full py-2.5 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 transition-colors flex items-center justify-center gap-2 text-sm">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            Compartir por WhatsApp
          </button>
        </div>
      </div>

      {/* Roster */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <ClipboardList size={16} className="text-green-600" />
            Plantilla
          </h3>
          <span className="text-xs font-semibold text-green-600 bg-green-50 px-2.5 py-1 rounded-full">
            {loadingPlayers ? '...' : players.length}
          </span>
        </div>
        <div className="px-5 py-3">
          {loadingPlayers ? (
            <div className="text-center py-6"><Loader2 size={24} className="mx-auto animate-spin text-green-500" /></div>
          ) : (
            <RosterPanel players={players} />
          )}
        </div>
        <div className="px-5 pb-5">
          <AddPlayerForm registrationId={registration.id} onAdded={fetchPlayers} />
        </div>
      </div>
    </div>
  )
}

/* ── Main Component ──────────────────────────────────────── */

export function MyTournamentView({
  edition,
  slug,
}: {
  edition: PublicEditionData
  slug: string
}) {
  const { user, loading: authLoading, logout } = useAuth()
  const [myTeams, setMyTeams] = useState<TeamFromApi[]>([])
  const [myRegistrations, setMyRegistrations] = useState<MyRegistration[]>([])
  const [loadingData, setLoadingData] = useState(true)

  const registeredTeamIds = edition.teams.map((t) => t.id)
  const statusInfo = STATUS_LABELS[edition.status] || STATUS_LABELS.draft

  useEffect(() => {
    if (!user || authLoading) return
    setLoadingData(true)
    Promise.all([getMyTeams(), getMyRegistrations()])
      .then(([teams, regs]) => { setMyTeams(teams); setMyRegistrations(regs) })
      .catch(() => {})
      .finally(() => setLoadingData(false))
  }, [user, authLoading])

  const myRegInEdition = myRegistrations.find((r) => r.editionId === edition.id)
  const registeredTeam = myRegInEdition ? myTeams.find((t) => t.id === myRegInEdition.teamId) ?? null : null

  function handleRegistered(reg: MyRegistration, team: TeamFromApi) {
    setMyRegistrations((prev) => [...prev, reg])
    setMyTeams((prev) => {
      if (prev.find((t) => t.id === team.id)) return prev
      return [...prev, team]
    })
  }

  // Not authenticated → show inline auth
  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-green-500" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50">
        <AppHeader edition={edition} statusInfo={statusInfo} />
        <div className="max-w-md mx-auto px-4 py-12">
          <InlineAuth
            title={`Unete a ${edition.name}`}
            subtitle="Inicia sesion para inscribir tu equipo o ver tu informacion"
          />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* App header */}
      <AppHeader edition={edition} statusInfo={statusInfo}>
        <button
          onClick={() => logout()}
          className="text-white/60 hover:text-white transition-colors flex items-center gap-1.5 text-xs"
        >
          <LogOut size={14} />
          Salir
        </button>
      </AppHeader>

      {/* Content */}
      {loadingData ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={28} className="animate-spin text-green-500" />
        </div>
      ) : registeredTeam && myRegInEdition ? (
        <TeamDashboard team={registeredTeam} registration={myRegInEdition} slug={slug} />
      ) : (
        <RegisterFlow
          editionId={edition.id}
          edition={edition}
          myTeams={myTeams}
          registeredTeamIds={registeredTeamIds}
          onRegistered={handleRegistered}
        />
      )}

      {/* Footer */}
      <footer className="py-8 px-4">
        <div className="max-w-lg mx-auto text-center">
          <p className="text-xs text-slate-400">
            Gestionado con <span className="font-semibold text-slate-500">Moverix</span>
          </p>
        </div>
      </footer>
    </div>
  )
}

/* ── App Header ──────────────────────────────────────────── */

function AppHeader({
  edition,
  statusInfo,
  children,
}: {
  edition: PublicEditionData
  statusInfo: { label: string; color: string }
  children?: React.ReactNode
}) {
  return (
    <header className="bg-gradient-to-r from-slate-900 to-slate-800 sticky top-0 z-30">
      <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
        {edition.logoUrl ? (
          <img src={edition.logoUrl} alt={edition.name} className="w-10 h-10 rounded-xl object-cover border border-white/20 flex-shrink-0" />
        ) : (
          <div className="w-10 h-10 rounded-xl bg-green-700 flex items-center justify-center flex-shrink-0">
            <Trophy size={18} className="text-white" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-bold text-white truncate">{edition.name}</h1>
          <p className="text-xs text-white/50">{edition.organization.name}</p>
        </div>
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${statusInfo.color}`}>
          {statusInfo.label}
        </span>
        {children}
      </div>
    </header>
  )
}
