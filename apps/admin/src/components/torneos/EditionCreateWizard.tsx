'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ChevronLeft, ChevronRight, Loader2, AlertCircle, CheckCircle2,
  Calendar, Users, Trophy, Sparkles,
} from 'lucide-react'
import { clsx } from 'clsx'
import {
  createEdition,
  DEFAULT_TIEBREAKERS,
  type FormatConfig,
} from '@/lib/leagues'
import { Field, inputCls } from '@/components/ui/form'
import {
  FORMAT_TEMPLATES,
  FormatSection,
  seasonCodeFromDate,
} from './edition-form'

// ─── Steps metadata ───────────────────────────────────────────────────────────

const STEPS = [
  { key: 'basic',   label: 'Básico',   icon: Sparkles,        hint: 'Nombre y fechas' },
  { key: 'teams',   label: 'Equipos',  icon: Users,           hint: 'Capacidad' },
  { key: 'format',  label: 'Formato',  icon: Trophy,          hint: 'Modalidad del torneo' },
  { key: 'summary', label: 'Resumen',  icon: CheckCircle2,    hint: 'Revisa y crea' },
] as const

// ─── Main component ───────────────────────────────────────────────────────────

export function EditionCreateWizard({ leagueId }: { leagueId: string }) {
  const router = useRouter()
  const [stepIdx, setStepIdx] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [maxTeams, setMaxTeams] = useState('16')
  const [formatConfig, setFormatConfig] = useState<FormatConfig>({})

  const season = seasonCodeFromDate(startDate)

  const selectedTemplate = FORMAT_TEMPLATES.find((t) => t.id === formatConfig.type)
  const currentStep = STEPS[stepIdx]

  const stepError = useMemo(() => {
    if (currentStep.key === 'basic') {
      if (!name.trim()) return 'El nombre es obligatorio.'
      if (startDate && endDate && startDate > endDate) return 'La fecha de fin no puede ser anterior al inicio.'
    }
    if (currentStep.key === 'teams') {
      const n = parseInt(maxTeams)
      if (!n || n < 2) return 'Mínimo 2 equipos.'
    }
    if (currentStep.key === 'format') {
      if (!formatConfig.type) return 'Selecciona un formato.'
    }
    return null
  }, [currentStep.key, name, startDate, endDate, maxTeams, formatConfig.type])

  function goNext() {
    if (stepError) { setError(stepError); return }
    setError(null)
    setStepIdx((i) => Math.min(i + 1, STEPS.length - 1))
  }

  function goPrev() {
    setError(null)
    setStepIdx((i) => Math.max(i - 1, 0))
  }

  async function handleCreate() {
    setSaving(true)
    setError(null)
    try {
      const created = await createEdition({
        leagueId,
        name,
        season,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        maxTeams: parseInt(maxTeams) || 16,
        formatConfig,
        tiebreakerRules: DEFAULT_TIEBREAKERS,
      })
      router.replace(`/torneos/edicion/${created.id}`)
    } catch {
      setError('No se pudo crear la edición. Intenta de nuevo.')
      setSaving(false)
    }
  }

  return (
    <div className="-mx-6 -my-6 px-8 py-6 max-w-4xl">
      {/* Top bar */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/torneos" className="flex items-center gap-1 text-sm text-slate-400 hover:text-slate-700 transition-colors">
          <ChevronLeft size={15} />
          <span>Torneos</span>
        </Link>
        <span className="text-slate-300">/</span>
        <span className="text-sm font-semibold text-slate-900">Nueva edición</span>
      </div>

      {/* Stepper */}
      <div className="mb-8">
        <div className="flex items-center gap-2">
          {STEPS.map((s, i) => {
            const Icon = s.icon
            const isActive = i === stepIdx
            const isDone = i < stepIdx
            return (
              <div key={s.key} className="flex items-center flex-1">
                <div className="flex items-center gap-3 flex-1">
                  <div className={clsx(
                    'w-10 h-10 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors',
                    isActive ? 'border-green-500 bg-green-500 text-white' :
                    isDone ? 'border-green-500 bg-white text-green-600' :
                    'border-slate-200 bg-white text-slate-400',
                  )}>
                    {isDone ? <CheckCircle2 size={18} /> : <Icon size={16} />}
                  </div>
                  <div className="hidden sm:block min-w-0">
                    <p className={clsx('text-xs font-bold uppercase tracking-wide',
                      isActive ? 'text-green-700' : isDone ? 'text-slate-600' : 'text-slate-400',
                    )}>
                      Paso {i + 1}
                    </p>
                    <p className={clsx('text-sm font-semibold truncate',
                      isActive || isDone ? 'text-slate-900' : 'text-slate-400',
                    )}>
                      {s.label}
                    </p>
                  </div>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={clsx('flex-1 h-0.5 mx-2', isDone ? 'bg-green-500' : 'bg-slate-200')} />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Step content */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-5">
        <div className="px-6 py-5 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-900">{currentStep.label}</h2>
          <p className="text-xs text-slate-400 mt-0.5">{currentStep.hint}</p>
        </div>
        <div className="px-6 py-6">
          {currentStep.key === 'basic' && (
            <div className="space-y-5">
              <Field label="Nombre de la edición" hint="Ej: Temporada 2025 - I, Copa Verano, etc.">
                <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Temporada 2025 - I" autoFocus />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Fecha de inicio">
                  <div className="relative">
                    <Calendar size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <input type="date" className={clsx(inputCls, 'pl-10')} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                  </div>
                </Field>
                <Field label="Fecha estimada de fin">
                  <div className="relative">
                    <Calendar size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <input type="date" className={clsx(inputCls, 'pl-10')} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                  </div>
                </Field>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide">Código de temporada</p>
                  <p className="text-xs text-slate-400 mt-0.5">Generado automáticamente desde la fecha de inicio.</p>
                </div>
                <span className="font-mono text-sm font-bold text-slate-800 bg-white border border-slate-200 rounded-lg px-3 py-1.5">
                  {season}
                </span>
              </div>
            </div>
          )}

          {currentStep.key === 'teams' && (
            <div className="space-y-5">
              <Field label="Máximo de equipos" hint="Cuántos equipos pueden inscribirse. Mínimo 2.">
                <input type="number" min={2} step={2} className={inputCls} value={maxTeams} onChange={(e) => setMaxTeams(e.target.value)} autoFocus />
              </Field>
              <div className="grid grid-cols-4 gap-2">
                {[8, 16, 24, 32].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setMaxTeams(String(n))}
                    className={clsx(
                      'px-4 py-3 rounded-xl border text-sm font-bold transition-all',
                      parseInt(maxTeams) === n
                        ? 'border-green-500 bg-green-50 text-green-700'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300',
                    )}
                  >
                    {n} equipos
                  </button>
                ))}
              </div>
              <p className="text-xs text-slate-400">
                Podrás ajustar este valor luego desde la pestaña Equipos.
              </p>
            </div>
          )}

          {currentStep.key === 'format' && (
            <FormatSection
              formatConfig={formatConfig}
              onChange={setFormatConfig}
              maxTeams={parseInt(maxTeams) || 16}
            />
          )}

          {currentStep.key === 'summary' && (
            <div className="space-y-4">
              <p className="text-sm text-slate-600">
                Revisa los datos antes de crear. Podrás editar todo desde la ficha de la edición.
              </p>
              <SummaryRow label="Nombre" value={name} />
              <SummaryRow label="Temporada" value={season} mono />
              <SummaryRow label="Inicio" value={startDate || '—'} />
              <SummaryRow label="Fin estimado" value={endDate || '—'} />
              <SummaryRow label="Máximo de equipos" value={maxTeams} />
              <SummaryRow label="Formato" value={selectedTemplate ? `${selectedTemplate.icon} ${selectedTemplate.label}` : '—'} />
              {formatConfig.phase1 && 'groupCount' in formatConfig.phase1 && (
                <SummaryRow
                  label="Fase de grupos"
                  value={`${formatConfig.phase1.groupCount} grupos × ${formatConfig.phase1.teamsPerGroup} eq. (clasifican ${formatConfig.phase1.qualifiersPerGroup})`}
                />
              )}
              {formatConfig.phase2 && 'bracketSize' in formatConfig.phase2 && (
                <SummaryRow label="Bracket" value={`${formatConfig.phase2.bracketSize} equipos`} />
              )}
              {formatConfig.phase2 && 'cups' in formatConfig.phase2 && (
                <SummaryRow label="Copas" value={`${formatConfig.phase2.cups.length} copas`} />
              )}
              {formatConfig.minutesPerHalf ? (
                <SummaryRow label="Duración del partido" value={`${formatConfig.minutesPerHalf * 2} min (2 × ${formatConfig.minutesPerHalf})`} />
              ) : null}
              <SummaryRow
                label="Puntuación"
                value={`${DEFAULT_TIEBREAKERS.winPts} / ${DEFAULT_TIEBREAKERS.drawPts} / ${DEFAULT_TIEBREAKERS.lossPts}`}
              />
              <SummaryRow
                label="Desempates"
                value={DEFAULT_TIEBREAKERS.order.slice(1).join(' → ')}
              />
            </div>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-600 mb-4">
          <AlertCircle size={14} /> {error}
        </div>
      )}

      {/* Nav buttons */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={goPrev}
          disabled={stepIdx === 0 || saving}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors disabled:opacity-40"
        >
          <ChevronLeft size={15} />
          Anterior
        </button>

        <div className="flex items-center gap-3">
          <Link
            href="/torneos"
            className="text-sm text-slate-400 hover:text-slate-700 transition-colors"
          >
            Cancelar
          </Link>
          {stepIdx < STEPS.length - 1 ? (
            <button
              type="button"
              onClick={goNext}
              className="flex items-center gap-1.5 px-5 py-2.5 bg-slate-900 text-white text-sm font-bold rounded-xl hover:bg-slate-800 transition-all shadow-sm active:scale-[0.98]"
            >
              Siguiente
              <ChevronRight size={15} />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleCreate}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 bg-green-600 text-white text-sm font-bold rounded-xl hover:bg-green-700 disabled:opacity-60 transition-all shadow-sm active:scale-[0.98]"
            >
              {saving ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
              {saving ? 'Creando...' : 'Crear edición'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function SummaryRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
      <span className="text-xs text-slate-500 font-semibold uppercase tracking-wide">{label}</span>
      <span className={clsx('text-sm font-semibold text-slate-900', mono && 'font-mono')}>{value}</span>
    </div>
  )
}

