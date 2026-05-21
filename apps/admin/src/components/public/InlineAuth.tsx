'use client'

import { useState } from 'react'
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  updateProfile,
} from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { Loader2, AlertCircle, Shield, Eye, EyeOff } from 'lucide-react'
import { inputCls } from '@/components/ui/form'

export function InlineAuth({ title, subtitle }: { title: string; subtitle?: string }) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authName, setAuthName] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [authError, setAuthError] = useState('')
  const [authLoading, setAuthLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  async function handleGoogle() {
    setAuthError('')
    setGoogleLoading(true)
    try {
      await signInWithPopup(auth, new GoogleAuthProvider())
    } catch (err: any) {
      if (err?.code !== 'auth/popup-closed-by-user') {
        setAuthError('Error con Google. Intenta de nuevo.')
      }
    } finally {
      setGoogleLoading(false)
    }
  }

  async function handleEmailAuth(e: React.FormEvent) {
    e.preventDefault()
    setAuthError('')
    setAuthLoading(true)
    try {
      if (mode === 'register') {
        if (!authName.trim()) { setAuthError('El nombre es obligatorio'); setAuthLoading(false); return }
        const cred = await createUserWithEmailAndPassword(auth, authEmail, authPassword)
        await updateProfile(cred.user, { displayName: authName.trim() })
      } else {
        await signInWithEmailAndPassword(auth, authEmail, authPassword)
      }
    } catch (err: any) {
      const messages: Record<string, string> = {
        'auth/email-already-in-use': 'Ya existe una cuenta con ese email',
        'auth/invalid-credential': 'Email o contraseña incorrectos',
        'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres',
        'auth/invalid-email': 'Email no valido',
        'auth/too-many-requests': 'Demasiados intentos. Intenta mas tarde',
      }
      setAuthError(messages[err?.code] ?? 'Error de autenticacion')
    } finally {
      setAuthLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
      <Shield size={28} className="mx-auto mb-3 text-green-500" />
      <h2 className="text-lg font-bold text-slate-900 text-center mb-1">{title}</h2>
      {subtitle && (
        <p className="text-sm text-slate-400 text-center mb-6">{subtitle}</p>
      )}
      {!subtitle && (
        <p className="text-sm text-slate-400 text-center mb-6">
          {mode === 'login' ? 'Inicia sesion para continuar' : 'Crea tu cuenta para continuar'}
        </p>
      )}

      {/* Google */}
      <button
        type="button"
        onClick={handleGoogle}
        disabled={googleLoading || authLoading}
        className="w-full flex items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 transition-all disabled:opacity-50 mb-4"
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

      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1 h-px bg-slate-100" />
        <span className="text-xs text-slate-400">o con email</span>
        <div className="flex-1 h-px bg-slate-100" />
      </div>

      <form onSubmit={handleEmailAuth} className="space-y-3">
        {mode === 'register' && (
          <input
            value={authName}
            onChange={(e) => setAuthName(e.target.value)}
            placeholder="Tu nombre completo"
            className={inputCls}
            required
          />
        )}
        <input
          type="email"
          value={authEmail}
          onChange={(e) => setAuthEmail(e.target.value)}
          placeholder="tu@email.com"
          className={inputCls}
          required
        />
        <div className="relative">
          <input
            type={showPassword ? 'text' : 'password'}
            value={authPassword}
            onChange={(e) => setAuthPassword(e.target.value)}
            placeholder="Contraseña"
            className={inputCls + ' pr-10'}
            required
            minLength={6}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        </div>

        {authError && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 flex items-start gap-2">
            <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
            {authError}
          </div>
        )}

        <button
          type="submit"
          disabled={authLoading}
          className="w-full py-3 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2 text-sm"
        >
          {authLoading && <Loader2 size={16} className="animate-spin" />}
          {mode === 'login' ? 'Iniciar sesion' : 'Crear cuenta'}
        </button>
      </form>

      <p className="text-center text-sm text-slate-500 mt-4">
        {mode === 'login' ? (
          <>No tienes cuenta? <button onClick={() => setMode('register')} className="text-green-600 hover:underline font-medium">Registrate</button></>
        ) : (
          <>Ya tienes cuenta? <button onClick={() => setMode('login')} className="text-green-600 hover:underline font-medium">Inicia sesion</button></>
        )}
      </p>
    </div>
  )
}
