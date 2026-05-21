'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ChevronLeft, Loader2, Save, Upload, Trophy,
  AlertCircle, CheckCircle2, Calendar, Users,
  Settings2, DollarSign, FileText, Clock,
  ArrowUp, ArrowDown, Scale, Globe, Copy, ExternalLink,
} from 'lucide-react'
import { clsx } from 'clsx'
import {
  getEdition,
  updateEdition,
  uploadEditionLogo,
  uploadEditionBanner,
  DEFAULT_TIEBREAKERS,
  TIEBREAKER_LABEL,
  type EditionFromApi,
  type EditionStatus,
  type FormatConfig,
  type FormatType,
  type PhaseGroups,
  type PhaseRoundRobin,
  type PhaseKnockout,
  type PhaseMultiCup,
  type TiebreakerRules,
  type TiebreakerCriterion,
} from '@/lib/leagues'
import { Field, SectionCard, Toggle, inputCls } from '@/components/ui/form'
import {
  STATUSES,
  FORMAT_TYPES,
  PhaseGroupsForm,
  PhaseRoundRobinForm,
  PhaseKnockoutForm,
  PhaseMultiCupForm,
} from './edition-form'

// ─── Tabs metadata ───────────────────────────────────────────────────────────

const TABS = [
  { key: 'general',   label: 'General',    icon: Settings2 },
  { key: 'teams',     label: 'Equipos',    icon: Users },
  { key: 'format',    label: 'Formato',    icon: Trophy },
  { key: 'finances',  label: 'Finanzas',   icon: DollarSign },
  { key: 'documents', label: 'Documentos', icon: FileText },
] as const

type TabKey = typeof TABS[number]['key']

// ─── Hero editor ─────────────────────────────────────────────────────────────

function HeroEditor({
  edition, editionId, onUpdated, editionName, currentStatus, season,
}: {
  edition: EditionFromApi | null
  editionId: string
  onUpdated: (ed: EditionFromApi) => void
  editionName: string
  currentStatus: typeof STATUSES[number] | undefined
  season: string
}) {
  const bannerRef = useRef<HTMLInputElement>(null)
  const logoRef = useRef<HTMLInputElement>(null)
  const [uploadingBanner, setUploadingBanner] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [bannerPreview, setBannerPreview] = useState<string | null>(edition?.bannerUrl ?? null)
  const [logoPreview, setLogoPreview] = useState<string | null>(edition?.logoUrl ?? null)

  async function handleBanner(file: File) {
    setBannerPreview(URL.createObjectURL(file))
    setUploadingBanner(true)
    try { const u = await uploadEditionBanner(editionId, file); onUpdated(u) }
    finally { setUploadingBanner(false) }
  }

  async function handleLogo(file: File) {
    setLogoPreview(URL.createObjectURL(file))
    setUploadingLogo(true)
    try { const u = await uploadEditionLogo(editionId, file); onUpdated(u) }
    finally { setUploadingLogo(false) }
  }

  return (
    <div className="relative -mx-8 mb-6 group/hero">
      <div
        className="relative h-44 bg-gradient-to-br from-slate-800 to-slate-700 overflow-hidden cursor-pointer"
        onClick={() => bannerRef.current?.click()}
      >
        {bannerPreview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={bannerPreview} alt="" className="w-full h-full object-cover" />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
        <div className={clsx(
          'absolute inset-0 flex items-center justify-center transition-opacity',
          bannerPreview ? 'opacity-0 hover:opacity-100' : 'opacity-100',
        )}>
          {uploadingBanner ? (
            <div className="flex flex-col items-center gap-2 text-white">
              <Loader2 size={22} className="animate-spin" />
              <span className="text-xs font-semibold">Subiendo banner...</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 text-white/80 hover:text-white transition-colors">
              <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center">
                <Upload size={18} />
              </div>
              <span className="text-xs font-semibold">{bannerPreview ? 'Cambiar banner' : 'Subir banner'}</span>
              <span className="text-[10px] text-white/50">Recomendado 1200×300 px</span>
            </div>
          )}
        </div>
      </div>

      <div className="absolute bottom-0 left-8 right-8 flex items-end gap-4 pb-5">
        <div
          className="relative w-20 h-20 rounded-2xl border-2 border-white shadow-xl overflow-hidden flex-shrink-0 bg-white cursor-pointer group/logo"
          onClick={(e) => { e.stopPropagation(); logoRef.current?.click() }}
        >
          {logoPreview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoPreview} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-slate-100 flex items-center justify-center">
              <Trophy size={28} className="text-slate-400" />
            </div>
          )}
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover/logo:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1">
            {uploadingLogo
              ? <Loader2 size={16} className="animate-spin text-white" />
              : <Upload size={16} className="text-white" />
            }
            <span className="text-[9px] text-white font-semibold">Logo</span>
          </div>
        </div>

        <div className="flex-1 min-w-0 mb-1">
          <h1 className="text-2xl font-bold text-white leading-tight truncate drop-shadow-sm">
            {editionName || 'Sin nombre'}
          </h1>
          <div className="flex items-center gap-2 mt-1.5">
            {currentStatus && (
              <span className={clsx('inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border', currentStatus.bg, currentStatus.color)}>
                <span className={clsx('w-1.5 h-1.5 rounded-full', currentStatus.dot)} />
                {currentStatus.label}
              </span>
            )}
            {season && <span className="text-white/60 text-xs font-medium">{season}</span>}
          </div>
        </div>
      </div>

      <input ref={bannerRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleBanner(f) }} />
      <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleLogo(f) }} />
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function EditionEditPage({ editionId }: { editionId: string }) {
  const router = useRouter()
  const [edition, setEdition] = useState<EditionFromApi | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<TabKey>('general')

  const [name, setName] = useState('')
  const [season, setSeason] = useState('')
  const [status, setStatus] = useState<EditionStatus>('draft')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [maxTeams, setMaxTeams] = useState('16')
  const [registrationFee, setRegistrationFee] = useState('0')
  const [prizePool, setPrizePool] = useState('0')
  const [currency, setCurrency] = useState('COP')
  const [rulesUrl, setRulesUrl] = useState('')
  const [isPublished, setIsPublished] = useState(false)
  const [publicDescription, setPublicDescription] = useState('')
  const [copiedUrl, setCopiedUrl] = useState(false)
  const [formatConfig, setFormatConfig] = useState<FormatConfig>({})
  const [tiebreakerRules, setTiebreakerRules] = useState<TiebreakerRules>(DEFAULT_TIEBREAKERS)

  useEffect(() => {
    getEdition(editionId)
      .then((ed) => {
        setEdition(ed)
        setName(ed.name)
        setSeason(ed.season)
        setStatus(ed.status)
        setStartDate(ed.startDate?.slice(0, 10) ?? '')
        setEndDate(ed.endDate?.slice(0, 10) ?? '')
        setMaxTeams(String(ed.maxTeams))
        setRegistrationFee(String(ed.registrationFee))
        setPrizePool(String(ed.prizePool))
        setCurrency(ed.currency)
        setRulesUrl(ed.rulesUrl ?? '')
        setIsPublished(ed.isPublished ?? false)
        setPublicDescription(ed.publicDescription ?? '')
        setFormatConfig((ed.formatConfig as FormatConfig) ?? {})
        setTiebreakerRules((ed.tiebreakerRules as TiebreakerRules) ?? DEFAULT_TIEBREAKERS)
      })
      .catch(() => setError('No se pudo cargar la edición.'))
      .finally(() => setLoading(false))
  }, [editionId])

  function patchFormat(patch: Partial<FormatConfig>) {
    setFormatConfig((prev) => ({ ...prev, ...patch }))
  }

  function selectFormatType(type: FormatType) {
    const fmt = FORMAT_TYPES.find((f) => f.value === type)!
    const newConfig: FormatConfig = {
      ...formatConfig,
      type,
      phase1: fmt.phase1 === 'groups'
        ? { kind: 'groups', groupCount: 4, teamsPerGroup: 4, qualifiersPerGroup: 2, doubleLeg: false }
        : fmt.phase1 === 'round_robin'
          ? { kind: 'round_robin', doubleLeg: true }
          : undefined,
      phase2: fmt.phase2 === 'knockout'
        ? { kind: 'knockout', bracketSize: 8, hasThirdPlace: false, hasRepechage: false }
        : fmt.phase2 === 'multi_cup'
          ? { kind: 'multi_cup', cups: [
              { name: 'Copa A', from: 1, to: 16, size: 16 },
              { name: 'Copa B', from: 17, to: 32, size: 16 },
            ] }
          : undefined,
    }
    setFormatConfig(newConfig)
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      const updated = await updateEdition(editionId, {
        name, season, status,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        maxTeams: parseInt(maxTeams) || 16,
        registrationFee: parseInt(registrationFee) || 0,
        prizePool: parseInt(prizePool) || 0,
        currency,
        rulesUrl: rulesUrl || undefined,
        isPublished,
        publicDescription: publicDescription || undefined,
        formatConfig,
        tiebreakerRules,
      })
      setEdition(updated)
      setSaved(true)
      router.push(`/torneos/edicion/${editionId}/gestionar`)
    } catch {
      setError('No se pudo guardar. Intenta de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  const currentStatus = STATUSES.find((s) => s.value === status)
  const selectedFormat = FORMAT_TYPES.find((f) => f.value === formatConfig.type)

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-3 py-32 text-slate-400">
        <Loader2 size={22} className="animate-spin" />
        <span className="text-sm">Cargando edición...</span>
      </div>
    )
  }

  if (error && !edition) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
        <AlertCircle size={16} /> {error}
      </div>
    )
  }

  return (
    <div className="-mx-6 -my-6 px-8 py-6">
      {/* Top bar */}
      <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-sm border-b border-slate-200 -mx-8 px-8 py-3 mb-0 flex items-center gap-3">
        <Link href="/torneos" className="flex items-center gap-1 text-sm text-slate-400 hover:text-slate-700 transition-colors">
          <ChevronLeft size={15} />
          <span>Torneos</span>
        </Link>
        <span className="text-slate-300">/</span>
        <span className="text-sm font-semibold text-slate-900 truncate max-w-xs">{edition?.name}</span>
        <div className="flex-1" />
        {saved && (
          <span className="flex items-center gap-1.5 text-xs font-semibold text-green-600 bg-green-50 border border-green-200 rounded-full px-3 py-1">
            <CheckCircle2 size={12} /> Guardado
          </span>
        )}
        {error && <span className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-full px-3 py-1">{error}</span>}
        {edition?.slug && (
          <a
            href={`/t/${edition.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 border border-slate-200 text-slate-700 text-sm font-semibold rounded-xl hover:bg-slate-50 transition-all"
          >
            <ExternalLink size={14} />
            Ver web publica
          </a>
        )}
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-bold rounded-xl hover:bg-green-700 disabled:opacity-60 transition-all shadow-sm active:scale-[0.98]"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          Guardar
        </button>
      </div>

      {/* Hero */}
      <HeroEditor
        edition={edition}
        editionId={editionId}
        onUpdated={setEdition}
        editionName={name}
        currentStatus={currentStatus}
        season={season}
      />

      {/* Tabs nav */}
      <div className="border-b border-slate-200 mb-6 -mx-2 overflow-x-auto">
        <div className="flex items-center gap-1 px-2">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={clsx(
                'flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap',
                tab === key
                  ? 'border-green-600 text-green-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300',
              )}
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-5 items-start">

        {/* Left: tab content */}
        <div className="flex flex-col gap-5">

          {tab === 'general' && (
            <>
              <SectionCard icon={Settings2} color="bg-blue-500" title="Información general" description="Nombre, temporada y estado">
                <div className="space-y-4">
                  <Field label="Nombre de la edición">
                    <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Temporada 2025 - I" />
                  </Field>
                  <Field label="Código de temporada" hint="Identificador corto usado en reportes y URLs.">
                    <input className={inputCls} value={season} onChange={(e) => setSeason(e.target.value)} placeholder="2025-I" />
                  </Field>
                  <div>
                    <p className="text-sm font-semibold text-slate-700 mb-2">Estado</p>
                    <div className="grid grid-cols-2 gap-2">
                      {STATUSES.map(({ value, label, desc, color, bg, dot }) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setStatus(value)}
                          className={clsx(
                            'flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all',
                            status === value ? `${bg} ring-2 ring-offset-1 ring-green-400` : 'border-slate-200 bg-white hover:border-slate-300',
                          )}
                        >
                          <span className={clsx('w-2.5 h-2.5 rounded-full flex-shrink-0', dot)} />
                          <div>
                            <p className={clsx('text-xs font-bold', status === value ? color : 'text-slate-700')}>{label}</p>
                            <p className="text-[10px] text-slate-400">{desc}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </SectionCard>

              <SectionCard icon={Calendar} color="bg-orange-500" title="Fechas" description="Inscripciones y duración del torneo">
                <div className="space-y-4">
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Período de inscripciones</p>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Apertura">
                        <input type="date" className={inputCls} value={formatConfig.registrationOpen ?? ''} onChange={(e) => patchFormat({ registrationOpen: e.target.value || undefined })} />
                      </Field>
                      <Field label="Cierre">
                        <input type="date" className={inputCls} value={formatConfig.registrationClose ?? ''} onChange={(e) => patchFormat({ registrationClose: e.target.value || undefined })} />
                      </Field>
                    </div>
                  </div>
                  <div className="h-px bg-slate-100" />
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Duración del torneo</p>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Inicio">
                        <input type="date" className={inputCls} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                      </Field>
                      <Field label="Fin estimado">
                        <input type="date" className={inputCls} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                      </Field>
                    </div>
                  </div>
                </div>
              </SectionCard>
            </>
          )}

          {tab === 'teams' && (
            <SectionCard icon={Users} color="bg-green-600" title="Equipos" description="Capacidad de la edición">
              <div className="flex items-end gap-6">
                <div className="max-w-[160px]">
                  <Field label="Máximo de equipos" hint="Mínimo 2 equipos.">
                    <input type="number" min={2} step={2} className={inputCls} value={maxTeams} onChange={(e) => setMaxTeams(e.target.value)} />
                  </Field>
                </div>
                <div className="flex-1 bg-slate-50 rounded-xl border border-slate-200 px-4 py-3 mb-5">
                  <p className="text-xs text-slate-400 mb-1">Capacidad</p>
                  <div className="w-full bg-slate-200 rounded-full h-2">
                    <div className="bg-green-500 h-2 rounded-full" style={{ width: '0%' }} />
                  </div>
                  <p className="text-xs text-slate-500 mt-1.5">0 / {maxTeams} equipos inscritos</p>
                </div>
              </div>
            </SectionCard>
          )}

          {tab === 'format' && (
            <SectionCard icon={Trophy} color="bg-indigo-500" title="Formato de competencia" description="Estructura y modalidad del torneo">
              <div className="space-y-5">
                <div>
                  <p className="text-sm font-semibold text-slate-700 mb-3">Tipo de formato</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {FORMAT_TYPES.map(({ value, label, icon, desc }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => selectFormatType(value)}
                        className={clsx(
                          'flex flex-col items-start gap-1.5 px-4 py-3 rounded-xl border text-left transition-all',
                          formatConfig.type === value
                            ? 'border-indigo-400 bg-indigo-50 ring-2 ring-indigo-300 ring-offset-1'
                            : 'border-slate-200 bg-white hover:border-indigo-200 hover:bg-indigo-50/40',
                        )}
                      >
                        <span className="flex items-center gap-2 text-sm font-bold text-slate-800">
                          <span>{icon}</span> {label}
                        </span>
                        <span className="text-xs text-slate-500 leading-relaxed">{desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {formatConfig.type && selectedFormat?.phase1 === 'groups' && (
                  <PhaseGroupsForm
                    value={(formatConfig.phase1 as PhaseGroups) ?? { kind: 'groups', groupCount: 4, teamsPerGroup: 4, qualifiersPerGroup: 2, doubleLeg: false }}
                    onChange={(p1) => patchFormat({ phase1: p1 })}
                  />
                )}
                {formatConfig.type && selectedFormat?.phase1 === 'round_robin' && (
                  <PhaseRoundRobinForm
                    value={(formatConfig.phase1 as PhaseRoundRobin) ?? { kind: 'round_robin', doubleLeg: true }}
                    onChange={(p1) => patchFormat({ phase1: p1 })}
                  />
                )}
                {formatConfig.type && selectedFormat?.phase2 === 'knockout' && (
                  <PhaseKnockoutForm
                    value={(formatConfig.phase2 as PhaseKnockout) ?? { kind: 'knockout', bracketSize: 8, hasThirdPlace: false, hasRepechage: false }}
                    onChange={(p2) => patchFormat({ phase2: p2 })}
                    label={selectedFormat?.phase1 ? 'Fase 2 — Eliminatoria' : 'Cuadro eliminatorio'}
                  />
                )}
                {formatConfig.type && selectedFormat?.phase2 === 'multi_cup' && (
                  <PhaseMultiCupForm
                    value={(formatConfig.phase2 as PhaseMultiCup) ?? { kind: 'multi_cup', cups: [] }}
                    onChange={(p2) => patchFormat({ phase2: p2 })}
                  />
                )}

                {formatConfig.type && (
                  <>
                    <div className="h-px bg-slate-100" />
                    <div>
                      <p className="text-sm font-semibold text-slate-700 mb-3">Reglas del partido</p>
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <Toggle
                            checked={formatConfig.hasExtraTime ?? false}
                            onChange={(v) => patchFormat({ hasExtraTime: v })}
                            label="Tiempo extra"
                            description="Dos tiempos adicionales si el partido termina en empate."
                          />
                          <Toggle
                            checked={formatConfig.hasPenalties ?? false}
                            onChange={(v) => patchFormat({ hasPenalties: v })}
                            label="Penales"
                            description="Se define con penales si persiste el empate tras el tiempo extra."
                          />
                        </div>
                        <div className="flex items-end gap-4">
                          <div className="w-44">
                            <Field label="Minutos por tiempo">
                              <div className="relative">
                                <input
                                  type="number" min={5} max={60}
                                  className={inputCls}
                                  value={formatConfig.minutesPerHalf ?? ''}
                                  onChange={(e) => patchFormat({ minutesPerHalf: parseInt(e.target.value) || undefined })}
                                  placeholder="25"
                                />
                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">min</span>
                              </div>
                            </Field>
                          </div>
                          {formatConfig.minutesPerHalf ? (
                            <div className="flex items-center gap-2 mb-1 px-4 py-2.5 bg-indigo-50 border border-indigo-200 rounded-xl">
                              <Clock size={14} className="text-indigo-500" />
                              <span className="text-sm font-semibold text-indigo-700">{formatConfig.minutesPerHalf * 2} min totales</span>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {!formatConfig.type && (
                  <p className="text-xs text-slate-400 text-center py-4">Selecciona un tipo de formato para configurar las fases.</p>
                )}
              </div>
            </SectionCard>
          )}

          {tab === 'format' && (
            <SectionCard
              icon={Scale}
              color="bg-amber-500"
              title="Puntuación y desempates"
              description="Cómo se otorgan puntos y cómo se rompen empates en la tabla"
            >
              <TiebreakerEditor value={tiebreakerRules} onChange={setTiebreakerRules} />
            </SectionCard>
          )}

          {tab === 'finances' && (
            <SectionCard icon={DollarSign} color="bg-emerald-500" title="Finanzas" description="Costos e incentivos">
              <div className="grid grid-cols-3 gap-4">
                <Field label="Moneda">
                  <input className={inputCls} value={currency} maxLength={3} onChange={(e) => setCurrency(e.target.value.toUpperCase())} placeholder="COP" />
                </Field>
                <Field label="Inscripción por equipo">
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">{currency}</span>
                    <input type="number" min={0} step={1000} className={clsx(inputCls, 'pl-14')} value={registrationFee} onChange={(e) => setRegistrationFee(e.target.value)} />
                  </div>
                </Field>
                <Field label="Premio total">
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">{currency}</span>
                    <input type="number" min={0} step={10000} className={clsx(inputCls, 'pl-14')} value={prizePool} onChange={(e) => setPrizePool(e.target.value)} />
                  </div>
                </Field>
              </div>
            </SectionCard>
          )}

          {tab === 'documents' && (
            <SectionCard icon={FileText} color="bg-slate-500" title="Documentos" description="Reglamento y recursos">
              <Field label="URL del reglamento" hint="Enlace a Google Drive, Dropbox o cualquier URL pública.">
                <input type="url" className={inputCls} value={rulesUrl} onChange={(e) => setRulesUrl(e.target.value)} placeholder="https://drive.google.com/..." />
              </Field>
            </SectionCard>
          )}

          {/* Bottom save */}
          <div className="flex items-center justify-between py-6 border-t border-slate-200">
            <Link href="/torneos" className="text-sm text-slate-400 hover:text-slate-700 transition-colors">
              ← Volver sin guardar
            </Link>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 bg-green-600 text-white text-sm font-bold rounded-xl hover:bg-green-700 disabled:opacity-60 transition-all shadow-sm active:scale-[0.98]"
            >
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
              Guardar todos los cambios
            </button>
          </div>
        </div>

        {/* Right sidebar */}
        <div className="flex flex-col gap-4 sticky top-20">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3">Estado actual</p>
            <div className={clsx('flex items-center gap-2.5 px-3 py-2.5 rounded-xl border font-semibold text-sm', currentStatus?.bg, currentStatus?.color)}>
              <span className={clsx('w-2 h-2 rounded-full', currentStatus?.dot)} />
              {currentStatus?.label}
            </div>
          </div>

          {formatConfig.type && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3">Formato</p>
              <div className="flex items-start gap-2">
                <span className="text-lg">{selectedFormat?.icon}</span>
                <div>
                  <p className="text-sm font-bold text-slate-800">{selectedFormat?.label}</p>
                  {formatConfig.phase1 && 'groupCount' in formatConfig.phase1 && (
                    <p className="text-xs text-slate-500 mt-0.5">
                      {(formatConfig.phase1 as PhaseGroups).groupCount} grupos · {(formatConfig.phase1 as PhaseGroups).teamsPerGroup} equipos c/u
                    </p>
                  )}
                  {formatConfig.phase2 && 'bracketSize' in formatConfig.phase2 && (
                    <p className="text-xs text-slate-500 mt-0.5">
                      Bracket de {(formatConfig.phase2 as PhaseKnockout).bracketSize} equipos
                    </p>
                  )}
                  {formatConfig.phase2 && 'cups' in formatConfig.phase2 && (
                    <p className="text-xs text-slate-500 mt-0.5">
                      {(formatConfig.phase2 as PhaseMultiCup).cups.length} copas
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3">Resumen</p>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Equipos máx.</span>
                <span className="text-sm font-bold text-slate-900">{maxTeams}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Inscripción</span>
                <span className="text-sm font-bold text-slate-900">
                  {parseInt(registrationFee) > 0 ? `${currency} ${parseInt(registrationFee).toLocaleString()}` : 'Gratis'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Premio</span>
                <span className="text-sm font-bold text-slate-900">
                  {parseInt(prizePool) > 0 ? `${currency} ${parseInt(prizePool).toLocaleString()}` : '—'}
                </span>
              </div>
              {formatConfig.minutesPerHalf ? (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">Duración partido</span>
                  <span className="text-sm font-bold text-slate-900">{formatConfig.minutesPerHalf * 2} min</span>
                </div>
              ) : null}
            </div>
          </div>

          {/* Pagina publica */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-3">
              <Globe size={14} className="text-green-600" />
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Pagina publica</p>
            </div>
            <Toggle
              checked={isPublished}
              onChange={setIsPublished}
              label="Publicar pagina"
              description="Genera un enlace publico para compartir el torneo."
            />
            {isPublished && edition?.slug && (
              <div className="mt-3 space-y-2">
                <div className="flex items-center gap-2 p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-xs text-slate-500 truncate flex-1">
                    {typeof window !== 'undefined' ? window.location.origin : ''}/t/{edition.slug}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/t/${edition.slug}`)
                      setCopiedUrl(true)
                      setTimeout(() => setCopiedUrl(false), 2000)
                    }}
                    className="p-1 rounded hover:bg-slate-200 transition-colors flex-shrink-0"
                    title="Copiar enlace"
                  >
                    {copiedUrl ? <CheckCircle2 size={14} className="text-green-500" /> : <Copy size={14} className="text-slate-400" />}
                  </button>
                  <a
                    href={`/t/${edition.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1 rounded hover:bg-slate-200 transition-colors flex-shrink-0"
                    title="Vista previa"
                  >
                    <ExternalLink size={14} className="text-slate-400" />
                  </a>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-600 mb-1">Descripcion publica</p>
                  <textarea
                    rows={3}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 outline-none transition focus:border-green-500 focus:bg-white focus:ring-2 focus:ring-green-500/20 placeholder:text-slate-400 resize-none"
                    placeholder="Describe tu torneo para los equipos que visiten la pagina..."
                    value={publicDescription}
                    onChange={(e) => setPublicDescription(e.target.value)}
                    maxLength={2000}
                  />
                  <p className="text-[10px] text-slate-400 mt-0.5 text-right">{publicDescription.length}/2000</p>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 py-3 bg-green-600 text-white text-sm font-bold rounded-xl hover:bg-green-700 disabled:opacity-60 transition-all shadow-sm active:scale-[0.98]"
          >
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>

          {saved && (
            <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-green-600">
              <CheckCircle2 size={13} /> Cambios guardados
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Tiebreaker editor ───────────────────────────────────────────────────────

type SecondaryCriterion = Exclude<TiebreakerCriterion, 'points'>
const ALL_CRITERIA: SecondaryCriterion[] = [
  'goalDiff', 'goalsFor', 'goalsAgainst', 'headToHead', 'yellowCards', 'redCards', 'drawLots',
]

function TiebreakerEditor({
  value, onChange,
}: {
  value: TiebreakerRules
  onChange: (v: TiebreakerRules) => void
}) {
  function patch(p: Partial<TiebreakerRules>) {
    onChange({ ...value, ...p })
  }

  // The order excluding the implicit "points" first criterion
  const orderTail = value.order.filter((c): c is SecondaryCriterion => c !== 'points')
  const available = ALL_CRITERIA.filter((c) => !orderTail.includes(c))

  function setOrderTail(tail: SecondaryCriterion[]) {
    patch({ order: ['points', ...tail] })
  }

  function move(idx: number, dir: -1 | 1) {
    const next = [...orderTail]
    const target = idx + dir
    if (target < 0 || target >= next.length) return
    ;[next[idx], next[target]] = [next[target], next[idx]]
    setOrderTail(next)
  }

  function remove(c: SecondaryCriterion) {
    setOrderTail(orderTail.filter((x) => x !== c))
  }

  function add(c: SecondaryCriterion) {
    setOrderTail([...orderTail, c])
  }

  return (
    <div className="space-y-5">
      {/* Puntos */}
      <div>
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Puntos por resultado</p>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Victoria">
            <div className="relative">
              <input
                type="number" min={0}
                className={inputCls}
                value={value.winPts}
                onChange={(e) => patch({ winPts: parseInt(e.target.value) || 0 })}
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">pts</span>
            </div>
          </Field>
          <Field label="Empate">
            <div className="relative">
              <input
                type="number" min={0}
                disabled={!value.allowDraw}
                className={clsx(inputCls, !value.allowDraw && 'opacity-50 cursor-not-allowed')}
                value={value.drawPts}
                onChange={(e) => patch({ drawPts: parseInt(e.target.value) || 0 })}
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">pts</span>
            </div>
          </Field>
          <Field label="Derrota">
            <div className="relative">
              <input
                type="number" min={0}
                className={inputCls}
                value={value.lossPts}
                onChange={(e) => patch({ lossPts: parseInt(e.target.value) || 0 })}
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">pts</span>
            </div>
          </Field>
        </div>

        <div className="mt-3">
          <Toggle
            checked={value.allowDraw}
            onChange={(v) => patch({ allowDraw: v })}
            label="Permitir empates en fase regular"
            description="Si se desactiva, los partidos empatados se resuelven con el método de desempate del partido (penales, etc.)."
          />
        </div>
      </div>

      <div className="h-px bg-slate-100" />

      {/* Orden de desempate */}
      <div>
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Orden de desempate</p>
        <p className="text-xs text-slate-400 mb-3">
          Si dos equipos terminan con los mismos puntos, se aplican estos criterios en orden hasta romper la igualdad.
        </p>

        <div className="space-y-2">
          {/* Implicit first criterion */}
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-white border border-slate-200 text-xs font-mono font-bold text-slate-400">
              1
            </span>
            <span className="text-sm font-semibold text-slate-700 flex-1">Puntos</span>
            <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400 bg-slate-100 rounded px-2 py-0.5">
              Siempre primero
            </span>
          </div>

          {orderTail.map((c, i) => (
            <div key={c} className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-amber-200 bg-amber-50/40">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-white border border-amber-200 text-xs font-mono font-bold text-amber-700">
                {i + 2}
              </span>
              <span className="text-sm font-semibold text-slate-700 flex-1">{TIEBREAKER_LABEL[c]}</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  title="Subir"
                >
                  <ArrowUp size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => move(i, 1)}
                  disabled={i === orderTail.length - 1}
                  className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  title="Bajar"
                >
                  <ArrowDown size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => remove(c)}
                  className="ml-1 p-1 rounded text-slate-400 hover:text-red-600 hover:bg-white transition-colors"
                  title="Quitar"
                >
                  <span className="text-xs font-bold">×</span>
                </button>
              </div>
            </div>
          ))}

          {orderTail.length === 0 && (
            <p className="text-xs text-slate-400 italic text-center py-2">
              Sólo Puntos. Si dos equipos empatan en puntos, no hay criterio adicional.
            </p>
          )}
        </div>

        {available.length > 0 && (
          <div className="mt-4">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Agregar criterio</p>
            <div className="flex flex-wrap gap-1.5">
              {available.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => add(c)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-600 hover:border-amber-300 hover:bg-amber-50 hover:text-amber-700 transition-colors"
                >
                  + {TIEBREAKER_LABEL[c]}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
