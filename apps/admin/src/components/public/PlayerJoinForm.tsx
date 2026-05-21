'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Loader2, AlertCircle, CheckCircle2, Users, Shield, Trophy,
  User, Phone, Mail, Hash, MapPin, ClipboardList,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import {
  getPublicTeam,
  joinAndRegister,
  type PublicTeamData,
  type JoinAndRegisterDto,
} from '@/lib/public-api'
import { inputCls } from '@/components/ui/form'
import { InlineAuth } from './InlineAuth'

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

function RosterPanel({ roster }: { roster: PublicTeamData['roster'] }) {
  if (roster.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 text-center">
        <ClipboardList size={28} className="mx-auto mb-2 text-slate-300" />
        <p className="text-sm text-slate-500">Aun no hay jugadores inscritos en el torneo</p>
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
          {roster.length}
        </span>
      </div>
      <div className="divide-y divide-slate-50">
        {roster.map((p, i) => (
          <div key={i} className="flex items-center gap-3 px-5 py-3">
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

export function PlayerJoinForm({
  teamSlug,
  editionSlug,
  accessCode,
}: {
  teamSlug: string
  editionSlug?: string
  accessCode?: string
}) {
  const { user, loading: authLoading, getToken } = useAuth()
  const router = useRouter()

  const [team, setTeam] = useState<PublicTeamData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Form state
  const [playerName, setPlayerName] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [docNumber, setDocNumber] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [position, setPosition] = useState('')
  const [jerseyNumber, setJerseyNumber] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    getPublicTeam(teamSlug, editionSlug)
      .then(setTeam)
      .catch(() => setError('Equipo no encontrado'))
      .finally(() => setLoading(false))
  }, [teamSlug, editionSlug])

  // Pre-fill from Firebase user
  useEffect(() => {
    if (user?.email && !email) setEmail(user.email)
    if (user?.displayName && !playerName) setPlayerName(user.displayName)
  }, [user])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 size={32} className="animate-spin text-green-500" />
      </div>
    )
  }

  if (error || !team) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-slate-50">
        <AlertCircle size={48} className="text-slate-300 mb-4" />
        <h1 className="text-xl font-bold text-slate-700 mb-2">Equipo no encontrado</h1>
        <p className="text-sm text-slate-400">El enlace de invitacion no es valido.</p>
      </div>
    )
  }

  if (success) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="max-w-lg mx-auto px-4 py-16 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center">
            <CheckCircle2 size={48} className="mx-auto mb-4 text-green-500" />
            <h1 className="text-2xl font-bold text-slate-900 mb-2">Te uniste a {team.name}</h1>
            {team.edition && (
              <p className="text-slate-500 text-sm mb-6">
                Estas registrado en {team.edition.name} ({team.edition.season})
              </p>
            )}
            <p className="text-slate-400 text-sm mb-8">
              Descarga la app Moverix Football para ver tus estadisticas, partidos y mas.
            </p>
            {editionSlug && (
              <button
                onClick={() => router.push(`/t/${editionSlug}`)}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 transition-colors text-sm"
              >
                Ver torneo
              </button>
            )}
          </div>
          <RosterPanel roster={team.roster} />
        </div>
      </div>
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!playerName.trim()) {
      setSubmitError('El nombre es obligatorio')
      return
    }
    if (!accessCode) {
      setSubmitError('Falta el codigo de acceso en el enlace')
      return
    }

    setSubmitting(true)
    setSubmitError('')

    try {
      const token = await getToken()
      if (!token) {
        setSubmitError('Debes iniciar sesion')
        return
      }

      const dto: JoinAndRegisterDto = {
        teamSlug,
        accessCode,
        editionSlug,
        playerName: playerName.trim(),
        firstName: firstName.trim() || undefined,
        lastName: lastName.trim() || undefined,
        docNumber: docNumber.trim() || undefined,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        position: position || undefined,
        jerseyNumber: jerseyNumber ? parseInt(jerseyNumber) : undefined,
      }

      await joinAndRegister(dto, token)
      setSuccess(true)
    } catch (err: any) {
      setSubmitError(err?.response?.data?.message || 'Error al unirte al equipo')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Team header */}
      <header className="bg-gradient-to-br from-slate-900 via-slate-800 to-green-900">
        <div className="max-w-lg mx-auto px-4 py-10">
          <div className="flex items-center gap-4">
            {team.logoUrl ? (
              <img
                src={team.logoUrl}
                alt={team.name}
                className="w-16 h-16 rounded-2xl object-cover border-2 border-white/20"
              />
            ) : (
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center text-white text-lg font-bold border-2 border-white/20"
                style={{ backgroundColor: team.primaryColor || '#64748b' }}
              >
                {team.shortName?.slice(0, 2) || team.name.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div>
              <h1 className="text-xl font-bold text-white">{team.name}</h1>
              {team.city && (
                <p className="text-white/50 text-sm flex items-center gap-1">
                  <MapPin size={12} /> {team.city}
                </p>
              )}
            </div>
          </div>

          {team.edition && (
            <div className="mt-4 flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/10 rounded-xl px-4 py-3">
              <Trophy size={16} className="text-green-400 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-white">{team.edition.name}</p>
                <p className="text-xs text-white/50">
                  {team.edition.season} · {team.edition.organization.name}
                </p>
              </div>
            </div>
          )}

          {/* Members count */}
          <div className="mt-4 flex items-center gap-2 text-white/60 text-sm">
            <Users size={14} />
            <span>{team.members.length} miembros</span>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-lg mx-auto px-4 -mt-4 relative z-10 pb-16">

        {authLoading ? (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center">
            <Loader2 size={24} className="mx-auto animate-spin text-green-500" />
          </div>
        ) : !user ? (
          <InlineAuth title={`Unete a ${team.name}`} />
        ) : (
          /* Join form */
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
              <h2 className="text-lg font-bold text-slate-900 mb-1">Tus datos</h2>
              <p className="text-sm text-slate-400 mb-5">
                Completa tu informacion para unirte al equipo
              </p>

              {submitError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 flex items-start gap-2">
                  <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                  {submitError}
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    <User size={14} className="inline mr-1" />
                    Nombre completo *
                  </label>
                  <input
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                    placeholder="Nombre como aparece en la planilla"
                    className={inputCls}
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Nombres</label>
                    <input
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Apellidos</label>
                    <input
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className={inputCls}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">
                      <Hash size={12} className="inline mr-1" />
                      Cedula (CC)
                    </label>
                    <input
                      value={docNumber}
                      onChange={(e) => setDocNumber(e.target.value)}
                      placeholder="1234567890"
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">
                      <Phone size={12} className="inline mr-1" />
                      Telefono
                    </label>
                    <input
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="300 123 4567"
                      className={inputCls}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">
                    <Mail size={12} className="inline mr-1" />
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="correo@ejemplo.com"
                    className={inputCls}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">
                      <Shield size={12} className="inline mr-1" />
                      Posicion
                    </label>
                    <select
                      value={position}
                      onChange={(e) => setPosition(e.target.value)}
                      className={inputCls + ' appearance-none'}
                    >
                      {POSITIONS.map((p) => (
                        <option key={p.value} value={p.value}>{p.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">
                      Dorsal
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={99}
                      value={jerseyNumber}
                      onChange={(e) => setJerseyNumber(e.target.value)}
                      placeholder="10"
                      className={inputCls}
                    />
                  </div>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 text-sm shadow-lg shadow-green-600/20"
            >
              {submitting ? <Loader2 size={18} className="animate-spin" /> : <Users size={18} />}
              Unirme al equipo
            </button>

            <RosterPanel roster={team.roster} />
          </form>
        )}
      </div>

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
