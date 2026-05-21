import { Suspense } from 'react'
import { LoginForm } from '@/components/auth/LoginForm'

export default function LoginPage() {
  return (
    <>
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Bienvenido de vuelta</h2>
        <p className="text-slate-500 text-sm mt-1.5">Ingresa a tu cuenta para continuar</p>
      </div>
      <Suspense>
        <LoginForm />
      </Suspense>
    </>
  )
}
