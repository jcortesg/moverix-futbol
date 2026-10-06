import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { CopyCode } from './CopyCode'

const IOS_STORE_URL = 'https://apps.apple.com/es/app/moverix-futbol/id6774387262'
const ANDROID_STORE_URL = 'https://play.google.com/store/apps/details?id=com.moverixfutbol'

type TeamInvite = {
  name: string
  accessCode: string
  logoUrl: string | null
  city: string | null
  primaryColor: string | null
  editionName?: string | null
}

async function fetchInvite(code: string): Promise<TeamInvite | null> {
  const base = process.env.NEXT_PUBLIC_API_URL
  if (!base) return null
  try {
    const res = await fetch(`${base}/public/teams/invite/${encodeURIComponent(code)}`, {
      cache: 'no-store',
    })
    if (!res.ok) return null
    return (await res.json()) as TeamInvite
  } catch {
    return null
  }
}

// Preview enriquecido al compartir el link (WhatsApp, redes) vía Open Graph.
export async function generateMetadata({ params }: { params: { code: string } }): Promise<Metadata> {
  const team = await fetchInvite(params.code)
  if (!team) {
    return { title: 'Invitación · Moverix Fútbol' }
  }
  const title = `Únete a ${team.name} en Moverix`
  const description = `Te invitaron a unirte a ${team.name}. Descarga la app e ingresa el código ${team.accessCode}.`
  const url = `https://futbol.moverix.co/i/${team.accessCode}`
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url,
      siteName: 'Moverix Fútbol',
      type: 'website',
      images: team.logoUrl ? [{ url: team.logoUrl }] : [],
    },
    twitter: {
      card: 'summary',
      title,
      description,
      images: team.logoUrl ? [team.logoUrl] : [],
    },
  }
}

export default async function InvitePage({ params }: { params: { code: string } }) {
  const code = (params.code ?? '').toUpperCase()
  const team = await fetchInvite(code)

  const ua = headers().get('user-agent')?.toLowerCase() ?? ''
  const isIOS = /iphone|ipad|ipod/.test(ua)
  const isAndroid = /android/.test(ua)

  if (!team) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#050B10] px-6 text-center">
        <p className="text-2xl font-black text-white mb-2">Invitación no válida</p>
        <p className="text-sm text-slate-400">El código de invitación no existe o expiró.</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#050B10] px-6 py-12 text-center">
      <div className="w-full max-w-sm">
        {team.logoUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={team.logoUrl}
            alt=""
            className="w-24 h-24 rounded-2xl object-cover border border-white/10 mx-auto mb-5"
          />
        ) : (
          <div
            className="w-24 h-24 rounded-2xl mx-auto mb-5 flex items-center justify-center border border-white/10"
            style={{ background: `${team.primaryColor ?? '#7BFF00'}22` }}
          >
            <span className="text-3xl">⚽</span>
          </div>
        )}

        <p className="text-xs font-bold tracking-widest text-[#7BFF00] uppercase mb-1">
          Te invitaron a unirte a
        </p>
        <h1 className="text-3xl font-black text-white mb-2">{team.name}</h1>
        {team.editionName && (
          <p className="text-sm text-slate-300 mb-6">para el campeonato <b className="text-white">{team.editionName}</b></p>
        )}
        {!team.editionName && <div className="mb-4" />}

        <p className="text-xs text-slate-400 mb-2">Código de invitación</p>
        <CopyCode code={team.accessCode} />
        <div className="mb-8" />

        <p className="text-sm text-slate-300 mb-5">
          Descarga la app Moverix, entra a <b className="text-white">&quot;Unirse a un equipo&quot;</b> e ingresa el
          código <b className="text-white">{team.accessCode}</b>.
        </p>

        <div className="flex flex-col gap-3">
          <a
            href={IOS_STORE_URL}
            className={`w-full py-3 rounded-xl font-bold transition-all ${
              isIOS || !isAndroid
                ? 'bg-[#7BFF00] text-[#050B10]'
                : 'bg-white/10 text-white border border-white/10'
            }`}
          >
             Descargar en App Store
          </a>
          <a
            href={ANDROID_STORE_URL}
            className={`w-full py-3 rounded-xl font-bold transition-all ${
              isAndroid
                ? 'bg-[#7BFF00] text-[#050B10]'
                : 'bg-white/10 text-white border border-white/10'
            }`}
          >
            ▶ Descargar en Google Play
          </a>
        </div>

        {team.city && <p className="text-xs text-slate-500 mt-8">{team.city}</p>}
      </div>
    </div>
  )
}
