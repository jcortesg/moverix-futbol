import { Suspense } from 'react'
import { RegisterForm } from '@/components/auth/RegisterForm'

export default function RegisterPage() {
  return (
    <>
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-slate-900">Crear cuenta</h2>
        <p className="text-slate-500 text-sm mt-1">Empieza a gestionar tus torneos gratis</p>
      </div>
      {/* Suspense: el formulario lee ?redirect= con useSearchParams. */}
      <Suspense>
        <RegisterForm />
      </Suspense>
    </>
  )
}
