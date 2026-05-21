'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Trophy, Calendar, Users, MapPin, Shield, Loader2, Search,
} from 'lucide-react'
import { getPublicEditions, type PublicEditionListItem } from '@/lib/public-api'

const STATUS_BADGES: Record<string, { label: string; color: string; bg: string }> = {
  registration: { label: 'Inscripciones abiertas', color: '#16a34a', bg: 'rgba(22,163,74,0.1)' },
  active: { label: 'En curso', color: '#2563eb', bg: 'rgba(37,99,235,0.1)' },
  finished: { label: 'Finalizado', color: '#94a3b8', bg: 'rgba(148,163,184,0.1)' },
  draft: { label: 'Proximamente', color: '#64748b', bg: 'rgba(100,116,139,0.1)' },
}

const SPORT_LABELS: Record<string, string> = {
  F5: 'Futbol 5',
  F8: 'Futbol 8',
  F11: 'Futbol 11',
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return null
  return new Date(dateStr).toLocaleDateString('es-CO', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function formatCurrency(amount: number, currency: string) {
  if (!amount) return null
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function ChampionshipList() {
  const [editions, setEditions] = useState<PublicEditionListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    getPublicEditions()
      .then(setEditions)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const filtered = search.trim()
    ? editions.filter(
        (e) =>
          e.name.toLowerCase().includes(search.toLowerCase()) ||
          e.organization.name.toLowerCase().includes(search.toLowerCase()) ||
          (e.organization.city ?? '').toLowerCase().includes(search.toLowerCase()),
      )
    : editions

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Hero */}
      <header className="bg-gradient-to-br from-slate-900 via-slate-800 to-green-900">
        <div className="max-w-5xl mx-auto px-4 py-12 sm:py-16">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-full px-4 py-1.5 mb-4">
              <Trophy size={14} className="text-green-400" />
              <span className="text-xs font-semibold text-green-400 tracking-wide">MOVERIX FOOTBALL</span>
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-3">
              Campeonatos
            </h1>
            <p className="text-white/50 text-sm sm:text-base max-w-md mx-auto">
              Encuentra torneos de futbol amateur, inscribe tu equipo y compite
            </p>
          </div>

          {/* Search */}
          <div className="max-w-md mx-auto mt-8">
            <div className="relative">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nombre, organizador o ciudad..."
                className="w-full rounded-xl bg-white/10 border border-white/10 backdrop-blur-sm pl-11 pr-4 py-3 text-sm text-white placeholder-white/30 outline-none focus:border-green-500/50 focus:ring-2 focus:ring-green-500/20 transition"
              />
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-4 -mt-6 relative z-10 pb-16">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={32} className="animate-spin text-green-500" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 text-center">
            <Trophy size={40} className="mx-auto mb-3 text-slate-200" />
            <p className="text-slate-500 font-medium">
              {search ? 'No se encontraron campeonatos' : 'No hay campeonatos disponibles'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.map((edition) => {
              const badge = STATUS_BADGES[edition.status] || STATUS_BADGES.draft
              const startDate = formatDate(edition.startDate)
              const prize = formatCurrency(edition.prizePool, edition.currency)

              return (
                <Link
                  key={edition.id}
                  href={`/t/${edition.slug}`}
                  className="group bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-md hover:border-slate-300 transition-all"
                >
                  {/* Banner */}
                  <div className="relative h-32 sm:h-36 overflow-hidden">
                    {edition.bannerUrl ? (
                      <img
                        src={edition.bannerUrl}
                        alt={edition.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-slate-800 to-green-900" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />

                    {/* Status badge */}
                    <div className="absolute top-3 left-3">
                      <span
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold backdrop-blur-sm"
                        style={{ backgroundColor: badge.bg, color: badge.color }}
                      >
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: badge.color }} />
                        {badge.label}
                      </span>
                    </div>

                    {/* Prize */}
                    {prize && (
                      <div className="absolute top-3 right-3 bg-black/40 backdrop-blur-sm rounded-lg px-2.5 py-1">
                        <span className="text-[10px] text-white/60">Premio</span>
                        <p className="text-sm font-bold text-green-400">{prize}</p>
                      </div>
                    )}

                    {/* Logo + Title overlay */}
                    <div className="absolute bottom-3 left-3 right-3 flex items-end gap-3">
                      {edition.logoUrl && (
                        <img
                          src={edition.logoUrl}
                          alt=""
                          className="w-12 h-12 rounded-xl object-cover border border-white/20 flex-shrink-0"
                        />
                      )}
                      <div className="min-w-0">
                        <h2 className="text-base sm:text-lg font-bold text-white leading-tight line-clamp-1 drop-shadow">
                          {edition.name}
                        </h2>
                        <p className="text-xs text-white/60 line-clamp-1">
                          {edition.season} · {edition.organization.name}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Info row */}
                  <div className="px-4 py-3 flex items-center gap-4 text-xs text-slate-500">
                    <span className="inline-flex items-center gap-1">
                      <Shield size={12} className="text-slate-400" />
                      {SPORT_LABELS[edition.league.sportFormat] || edition.league.sportFormat}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Users size={12} className="text-slate-400" />
                      {edition.teamsCount}/{edition.maxTeams}
                    </span>
                    {startDate && (
                      <span className="inline-flex items-center gap-1">
                        <Calendar size={12} className="text-slate-400" />
                        {startDate}
                      </span>
                    )}
                    {edition.organization.city && (
                      <span className="inline-flex items-center gap-1 ml-auto">
                        <MapPin size={12} className="text-slate-400" />
                        {edition.organization.city}
                      </span>
                    )}
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="py-8 px-4 border-t border-slate-100">
        <div className="max-w-5xl mx-auto text-center">
          <p className="text-xs text-slate-400">
            Gestionado con <span className="font-semibold text-slate-500">Moverix</span>
          </p>
        </div>
      </footer>
    </div>
  )
}
