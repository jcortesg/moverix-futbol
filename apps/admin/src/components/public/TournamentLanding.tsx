'use client'

import { useEffect, useState } from 'react'
import {
  Trophy, Calendar, Users, MapPin, FileText,
  Loader2, AlertTriangle, Shield, Clock, Ruler, UserPlus,
  ChevronDown,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { getPublicEdition, type PublicEditionData } from '@/lib/public-api'
import { MyTournamentView } from './MyTournamentView'
import { InlineAuth } from './InlineAuth'

/* ── Labels ──────────────────────────────────────────────── */

const STATUS_LABELS: Record<string, { label: string; dot: string }> = {
  draft: { label: 'Proximamente', dot: 'bg-slate-400' },
  registration: { label: 'Inscripciones abiertas', dot: 'bg-green-400' },
  active: { label: 'En curso', dot: 'bg-blue-400' },
  finished: { label: 'Finalizado', dot: 'bg-slate-500' },
}

const SPORT_FORMAT: Record<string, string> = { F5: 'Futbol 5', F8: 'Futbol 8', F11: 'Futbol 11' }
const GENDER: Record<string, string> = { M: 'Masculino', F: 'Femenino', Mixed: 'Mixto' }

function fmtCurrency(n: number, c: string) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: c, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n)
}
function fmtDate(d: string | null) {
  if (!d) return null
  return new Date(d).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })
}

/* ── Main ────────────────────────────────────────────────── */

export function TournamentLanding({ slug }: { slug: string }) {
  const { user, loading: authLoading } = useAuth()
  const [data, setData] = useState<PublicEditionData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showRegister, setShowRegister] = useState(false)

  useEffect(() => {
    if (authLoading) return
    ;(async () => {
      try {
        const token = user ? await user.getIdToken() : undefined
        setData(await getPublicEdition(slug, token))
      } catch { setError('Torneo no encontrado') }
      finally { setLoading(false) }
    })()
  }, [slug, user, authLoading])

  if (loading) return <Dark><Loader2 size={32} className="animate-spin text-green-400 mx-auto mt-40" /></Dark>
  if (error || !data) return (
    <Dark>
      <div className="flex flex-col items-center justify-center min-h-screen px-4">
        <AlertTriangle size={48} className="text-white/20 mb-4" />
        <h1 className="text-xl font-bold text-white mb-2">Torneo no encontrado</h1>
        <p className="text-sm text-white/40">La pagina que buscas no existe.</p>
      </div>
    </Dark>
  )

  // Authenticated → full app dashboard
  if (user) return <MyTournamentView edition={data} slug={slug} />

  const st = STATUS_LABELS[data.status] || STATUS_LABELS.draft

  return (
    <Dark>
      {/* Auth modal */}
      {showRegister && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowRegister(false)} />
          <div className="relative max-w-md w-full">
            <button onClick={() => setShowRegister(false)} className="absolute -top-10 right-0 text-white/50 hover:text-white text-sm">
              Cerrar
            </button>
            <InlineAuth
              title={`Unete a ${data.name}`}
              subtitle="Inicia sesion o crea una cuenta para inscribir tu equipo"
            />
          </div>
        </div>
      )}
      {/* ── Navbar ─────────────────────────────────────────── */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-black/60 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {data.organization.logoUrl ? (
              <img src={data.organization.logoUrl} alt="" className="h-8 w-8 rounded-lg object-cover" />
            ) : data.logoUrl ? (
              <img src={data.logoUrl} alt="" className="h-8 w-8 rounded-lg object-cover" />
            ) : null}
            <span className="text-sm font-bold text-white hidden sm:block">{data.organization.name}</span>
          </div>
          <div className="hidden md:flex items-center gap-6 text-xs font-medium text-white/50">
            <a href="#formato" className="hover:text-white transition-colors">Formato</a>
            {data.prizePool > 0 && <a href="#premios" className="hover:text-white transition-colors">Premios</a>}
            {data.venues.length > 0 && <a href="#sedes" className="hover:text-white transition-colors">Sedes</a>}
            <a href="#inscripcion" className="hover:text-white transition-colors">Inscripcion</a>
          </div>
          {data.status === 'registration' && (
            <button onClick={() => setShowRegister(true)} className="px-4 py-1.5 bg-green-500 text-black text-xs font-bold rounded-lg hover:bg-green-400 transition-colors">
              INSCRIBIR EQUIPO
            </button>
          )}
        </div>
      </nav>

      {/* ── Hero ───────────────────────────────────────────── */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-14">
        {data.bannerUrl ? (
          <img src={data.bannerUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-black via-slate-900 to-green-950" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-black/40" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(0,0,0,0.6)_100%)]" />

        <div className="relative z-10 max-w-4xl mx-auto px-4 text-center py-20">
          {data.logoUrl && (
            <img src={data.logoUrl} alt={data.name} className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-cover mx-auto mb-6 shadow-2xl border-2 border-white/10" />
          )}

          <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 backdrop-blur-sm border border-white/10 rounded-full mb-6">
            <span className={`w-2 h-2 rounded-full ${st.dot} animate-pulse`} />
            <span className="text-xs font-semibold text-white/80 uppercase tracking-wider">{st.label}</span>
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-7xl font-black text-white leading-[0.95] tracking-tight mb-6">
            {data.name}
          </h1>

          <p className="text-white/50 text-sm sm:text-base max-w-xl mx-auto mb-8 leading-relaxed">
            {data.publicDescription
              ? data.publicDescription.split('\n')[0]
              : `${SPORT_FORMAT[data.league.sportFormat] || data.league.sportFormat} ${GENDER[data.league.gender] || ''} · ${data.organization.name}`
            }
          </p>

          {/* Quick Stats */}
          <div className="flex flex-wrap justify-center gap-4 sm:gap-6 mb-10">
            <QuickStat value={String(data.maxTeams)} label="Equipos" />
            {data.prizePool > 0 && <QuickStat value={fmtCurrency(data.prizePool, data.currency)} label="En premios" />}
            <QuickStat value={SPORT_FORMAT[data.league.sportFormat] || data.league.sportFormat} label="Formato" />
            {data.registrationFee > 0 && <QuickStat value={fmtCurrency(data.registrationFee, data.currency)} label="Inscripcion" />}
          </div>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            {data.status === 'registration' && (
              <button
                onClick={() => setShowRegister(true)}
                className="px-8 py-3.5 bg-green-500 text-black font-bold rounded-xl hover:bg-green-400 transition-all hover:scale-105 text-sm shadow-lg shadow-green-500/25 flex items-center gap-2"
              >
                <UserPlus size={18} />
                INSCRIBIR MI EQUIPO
              </button>
            )}
            <a href="#formato" className="px-8 py-3.5 border border-white/20 text-white font-semibold rounded-xl hover:bg-white/5 transition-colors text-sm flex items-center gap-2">
              VER FORMATO
              <ChevronDown size={16} />
            </a>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
          <ChevronDown size={24} className="text-white/30" />
        </div>
      </section>

      {/* ── About ──────────────────────────────────────────── */}
      {data.publicDescription && (
        <section className="py-20 px-4">
          <div className="max-w-3xl mx-auto">
            <SectionEyebrow>Sobre el torneo</SectionEyebrow>
            <p className="text-white/70 text-base sm:text-lg leading-relaxed whitespace-pre-line">
              {data.publicDescription}
            </p>
          </div>
        </section>
      )}

      {/* ── Format ─────────────────────────────────────────── */}
      <section id="formato" className="py-20 px-4 scroll-mt-16">
        <div className="max-w-5xl mx-auto">
          <SectionEyebrow>Formato</SectionEyebrow>
          <h2 className="text-3xl sm:text-4xl font-black text-white mb-10">
            {SPORT_FORMAT[data.league.sportFormat] || data.league.sportFormat} {GENDER[data.league.gender] || ''}
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <GlassCard icon={Shield} title="Formato" desc={SPORT_FORMAT[data.league.sportFormat] || data.league.sportFormat} />
            <GlassCard icon={Users} title="Cupo maximo" desc={`${data.maxTeams} equipos`} />
            <GlassCard icon={Ruler} title="Genero" desc={GENDER[data.league.gender] || data.league.gender} />
            {data.startDate && <GlassCard icon={Calendar} title="Inicio" desc={fmtDate(data.startDate)!} />}
            {data.endDate && <GlassCard icon={Clock} title="Finalizacion" desc={fmtDate(data.endDate)!} />}
            {data.organization.city && <GlassCard icon={MapPin} title="Ciudad" desc={data.organization.city} />}
          </div>

          {data.rulesUrl && (
            <a href={data.rulesUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 mt-8 text-green-400 hover:text-green-300 text-sm font-medium transition-colors">
              <FileText size={16} /> Ver reglamento completo
            </a>
          )}
        </div>
      </section>

      {/* ── Prizes ─────────────────────────────────────────── */}
      {data.prizePool > 0 && (
        <section id="premios" className="py-20 px-4 scroll-mt-16">
          <div className="max-w-4xl mx-auto text-center">
            <SectionEyebrow>Premiacion</SectionEyebrow>
            <div className="inline-flex items-center gap-3 mb-4">
              <Trophy size={32} className="text-yellow-400" />
              <h2 className="text-3xl sm:text-5xl font-black text-white">
                {fmtCurrency(data.prizePool, data.currency)}
              </h2>
            </div>
            <p className="text-white/40 text-sm mb-10">en premios totales</p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl mx-auto">
              <PrizeCard place="1er lugar" icon="🥇" accent="from-yellow-500/20 to-yellow-600/5 border-yellow-500/20" />
              <PrizeCard place="2do lugar" icon="🥈" accent="from-slate-300/10 to-slate-400/5 border-slate-400/20" />
              <PrizeCard place="3er lugar" icon="🥉" accent="from-amber-700/10 to-amber-800/5 border-amber-700/20" />
            </div>
          </div>
        </section>
      )}

      {/* ── Venues ─────────────────────────────────────────── */}
      {data.venues.length > 0 && (
        <section id="sedes" className="py-20 px-4 scroll-mt-16">
          <div className="max-w-5xl mx-auto">
            <SectionEyebrow>Sedes</SectionEyebrow>
            <h2 className="text-3xl sm:text-4xl font-black text-white mb-10">
              Donde se juega
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {data.venues.map((v) => (
                <div key={v.id} className="group bg-white/[0.03] border border-white/[0.06] rounded-2xl overflow-hidden hover:border-white/10 transition-colors">
                  {v.photoUrl ? (
                    <img src={v.photoUrl} alt={v.name} className="w-full h-40 object-cover group-hover:scale-105 transition-transform duration-500" />
                  ) : (
                    <div className="w-full h-40 bg-white/[0.03] flex items-center justify-center">
                      <MapPin size={32} className="text-white/10" />
                    </div>
                  )}
                  <div className="p-4">
                    <h3 className="text-sm font-bold text-white mb-1">{v.name}</h3>
                    {v.address && <p className="text-xs text-white/40">{v.address}</p>}
                    {v.city && <p className="text-xs text-white/30 mt-0.5">{v.city}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Registration ───────────────────────────────────── */}
      {data.status === 'registration' && (
        <section id="inscripcion" className="py-20 px-4 scroll-mt-16">
          <div className="max-w-lg mx-auto">
            <div className="bg-gradient-to-b from-green-500/10 to-transparent border border-green-500/20 rounded-3xl p-8 text-center">
              <div className="w-16 h-16 rounded-2xl bg-green-500/10 flex items-center justify-center mx-auto mb-5">
                <Trophy size={28} className="text-green-400" />
              </div>
              <h2 className="text-2xl font-black text-white mb-2">Reserva tu cupo</h2>
              {data.registrationFee > 0 ? (
                <div className="mb-6">
                  <p className="text-3xl font-black text-green-400">{fmtCurrency(data.registrationFee, data.currency)}</p>
                  <p className="text-xs text-white/40 mt-1">por equipo</p>
                </div>
              ) : (
                <p className="text-white/40 text-sm mb-6">Inscripcion gratuita</p>
              )}
              <button
                onClick={() => setShowRegister(true)}
                className="w-full py-3.5 bg-green-500 text-black font-bold rounded-xl hover:bg-green-400 transition-all text-sm shadow-lg shadow-green-500/20"
              >
                INSCRIBIR MI EQUIPO
              </button>
              <p className="text-xs text-white/30 mt-4">
                {data.teamsCount} de {data.maxTeams} equipos inscritos
              </p>
            </div>
          </div>
        </section>
      )}


      {/* ── Final CTA ──────────────────────────────────────── */}
      {data.status === 'registration' && (
        <section className="py-24 px-4 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-t from-green-950/30 to-transparent" />
          <div className="relative z-10 max-w-2xl mx-auto text-center">
            <h2 className="text-3xl sm:text-5xl font-black text-white mb-4">
              No te quedes fuera
            </h2>
            <p className="text-white/40 text-sm sm:text-base mb-8 max-w-md mx-auto">
              Cupos limitados. Inscribe tu equipo y vive la experiencia.
            </p>
            <button
              onClick={() => setShowRegister(true)}
              className="px-10 py-4 bg-green-500 text-black font-bold rounded-xl hover:bg-green-400 transition-all hover:scale-105 text-sm shadow-lg shadow-green-500/25 inline-flex items-center gap-2"
            >
              <UserPlus size={18} />
              INSCRIBIR MI EQUIPO
            </button>
          </div>
        </section>
      )}

      {/* ── Footer ─────────────────────────────────────────── */}
      <footer className="border-t border-white/5 py-10 px-4">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {data.organization.logoUrl && <img src={data.organization.logoUrl} alt="" className="w-8 h-8 rounded-lg object-cover" />}
            <div>
              <p className="text-sm font-bold text-white/80">{data.organization.name}</p>
              {data.organization.city && <p className="text-xs text-white/30">{data.organization.city}</p>}
            </div>
          </div>
          <p className="text-xs text-white/20">
            Gestionado con <span className="font-semibold text-white/30">Moverix</span>
          </p>
        </div>
      </footer>
    </Dark>
  )
}

/* ── Shared Components ───────────────────────────────────── */

function Dark({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-[#070707] text-white">{children}</div>
}

function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-green-400 text-xs font-bold uppercase tracking-[0.2em] mb-3">{children}</p>
  )
}

function QuickStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="bg-white/5 border border-white/[0.06] rounded-xl px-5 py-3 text-center min-w-[120px]">
      <p className="text-lg sm:text-xl font-black text-white">{value}</p>
      <p className="text-[10px] text-white/40 uppercase tracking-wider mt-0.5">{label}</p>
    </div>
  )
}

function GlassCard({ icon: Icon, title, desc }: { icon: React.ElementType; title: string; desc: string }) {
  return (
    <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5 hover:border-white/10 transition-colors">
      <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center mb-3">
        <Icon size={18} className="text-green-400" />
      </div>
      <h3 className="text-xs font-bold text-white/50 uppercase tracking-wider mb-1">{title}</h3>
      <p className="text-sm font-semibold text-white">{desc}</p>
    </div>
  )
}

function PrizeCard({ place, icon, accent }: { place: string; icon: string; accent: string }) {
  return (
    <div className={`bg-gradient-to-b ${accent} border rounded-2xl p-5 text-center`}>
      <span className="text-3xl">{icon}</span>
      <p className="text-sm font-bold text-white mt-2">{place}</p>
    </div>
  )
}
