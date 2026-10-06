'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { signUp, signInWithGoogle, getFirebaseErrorMessage } from '@/lib/auth'
import { api } from '@/lib/api'

const schema = z
  .object({
    displayName: z.string().min(2, 'Mínimo 2 caracteres'),
    email: z.string().email('Email inválido'),
    password: z.string().min(6, 'Mínimo 6 caracteres'),
    confirmPassword: z.string(),
    orgName: z.string().optional(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Las contraseñas no coinciden',
    path: ['confirmPassword'],
  })

type FormValues = z.infer<typeof schema>

export function RegisterForm() {
  const router = useRouter()
  // Quien llega con ?redirect= viene invitado a una tarea concreta (dirigir un
  // partido, por ejemplo): no crea organización ni pasa por el onboarding.
  const searchParams = useSearchParams()
  const redirect = searchParams.get('redirect')
  const isInvited = !!redirect && redirect !== '/'
  const [showPassword, setShowPassword] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  const [googleLoading, setGoogleLoading] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  async function createOrganization(orgName: string) {
    try {
      await api.post('/organizations', { name: orgName })
    } catch {
      // Si falla, el usuario puede crearla desde el onboarding
    }
  }

  async function onSubmit(values: FormValues) {
    setAuthError(null)
    try {
      await signUp(values.email, values.password, values.displayName)
      if (isInvited) {
        router.push(redirect!)
        return
      }
      if (values.orgName?.trim()) await createOrganization(values.orgName.trim())
      router.push('/onboarding')
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? ''
      setAuthError(getFirebaseErrorMessage(code))
    }
  }

  async function handleGoogle() {
    setAuthError(null)
    setGoogleLoading(true)
    try {
      await signInWithGoogle()
      router.push(isInvited ? redirect! : '/onboarding')
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? ''
      setAuthError(getFirebaseErrorMessage(code))
    } finally {
      setGoogleLoading(false)
    }
  }

  return (
    <div className="space-y-5">
      <button
        type="button"
        onClick={handleGoogle}
        disabled={googleLoading || isSubmitting}
        className="w-full flex items-center justify-center gap-3 border border-slate-200 rounded-lg px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
      >
        {googleLoading ? (
          <Loader2 size={16} className="animate-spin" />
        ) : (
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
            <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
            <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
            <path fill="#FBBC05" d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z"/>
            <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z"/>
          </svg>
        )}
        Registrarse con Google
      </button>

      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-slate-200" />
        <span className="text-xs text-slate-400">o con email</span>
        <div className="flex-1 h-px bg-slate-200" />
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Nombre completo</label>
          <input
            type="text"
            autoComplete="name"
            {...register('displayName')}
            className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20 transition"
            placeholder="Juan García"
          />
          {errors.displayName && (
            <p className="mt-1 text-xs text-red-500">{errors.displayName.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
          <input
            type="email"
            autoComplete="email"
            {...register('email')}
            className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20 transition"
            placeholder="tu@email.com"
          />
          {errors.email && (
            <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Contraseña</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                {...register('password')}
                className="w-full rounded-lg border border-slate-200 px-3 py-2.5 pr-9 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20 transition"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            {errors.password && (
              <p className="mt-1 text-xs text-red-500">{errors.password.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Confirmar</label>
            <input
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              {...register('confirmPassword')}
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20 transition"
              placeholder="••••••••"
            />
            {errors.confirmPassword && (
              <p className="mt-1 text-xs text-red-500">{errors.confirmPassword.message}</p>
            )}
          </div>
        </div>

        <div className={isInvited ? 'hidden' : undefined}>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Nombre de tu organización
          </label>
          <input
            type="text"
            {...register('orgName')}
            className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20 transition"
            placeholder="Club Atlético San Bernardo"
          />
          {errors.orgName && (
            <p className="mt-1 text-xs text-red-500">{errors.orgName.message}</p>
          )}
        </div>

        {authError && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2.5 text-sm text-red-600">
            {authError}
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting || googleLoading}
          className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-medium rounded-lg py-2.5 text-sm transition-colors flex items-center justify-center gap-2"
        >
          {isSubmitting && <Loader2 size={16} className="animate-spin" />}
          Crear cuenta
        </button>

        <p className="text-center text-xs text-slate-400">
          Al registrarte aceptas nuestros{' '}
          <span className="text-slate-600">Términos de Servicio</span> y{' '}
          <span className="text-slate-600">Política de Privacidad</span>.
        </p>
      </form>

      <p className="text-center text-sm text-slate-500">
        ¿Ya tienes cuenta?{' '}
        <Link href="/login" className="text-green-600 hover:text-green-700 font-medium">
          Iniciar sesión
        </Link>
      </p>
    </div>
  )
}
