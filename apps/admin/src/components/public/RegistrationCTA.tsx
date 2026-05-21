'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Plus, CheckCircle2, Loader2, AlertCircle, ChevronDown, Copy, Check,
  Share2, X, Upload, Users, Shield, Hash, Phone, Mail, User,
  ClipboardList, UserPlus,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { getMyTeams, createTeam, uploadTeamLogo, type TeamFromApi } from '@/lib/teams'
import {
  createRegistration,
  getMyRegistrations,
  getRegistrationPlayers,
  createRegistrationPlayer,
  type MyRegistration,
  type RegistrationPlayer,
  type CreateRegistrationPlayerDto,
} from '@/lib/registrations'
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

function RosterPanel({ players }: { players: RegistrationPlayer[] }) {
  if (players.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 text-center">
        <ClipboardList size={28} className="mx-auto mb-2 text-slate-300" />
        <p className="text-sm text-slate-500">Aun no hay jugadores inscritos</p>
        <p className="text-xs text-slate-400 mt-1">Comparte el enlace para que se registren</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <ClipboardList size={16} className="text-green-600" />
          Jugadores inscritos
        </h3>
        <span className="text-xs font-semibold text-green-600 bg-green-50 px-2.5 py-1 rounded-full">
          {players.length}
        </span>
      </div>
      <div className="divide-y divide-slate-50">
        {players.map((p) => (
          <div key={p.id} className="flex items-center gap-3 px-5 py-3">
            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500 flex-shrink-0">
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
            {p.position && (
              <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                {POSITION_SHORT[p.position] || p.position}
              </span>
            )}
          </div>
        ))}
      </div>
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
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [position, setPosition] = useState('')
  const [jerseyNumber, setJerseyNumber] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  function resetForm() {
    setPlayerName('')
    setFirstName('')
    setLastName('')
    setDocNumber('')
    setPhone('')
    setEmail('')
    setPosition('')
    setJerseyNumber('')
    setError('')
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!playerName.trim()) {
      setError('El nombre es obligatorio')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const dto: CreateRegistrationPlayerDto = {
        registrationId,
        playerUid: `manual-${Date.now()}`,
        playerName: playerName.trim(),
        firstName: firstName.trim() || undefined,
        lastName: lastName.trim() || undefined,
        docNumber: docNumber.trim() || undefined,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        position: position || undefined,
        jerseyNumber: jerseyNumber ? parseInt(jerseyNumber) : undefined,
      }
      await createRegistrationPlayer(dto)
      resetForm()
      setOpen(false)
      onAdded()
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
    <form onSubmit={handleAdd} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3">
      <div className="flex items-center justify-between mb-1">
        <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <UserPlus size={14} className="text-green-600" />
          Agregar jugador
        </h4>
        <button type="button" onClick={() => { setOpen(false); resetForm() }} className="text-slate-400 hover:text-slate-600">
          <X size={16} />
        </button>
      </div>

      {error && (
        <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600 flex items-start gap-1.5">
          <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      <div>
        <label className="block text-xs font-medium text-slate-500 mb-1">
          <User size={12} className="inline mr-1" />
          Nombre completo *
        </label>
        <input value={playerName} onChange={(e) => setPlayerName(e.target.value)} placeholder="Como aparece en planilla" className={inputCls} required />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Nombres</label>
          <input value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Apellidos</label>
          <input value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputCls} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">
            <Hash size={12} className="inline mr-1" />
            Cedula
          </label>
          <input value={docNumber} onChange={(e) => setDocNumber(e.target.value)} placeholder="1234567890" className={inputCls} />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">
            <Phone size={12} className="inline mr-1" />
            Telefono
          </label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="300 123 4567" className={inputCls} />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-500 mb-1">
          <Mail size={12} className="inline mr-1" />
          Email
        </label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="correo@ejemplo.com" className={inputCls} />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">
            <Shield size={12} className="inline mr-1" />
            Posicion
          </label>
          <select value={position} onChange={(e) => setPosition(e.target.value)} className={inputCls + ' appearance-none'}>
            {POSITIONS.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Dorsal</label>
          <input type="number" min={1} max={99} value={jerseyNumber} onChange={(e) => setJerseyNumber(e.target.value)} placeholder="10" className={inputCls} />
        </div>
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="w-full py-2.5 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2 text-sm"
      >
        {submitting ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
        Agregar
      </button>
    </form>
  )
}

/* ── My Team Panel (post-registration dashboard) ─────────── */

function MyTeamPanel({
  team,
  registration,
  slug,
}: {
  team: TeamFromApi
  registration: MyRegistration
  slug: string
}) {
  const [players, setPlayers] = useState<RegistrationPlayer[]>([])
  const [loadingPlayers, setLoadingPlayers] = useState(true)
  const [copied, setCopied] = useState(false)
  const inviteUrl = buildInviteUrl(slug, team)

  const fetchPlayers = useCallback(() => {
    getRegistrationPlayers(registration.id)
      .then(setPlayers)
      .catch(() => {})
      .finally(() => setLoadingPlayers(false))
  }, [registration.id])

  useEffect(() => {
    fetchPlayers()
    const interval = setInterval(fetchPlayers, 15000)
    return () => clearInterval(interval)
  }, [fetchPlayers])

  function handleCopyLink() {
    navigator.clipboard.writeText(inviteUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleShareWhatsApp() {
    const text = `Unete a ${team.name} en el torneo! Registrate aqui: ${inviteUrl}`
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
  }

  return (
    <div className="space-y-4">
      {/* Team header */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <div className="flex items-center gap-4 mb-4">
          {team.logoUrl ? (
            <img src={team.logoUrl} alt={team.name} className="w-14 h-14 rounded-xl object-cover border border-slate-200" />
          ) : (
            <div className="w-14 h-14 rounded-xl bg-green-100 flex items-center justify-center text-green-700 text-lg font-bold">
              {team.name.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-bold text-slate-900 truncate">{team.name}</h3>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                <CheckCircle2 size={10} />
                {registration.status === 'approved' ? 'Inscrito' : 'Pendiente de aprobacion'}
              </span>
            </div>
          </div>
        </div>

        {/* Invite link */}
        <div className="bg-slate-50 rounded-xl p-4 space-y-3">
          <div>
            <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Share2 size={14} className="text-green-600" />
              Invita a tus jugadores
            </h4>
            <p className="text-xs text-slate-500 mt-0.5">
              Comparte este enlace para que se registren
            </p>
          </div>

          <div className="flex items-center gap-2">
            <input
              readOnly
              value={inviteUrl}
              className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 outline-none"
              onClick={(e) => (e.target as HTMLInputElement).select()}
            />
            <button
              onClick={handleCopyLink}
              className="flex-shrink-0 px-3 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors flex items-center gap-1.5 text-xs font-medium"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? 'Copiado' : 'Copiar'}
            </button>
          </div>

          <button
            onClick={handleShareWhatsApp}
            className="w-full py-2.5 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 transition-colors flex items-center justify-center gap-2 text-sm"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>
            Compartir por WhatsApp
          </button>
        </div>
      </div>

      {/* Roster */}
      {loadingPlayers ? (
        <div className="text-center py-6">
          <Loader2 size={24} className="mx-auto animate-spin text-green-500" />
        </div>
      ) : (
        <RosterPanel players={players} />
      )}

      {/* Manual add */}
      <AddPlayerForm registrationId={registration.id} onAdded={fetchPlayers} />
    </div>
  )
}

/* ── Create Team Modal ───────────────────────────────────── */

function CreateTeamModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  onCreated: (team: TeamFromApi) => void
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
    setSubmitting(true)
    setError('')
    try {
      let team = await createTeam({
        name: data.name,
        city: data.city || 'Bogota',
      })
      if (logoFile) {
        team = await uploadTeamLogo(team.id, logoFile)
      }
      reset()
      setLogoFile(null)
      setLogoPreview(null)
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
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="px-6 py-5 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 flex items-start gap-2">
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          {/* Logo upload */}
          <div className="flex flex-col items-center gap-3">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="w-20 h-20 rounded-2xl border-2 border-dashed border-slate-200 hover:border-green-400 flex items-center justify-center transition-colors overflow-hidden bg-slate-50"
            >
              {logoPreview ? (
                <img src={logoPreview} alt="Logo" className="w-full h-full object-cover" />
              ) : (
                <Upload size={24} className="text-slate-300" />
              )}
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
            <p className="text-xs text-slate-400">Logo del equipo (opcional)</p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              Nombre del equipo *
            </label>
            <input {...register('name')} placeholder="Ej: Real Bogota FC" className={inputCls} />
            {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Ciudad</label>
            <input {...register('city')} placeholder="Bogota" className={inputCls} />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {submitting ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
            Crear equipo
          </button>
        </form>
      </div>
    </div>
  )
}

/* ── Main Component ──────────────────────────────────────── */

export function RegistrationCTA({
  editionId,
  slug,
  status,
  registeredTeamIds,
}: {
  editionId: string
  slug: string
  status: string
  registeredTeamIds: string[]
}) {
  const { user, loading: authLoading } = useAuth()
  const [myTeams, setMyTeams] = useState<TeamFromApi[]>([])
  const [myRegistrations, setMyRegistrations] = useState<MyRegistration[]>([])
  const [loadingTeams, setLoadingTeams] = useState(false)
  const [selectedTeamId, setSelectedTeamId] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Load user's teams and registrations
  useEffect(() => {
    if (!user) return
    setLoadingTeams(true)
    Promise.all([getMyTeams(), getMyRegistrations()])
      .then(([teams, regs]) => {
        setMyTeams(teams)
        setMyRegistrations(regs)
      })
      .catch(() => {})
      .finally(() => setLoadingTeams(false))
  }, [user])

  // Check if user already has a team registered in this edition
  const myRegInEdition = myRegistrations.find((r) => r.editionId === editionId)
  const registeredTeam = myRegInEdition
    ? myTeams.find((t) => t.id === myRegInEdition.teamId) ?? null
    : null

  // Not in registration status
  if (status !== 'registration') {
    const messages: Record<string, string> = {
      draft: 'Las inscripciones aun no estan abiertas',
      active: 'El torneo ya esta en curso',
      finished: 'El torneo ha finalizado',
    }
    return (
      <section className="py-12 px-4 bg-slate-50">
        <div className="max-w-lg mx-auto text-center">
          <AlertCircle size={32} className="mx-auto mb-3 text-slate-400" />
          <p className="text-slate-500 font-medium">{messages[status] || 'Inscripciones cerradas'}</p>
        </div>
      </section>
    )
  }

  if (authLoading) {
    return (
      <section className="py-12 px-4 bg-slate-50">
        <div className="max-w-lg mx-auto text-center">
          <Loader2 size={24} className="mx-auto animate-spin text-green-500" />
        </div>
      </section>
    )
  }

  if (!user) {
    return (
      <section className="py-12 px-4 bg-slate-50">
        <div className="max-w-lg mx-auto">
          <InlineAuth
            title="Inscribe tu equipo"
            subtitle="Inicia sesion o crea una cuenta para inscribir tu equipo"
          />
        </div>
      </section>
    )
  }

  if (loadingTeams) {
    return (
      <section className="py-12 px-4 bg-slate-50">
        <div className="max-w-lg mx-auto text-center py-6">
          <Loader2 size={24} className="mx-auto animate-spin text-green-500" />
        </div>
      </section>
    )
  }

  // Already registered → show My Team dashboard
  if (registeredTeam && myRegInEdition) {
    return (
      <section className="py-8 px-4">
        <div className="max-w-lg mx-auto">
          <h2 className="text-xl font-bold text-slate-900 mb-4 text-center">Mi equipo</h2>
          <MyTeamPanel team={registeredTeam} registration={myRegInEdition} slug={slug} />
        </div>
      </section>
    )
  }

  // Register flow
  const availableTeams = myTeams.filter((t) => !registeredTeamIds.includes(t.id))

  async function handleRegister() {
    if (!selectedTeamId) return
    setSubmitting(true)
    setError('')
    try {
      const reg = await createRegistration({ editionId, teamId: selectedTeamId })
      const team = myTeams.find((t) => t.id === selectedTeamId)!
      setMyRegistrations((prev) => [...prev, {
        id: reg.id,
        editionId: reg.editionId,
        teamId: reg.teamId,
        status: reg.status,
        groupId: reg.groupId,
        createdAt: reg.createdAt,
        team: { id: team.id, name: team.name, logoUrl: team.logoUrl },
      }])
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Error al inscribir el equipo')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleTeamCreated(team: TeamFromApi) {
    setShowModal(false)
    setMyTeams((prev) => [...prev, team])
    // Auto-register the new team
    setSubmitting(true)
    setError('')
    try {
      const reg = await createRegistration({ editionId, teamId: team.id })
      setMyRegistrations((prev) => [...prev, {
        id: reg.id,
        editionId: reg.editionId,
        teamId: reg.teamId,
        status: reg.status,
        groupId: reg.groupId,
        createdAt: reg.createdAt,
        team: { id: team.id, name: team.name, logoUrl: team.logoUrl },
      }])
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Error al inscribir el equipo')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <section className="py-12 px-4 bg-slate-50">
        <div className="max-w-lg mx-auto">
          <h2 className="text-xl font-bold text-slate-900 mb-6 text-center">Inscribe tu equipo</h2>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 flex items-start gap-2">
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            {availableTeams.length > 0 && (
              <>
                <p className="text-sm text-slate-500">Selecciona uno de tus equipos:</p>
                <div className="relative">
                  <select
                    value={selectedTeamId}
                    onChange={(e) => setSelectedTeamId(e.target.value)}
                    className={inputCls + ' appearance-none pr-10'}
                  >
                    <option value="">Seleccionar equipo...</option>
                    {availableTeams.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                  <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
                <button
                  onClick={handleRegister}
                  disabled={!selectedTeamId || submitting}
                  className="w-full py-3 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  {submitting ? <Loader2 size={18} className="animate-spin" /> : <Users size={18} />}
                  Inscribir equipo
                </button>
                <div className="relative">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200" /></div>
                  <div className="relative flex justify-center"><span className="bg-white px-3 text-xs text-slate-400">o</span></div>
                </div>
              </>
            )}

            <button
              onClick={() => setShowModal(true)}
              className="w-full py-3 border border-slate-200 text-slate-700 font-medium rounded-xl hover:bg-slate-50 transition-colors flex items-center justify-center gap-2 text-sm"
            >
              <Plus size={16} />
              {availableTeams.length > 0 ? 'Crear nuevo equipo' : 'Crear equipo e inscribir'}
            </button>

            {availableTeams.length === 0 && myTeams.length > 0 && (
              <p className="text-xs text-slate-400 text-center">
                Todos tus equipos ya estan inscritos en este torneo
              </p>
            )}
          </div>
        </div>
      </section>

      <CreateTeamModal
        open={showModal}
        onClose={() => setShowModal(false)}
        onCreated={handleTeamCreated}
      />
    </>
  )
}
