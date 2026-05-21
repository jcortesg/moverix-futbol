'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, CheckCircle2, Building2, Trophy, CalendarDays } from 'lucide-react'
import { api } from '@/lib/api'
import { toSlug, toSeason } from '@/lib/slug'
import { clsx } from 'clsx'

// ─── Schemas ─────────────────────────────────────────────────────────────────

const orgSchema = z.object({
  name: z.string().min(3, 'Mínimo 3 caracteres').max(120),
  city: z.string().max(100).optional(),
})

const leagueSchema = z.object({
  name: z.string().min(3, 'Mínimo 3 caracteres').max(120),
  sportFormat: z.enum(['F5', 'F8', 'F11']),
  gender: z.enum(['M', 'F', 'Mixed']),
})

const editionSchema = z.object({
  name: z.string().min(3, 'Mínimo 3 caracteres').max(120),
  season: z.string().min(2, 'Mínimo 2 caracteres').max(20),
  registrationOpen: z.string().optional(),
  registrationClose: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  maxTeams: z.coerce.number().int().min(2, 'Mínimo 2 equipos').default(16),
  registrationFee: z.coerce.number().int().min(0).default(0),
})

type OrgValues = z.infer<typeof orgSchema>
type LeagueValues = z.infer<typeof leagueSchema>
type EditionValues = z.infer<typeof editionSchema>

// ─── Step indicator ───────────────────────────────────────────────────────────

const STEPS = [
  { label: 'Organización', icon: Building2 },
  { label: 'Liga', icon: Trophy },
  { label: 'Temporada', icon: CalendarDays },
]

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-center gap-0 mb-10">
      {STEPS.map((s, i) => {
        const idx = i + 1
        const done = idx < current
        const active = idx === current
        const Icon = s.icon
        return (
          <div key={s.label} className="flex items-center">
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={clsx(
                  'w-10 h-10 rounded-full flex items-center justify-center transition-all',
                  done && 'bg-green-600 text-white',
                  active && 'bg-slate-900 text-white ring-4 ring-slate-900/10',
                  !done && !active && 'bg-slate-200 text-slate-400',
                )}
              >
                {done ? <CheckCircle2 size={18} /> : <Icon size={18} />}
              </div>
              <span
                className={clsx(
                  'text-[11px] font-medium whitespace-nowrap',
                  active ? 'text-slate-900' : done ? 'text-green-600' : 'text-slate-400',
                )}
              >
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={clsx(
                  'h-px w-14 mb-5 mx-1 transition-colors',
                  done ? 'bg-green-500' : 'bg-slate-200',
                )}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Field wrapper ────────────────────────────────────────────────────────────

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string
  hint?: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-slate-700">{label}</label>
      {children}
      {hint && !error && <p className="text-xs text-slate-400">{hint}</p>}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}

const inputCls =
  'w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 placeholder-slate-400 outline-none transition focus:border-green-500 focus:bg-white focus:ring-2 focus:ring-green-500/20'

// ─── Step 1: Organización ─────────────────────────────────────────────────────

function OrgStep({ onNext }: { onNext: (orgId: string) => void }) {
  const [error, setError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<OrgValues>({ resolver: zodResolver(orgSchema) })

  const name = watch('name') ?? ''

  async function onSubmit(values: OrgValues) {
    setError(null)
    try {
      const { data } = await api.post('/organizations', {
        name: values.name,
        city: values.city || undefined,
      })
      onNext(data.id)
    } catch {
      setError('No se pudo crear la organización. Intenta de nuevo.')
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-slate-900">¿Cómo se llama tu organización?</h2>
        <p className="text-slate-500 text-sm mt-1">
          La organización agrupa todas tus ligas y torneos.
        </p>
      </div>

      <Field
        label="Nombre"
        hint={name.length >= 3 ? `Identificador: ${toSlug(name)}` : undefined}
        error={errors.name?.message}
      >
        <input
          type="text"
          {...register('name')}
          placeholder="Club Atlético San Bernardo"
          className={inputCls}
          autoFocus
        />
      </Field>

      <Field label="Ciudad (opcional)" error={errors.city?.message}>
        <input
          type="text"
          {...register('city')}
          placeholder="Bogotá"
          className={inputCls}
        />
      </Field>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-semibold py-3 text-sm transition-colors flex items-center justify-center gap-2"
      >
        {isSubmitting && <Loader2 size={15} className="animate-spin" />}
        Continuar →
      </button>
    </form>
  )
}

// ─── Step 2: Liga ─────────────────────────────────────────────────────────────

function LeagueStep({ orgId, onNext }: { orgId: string; onNext: (leagueId: string) => void }) {
  const [error, setError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LeagueValues>({
    resolver: zodResolver(leagueSchema),
    defaultValues: { sportFormat: 'F8', gender: 'M' },
  })

  const sportFormat = watch('sportFormat')
  const gender = watch('gender')

  async function onSubmit(values: LeagueValues) {
    setError(null)
    try {
      const { data } = await api.post('/leagues', {
        ...values,
        organizationId: orgId,
        slug: toSlug(values.name),
      })
      onNext(data.id)
    } catch {
      setError('No se pudo crear la liga. Intenta de nuevo.')
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Crea tu primera liga</h2>
        <p className="text-slate-500 text-sm mt-1">
          Una liga puede tener múltiples temporadas.
        </p>
      </div>

      <Field label="Nombre de la liga" error={errors.name?.message}>
        <input
          type="text"
          {...register('name')}
          placeholder="Liga Fútbol 8 Masculina"
          className={inputCls}
          autoFocus
        />
      </Field>

      <Field label="Formato" error={errors.sportFormat?.message}>
        <div className="flex gap-2">
          {(['F5', 'F8', 'F11'] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setValue('sportFormat', f)}
              className={clsx(
                'flex-1 py-2.5 rounded-xl border text-sm font-semibold transition-all',
                sportFormat === f
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300',
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Género" error={errors.gender?.message}>
        <div className="flex gap-2">
          {([['M', 'Masculino'], ['F', 'Femenino'], ['Mixed', 'Mixto']] as const).map(
            ([val, label]) => (
              <button
                key={val}
                type="button"
                onClick={() => setValue('gender', val)}
                className={clsx(
                  'flex-1 py-2.5 rounded-xl border text-sm font-medium transition-all',
                  gender === val
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300',
                )}
              >
                {label}
              </button>
            ),
          )}
        </div>
      </Field>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-xl bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-semibold py-3 text-sm transition-colors flex items-center justify-center gap-2"
      >
        {isSubmitting && <Loader2 size={15} className="animate-spin" />}
        Continuar →
      </button>
    </form>
  )
}

// ─── Step 3: Temporada ────────────────────────────────────────────────────────

function EditionStep({ leagueId, onDone }: { leagueId: string; onDone: () => void }) {
  const [error, setError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<EditionValues>({
    resolver: zodResolver(editionSchema),
    defaultValues: { maxTeams: 16, registrationFee: 0 },
  })

  const name = watch('name') ?? ''

  useEffect(() => {
    const season = toSeason(name)
    if (season.length >= 2) {
      setValue('season', season, { shouldValidate: false })
    }
  }, [name, setValue])

  async function onSubmit(values: EditionValues) {
    setError(null)
    try {
      await api.post('/editions', {
        leagueId,
        name: values.name,
        season: values.season,
        startDate: values.startDate || undefined,
        endDate: values.endDate || undefined,
        maxTeams: values.maxTeams,
        registrationFee: values.registrationFee,
        currency: 'COP',
        formatConfig: {
          ...(values.registrationOpen && { registrationOpen: values.registrationOpen }),
          ...(values.registrationClose && { registrationClose: values.registrationClose }),
        },
      })
      onDone()
    } catch {
      setError('No se pudo crear la temporada. Intenta de nuevo.')
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Configura la temporada</h2>
        <p className="text-slate-500 text-sm mt-1">
          Define el período de juego, inscripciones y equipos.
        </p>
      </div>

      <Field label="Nombre de la temporada" error={errors.name?.message}>
        <input
          type="text"
          {...register('name')}
          placeholder="Temporada 2025 - I"
          className={inputCls}
          autoFocus
        />
      </Field>

      <Field
        label="Código de temporada"
        hint="Se genera automáticamente, puedes editarlo"
        error={errors.season?.message}
      >
        <input
          type="text"
          {...register('season')}
          placeholder="2025-I"
          className={inputCls}
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Apertura inscripciones" error={errors.registrationOpen?.message}>
          <input type="date" {...register('registrationOpen')} className={inputCls} />
        </Field>
        <Field label="Cierre inscripciones" error={errors.registrationClose?.message}>
          <input type="date" {...register('registrationClose')} className={inputCls} />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Inicio del torneo" error={errors.startDate?.message}>
          <input type="date" {...register('startDate')} className={inputCls} />
        </Field>
        <Field label="Fin estimado" error={errors.endDate?.message}>
          <input type="date" {...register('endDate')} className={inputCls} />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Máximo de equipos" error={errors.maxTeams?.message}>
          <input
            type="number"
            {...register('maxTeams')}
            min={2}
            className={inputCls}
          />
        </Field>
        <Field
          label="Costo inscripción (COP)"
          hint="0 si es gratuito"
          error={errors.registrationFee?.message}
        >
          <input
            type="number"
            {...register('registrationFee')}
            min={0}
            step={1000}
            className={inputCls}
          />
        </Field>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-xl bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-semibold py-3 text-sm transition-colors flex items-center justify-center gap-2"
      >
        {isSubmitting && <Loader2 size={15} className="animate-spin" />}
        Crear temporada y comenzar →
      </button>
    </form>
  )
}

// ─── Done screen ──────────────────────────────────────────────────────────────

function DoneScreen({ onGoToDashboard }: { onGoToDashboard: () => void }) {
  return (
    <div className="text-center space-y-5">
      <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
        <CheckCircle2 size={32} className="text-green-600" />
      </div>
      <div>
        <h2 className="text-xl font-bold text-slate-900">¡Todo listo!</h2>
        <p className="text-slate-500 text-sm mt-1.5 max-w-xs mx-auto">
          Tu organización, primera liga y primera temporada están creadas. Ya puedes gestionar equipos, partidos y más desde el dashboard.
        </p>
      </div>
      <button
        onClick={onGoToDashboard}
        className="w-full rounded-xl bg-green-600 hover:bg-green-700 text-white font-semibold py-3 text-sm transition-colors"
      >
        Ir al dashboard →
      </button>
    </div>
  )
}

// ─── Main wizard ──────────────────────────────────────────────────────────────

type WizardState = {
  step: 1 | 2 | 3 | 'done'
  orgId: string | null
  leagueId: string | null
  initializing: boolean
}

export default function OnboardingPage() {
  const router = useRouter()
  const [state, setState] = useState<WizardState>({
    step: 1,
    orgId: null,
    leagueId: null,
    initializing: true,
  })

  useEffect(() => {
    api
      .get('/organizations')
      .then(async ({ data: orgs }) => {
        if (orgs.length === 0) {
          setState((s) => ({ ...s, initializing: false }))
          return
        }
        const orgId: string = orgs[0].id
        try {
          const { data: leagues } = await api.get(`/leagues?organizationId=${orgId}`)
          if (leagues.length > 0) {
            setState({ step: 3, orgId, leagueId: leagues[0].id, initializing: false })
          } else {
            setState({ step: 2, orgId, leagueId: null, initializing: false })
          }
        } catch {
          setState({ step: 2, orgId, leagueId: null, initializing: false })
        }
      })
      .catch(() => setState((s) => ({ ...s, initializing: false })))
  }, [])

  if (state.initializing) {
    return (
      <div className="flex items-center justify-center gap-3 text-slate-400">
        <Loader2 size={20} className="animate-spin" />
        <span className="text-sm">Cargando...</span>
      </div>
    )
  }

  const currentStep = state.step === 'done' ? 3 : (state.step as number)

  return (
    <div className="w-full max-w-md">
      {/* Logo */}
      <div className="flex items-center gap-2.5 mb-8 justify-center">
        <div className="w-8 h-8 rounded-lg bg-green-600 flex items-center justify-center">
          <span className="text-white font-black text-sm">M</span>
        </div>
        <p className="text-slate-900 font-bold text-lg tracking-[0.15em]">MOVERIX</p>
      </div>

      {state.step !== 'done' && <StepIndicator current={currentStep} />}

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
        {state.step === 1 && (
          <OrgStep
            onNext={(orgId) => setState({ step: 2, orgId, leagueId: null, initializing: false })}
          />
        )}
        {state.step === 2 && (
          <LeagueStep
            orgId={state.orgId!}
            onNext={(leagueId) => setState((s) => ({ ...s, step: 3, leagueId }))}
          />
        )}
        {state.step === 3 && (
          <EditionStep
            leagueId={state.leagueId!}
            onDone={() => setState((s) => ({ ...s, step: 'done' }))}
          />
        )}
        {state.step === 'done' && (
          <DoneScreen onGoToDashboard={() => router.push('/')} />
        )}
      </div>

      {state.step !== 'done' && (
        <p className="text-center text-xs text-slate-400 mt-4">
          Paso {currentStep} de 3
        </p>
      )}
    </div>
  )
}
