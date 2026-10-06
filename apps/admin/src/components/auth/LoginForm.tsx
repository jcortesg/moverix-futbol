'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { signIn, signInWithGoogle, getFirebaseErrorMessage } from '@/lib/auth'
import { api } from '@/lib/api'

const schema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
})

type FormValues = z.infer<typeof schema>

export function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirect = searchParams.get('redirect') ?? '/'
  const [showPassword, setShowPassword] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  const [googleLoading, setGoogleLoading] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  async function redirectAfterLogin() {
    // Un destino explícito manda (p. ej. una invitación a dirigir un partido).
    if (redirect && redirect !== '/') {
      router.push(redirect)
      return
    }
    try {
      const { data } = await api.get('/organizations')
      if (data.length > 0) {
        router.push(redirect)
        return
      }
      // Sin organización: si tiene partidos asignados es un delegado, y su
      // pantalla es la de dirigir, no el onboarding de crear una liga.
      try {
        const { data: matches } = await api.get('/mobile/referee/matches')
        if (Array.isArray(matches) && matches.length > 0) {
          router.push('/dirigir')
          return
        }
      } catch {
        /* sin acceso a partidos: sigue al onboarding */
      }
      router.push('/onboarding')
    } catch {
      router.push(redirect)
    }
  }

  async function onSubmit(values: FormValues) {
    setAuthError(null)
    try {
      await signIn(values.email, values.password)
      await redirectAfterLogin()
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
      await redirectAfterLogin()
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? ''
      setAuthError(getFirebaseErrorMessage(code))
    } finally {
      setGoogleLoading(false)
    }
  }

  const busy = isSubmitting || googleLoading

  return (
    <div className="space-y-5">
      {/* Google SSO */}
      <button
        type="button"
        onClick={handleGoogle}
        disabled={busy}
        className="w-full flex items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 hover:border-slate-300 transition-all disabled:opacity-50"
      >
        {googleLoading ? (
          <Loader2 size={16} className="animate-spin text-slate-400" />
        ) : (
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
            <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" />
            <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" />
            <path fill="#FBBC05" d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" />
            <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z" />
          </svg>
        )}
        Continuar con Google
      </button>

      {/* Divider */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-slate-100" />
        <span className="text-xs text-slate-400 font-medium">o con email</span>
        <div className="flex-1 h-px bg-slate-100" />
      </div>

      {/* Email + Password form */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div className="space-y-1">
          <label htmlFor="email" className="block text-sm font-medium text-slate-700">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            {...register('email')}
            placeholder="tu@email.com"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 placeholder-slate-400 outline-none transition focus:border-green-500 focus:bg-white focus:ring-2 focus:ring-green-500/20"
          />
          {errors.email && (
            <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>
          )}
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label htmlFor="password" className="block text-sm font-medium text-slate-700">
              Contraseña
            </label>
            <Link
              href="/reset-password"
              className="text-xs text-green-600 hover:text-green-700 font-medium"
            >
              ¿Olvidaste tu contraseña?
            </Link>
          </div>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              {...register('password')}
              placeholder="••••••••"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 pr-11 text-sm text-slate-900 placeholder-slate-400 outline-none transition focus:border-green-500 focus:bg-white focus:ring-2 focus:ring-green-500/20"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {errors.password && (
            <p className="text-xs text-red-500 mt-1">{errors.password.message}</p>
          )}
        </div>

        {authError && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {authError}
          </div>
        )}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-xl bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-semibold py-3 text-sm transition-colors flex items-center justify-center gap-2 shadow-sm mt-1"
        >
          {isSubmitting && <Loader2 size={15} className="animate-spin" />}
          Iniciar sesión
        </button>
      </form>

      <p className="text-center text-sm text-slate-500 pt-1">
        ¿No tienes cuenta?{' '}
        <Link
          href={redirect && redirect !== '/' ? `/registro?redirect=${encodeURIComponent(redirect)}` : '/registro'}
          className="text-green-600 hover:text-green-700 font-semibold"
        >
          Regístrate gratis
        </Link>
      </p>
    </div>
  )
}
