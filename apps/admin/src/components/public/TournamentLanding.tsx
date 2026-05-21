'use client'

import { useEffect, useState } from 'react'
import {
  Trophy, Calendar, Users, DollarSign, MapPin, FileText,
  Loader2, AlertTriangle, Shield, Clock, Ruler,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { getPublicEdition, type PublicEditionData } from '@/lib/public-api'
import { TeamGrid } from './TeamGrid'
import { RegistrationCTA } from './RegistrationCTA'

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  draft: { label: 'Proximamente', color: '#64748b', bg: 'rgba(100,116,139,0.1)' },
  registration: { label: 'Inscripciones abiertas', color: '#16a34a', bg: 'rgba(22,163,74,0.1)' },
  active: { label: 'En curso', color: '#2563eb', bg: 'rgba(37,99,235,0.1)' },
  finished: { label: 'Finalizado', color: '#94a3b8', bg: 'rgba(148,163,184,0.1)' },
}

const SPORT_FORMAT_LABELS: Record<string, string> = {
  F5: 'Futbol 5',
  F8: 'Futbol 8',
  F11: 'Futbol 11',
}

const GENDER_LABELS: Record<string, string> = {
  M: 'Masculino',
  F: 'Femenino',
  Mixed: 'Mixto',
}

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return null
  return new Date(dateStr).toLocaleDateString('es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function formatDateShort(dateStr: string | null) {
  if (!dateStr) return null
  return new Date(dateStr).toLocaleDateString('es-CO', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function TournamentLanding({ slug }: { slug: string }) {
  const { user, loading: authLoading } = useAuth()
  const [data, setData] = useState<PublicEditionData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (authLoading) return
    const fetchData = async () => {
      try {
        const token = user ? await user.getIdToken() : undefined
        const edition = await getPublicEdition(slug, token)
        setData(edition)
      } catch {
        setError('Torneo no encontrado')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [slug, user, authLoading])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 size={32} className="animate-spin text-green-500" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-slate-50">
        <AlertTriangle size={48} className="text-slate-300 mb-4" />
        <h1 className="text-xl font-bold text-slate-700 mb-2">Torneo no encontrado</h1>
        <p className="text-sm text-slate-400">La pagina que buscas no existe o no esta disponible.</p>
      </div>
    )
  }

  const statusInfo = STATUS_LABELS[data.status] || STATUS_LABELS.draft
  const startDate = formatDate(data.startDate)
  const startDateShort = formatDateShort(data.startDate)
  const endDate = formatDate(data.endDate)
  const registeredTeamIds = data.teams.map((t) => t.id)
  const city = data.organization.city
  const venueNames = data.venues?.map((v) => v.name) || []

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Hero */}
      <header className="relative overflow-hidden">
        {data.bannerUrl ? (
          <img
            src={data.bannerUrl}
            alt={data.name}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-green-900" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/50 to-black/30" />

        <div className="relative z-10 max-w-4xl mx-auto px-4 py-16 sm:py-24">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
            {data.logoUrl && (
              <img
                src={data.logoUrl}
                alt={data.name}
                className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl object-cover shadow-2xl border-2 border-white/20 flex-shrink-0"
              />
            )}

            <div className="text-center sm:text-left flex-1">
              <div
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold mb-3"
                style={{ backgroundColor: statusInfo.bg, color: statusInfo.color }}
              >
                <span
                  className="inline-block w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: statusInfo.color }}
                />
                {statusInfo.label}
              </div>

              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-2 drop-shadow-lg">
                {data.name}
              </h1>

              <p className="text-white/60 text-sm sm:text-base mb-4">
                {data.organization.name}
              </p>

              {/* Key info pills on hero */}
              <div className="flex flex-wrap justify-center sm:justify-start gap-2 mt-2">
                {startDateShort && (
                  <span className="inline-flex items-center gap-1.5 bg-white/10 backdrop-blur-sm border border-white/10 text-white/80 text-xs px-3 py-1.5 rounded-full">
                    <Calendar size={12} />
                    {startDateShort}
                  </span>
                )}
                {city && (
                  <span className="inline-flex items-center gap-1.5 bg-white/10 backdrop-blur-sm border border-white/10 text-white/80 text-xs px-3 py-1.5 rounded-full">
                    <MapPin size={12} />
                    {city}
                  </span>
                )}
                <span className="inline-flex items-center gap-1.5 bg-white/10 backdrop-blur-sm border border-white/10 text-white/80 text-xs px-3 py-1.5 rounded-full">
                  <Shield size={12} />
                  {SPORT_FORMAT_LABELS[data.league.sportFormat] || data.league.sportFormat}
                </span>
              </div>
            </div>

            {/* Prize badge */}
            {data.prizePool > 0 && (
              <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl px-5 py-4 text-center flex-shrink-0">
                <Trophy size={20} className="mx-auto mb-1 text-yellow-400" />
                <p className="text-[10px] text-white/50 uppercase tracking-wider">Premio</p>
                <p className="text-xl sm:text-2xl font-bold text-green-400">
                  {formatCurrency(data.prizePool, data.currency)}
                </p>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="max-w-4xl mx-auto px-4 -mt-6 relative z-20">

        {/* Tournament details card */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-100">

            {/* Left: Info */}
            <div className="p-6 space-y-5">
              <h2 className="text-lg font-bold text-slate-900">Informacion del torneo</h2>

              <div className="space-y-3">
                {startDate && (
                  <DetailRow icon={Calendar} label="Fecha de inicio" value={startDate} />
                )}
                {endDate && (
                  <DetailRow icon={Clock} label="Fecha de finalizacion" value={endDate} />
                )}
                <DetailRow
                  icon={Shield}
                  label="Formato"
                  value={SPORT_FORMAT_LABELS[data.league.sportFormat] || data.league.sportFormat}
                />
                <DetailRow
                  icon={Users}
                  label="Genero"
                  value={GENDER_LABELS[data.league.gender] || data.league.gender}
                />
                <DetailRow
                  icon={Ruler}
                  label="Cupo maximo"
                  value={`${data.maxTeams} equipos`}
                />
                {data.registrationFee > 0 && (
                  <DetailRow
                    icon={DollarSign}
                    label="Inscripcion"
                    value={formatCurrency(data.registrationFee, data.currency)}
                  />
                )}
                {city && (
                  <DetailRow icon={MapPin} label="Ciudad" value={city} />
                )}
              </div>

              {data.rulesUrl && (
                <a
                  href={data.rulesUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm font-medium text-green-600 hover:text-green-700 hover:underline mt-2"
                >
                  <FileText size={16} />
                  Ver reglamento del torneo
                </a>
              )}
            </div>

            {/* Right: Description + Venues */}
            <div className="p-6 space-y-5">
              {data.publicDescription && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">
                    Descripcion
                  </h3>
                  <p className="text-slate-700 text-sm leading-relaxed whitespace-pre-line">
                    {data.publicDescription}
                  </p>
                </div>
              )}

              {venueNames.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">
                    Donde se juega
                  </h3>
                  <div className="space-y-2">
                    {data.venues.map((venue) => (
                      <div
                        key={venue.id}
                        className="flex items-start gap-3 bg-slate-50 rounded-xl p-3"
                      >
                        {venue.photoUrl ? (
                          <img
                            src={venue.photoUrl}
                            alt={venue.name}
                            className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-lg bg-slate-200 flex items-center justify-center flex-shrink-0">
                            <MapPin size={18} className="text-slate-400" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-800">{venue.name}</p>
                          {venue.address && (
                            <p className="text-xs text-slate-500 truncate">{venue.address}</p>
                          )}
                          {venue.city && (
                            <p className="text-xs text-slate-400">{venue.city}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!data.publicDescription && venueNames.length === 0 && (
                <div className="flex items-center justify-center h-full">
                  <p className="text-sm text-slate-400 italic">
                    El organizador no ha agregado descripcion aun.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Teams gallery */}
        <TeamGrid teams={data.teams} />

        {/* Registration CTA */}
        <RegistrationCTA
          editionId={data.id}
          slug={slug}
          status={data.status}
          registeredTeamIds={registeredTeamIds}
        />
      </div>

      {/* Footer */}
      <footer className="py-10 px-4 mt-6">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-xs text-slate-400">
            Gestionado con <span className="font-semibold text-slate-500">Moverix</span>
          </p>
        </div>
      </footer>
    </div>
  )
}

function DetailRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType
  label: string
  value: string
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Icon size={16} className="text-green-600" />
      </div>
      <div>
        <p className="text-xs text-slate-400">{label}</p>
        <p className="text-sm font-medium text-slate-800">{value}</p>
      </div>
    </div>
  )
}
