import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Política de Privacidad · Moverix Fútbol',
  description: 'Cómo Moverix recopila, usa y protege tu información.',
}

// Fuente única: la misma que consume la app móvil.
async function fetchLegal() {
  const base = process.env.NEXT_PUBLIC_API_URL
  try {
    const res = await fetch(`${base}/public/legal/privacy`, { next: { revalidate: 300 } })
    if (!res.ok) return null
    return (await res.json()) as { title: string; content: string; updatedAt: string }
  } catch {
    return null
  }
}

export default async function PrivacidadPage() {
  const data = await fetchLegal()
  const title = data?.title ?? 'Política de Privacidad'
  const content = data?.content ?? 'No se pudo cargar la política. Intenta más tarde.'

  return (
    <div className="min-h-screen bg-[#050B10] text-slate-200 px-6 py-12">
      <div className="max-w-2xl mx-auto">
        <p className="text-xs font-bold tracking-widest text-[#7BFF00] uppercase mb-2">Moverix Fútbol</p>
        <h1 className="text-3xl font-black text-white mb-6">{title}</h1>
        <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-line">{content}</p>
        <p className="text-xs text-slate-500 mt-10">Contacto: soporte@moverix.com</p>
      </div>
    </div>
  )
}
