'use client'

import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Shield,
  Calendar,
  Grid3X3,
  BarChart2,
  DollarSign,
  Trophy,
  FileText,
  Settings,
  LogOut,
  X,
  MapPin,
  UserCheck,
} from 'lucide-react'
import { clsx } from 'clsx'
import { useAuth } from '@/contexts/AuthContext'
import { useActiveEdition } from '@/contexts/ActiveEditionContext'
import { signOut } from '@/lib/auth'

const TORNEO_ACTIVO_LINKS = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/equipos', label: 'Equipos', icon: Shield },
  { href: '/partidos', label: 'Partidos', icon: Calendar },
  { href: '/grupos-llaves', label: 'Grupos y Llaves', icon: Grid3X3 },
  { href: '/tabla', label: 'Tabla', icon: BarChart2 },
  { href: '/pagos', label: 'Pagos', icon: DollarSign },
]

const GENERAL_LINKS = [
  { href: '/torneos', label: 'Torneos', icon: Trophy },
  { href: '/canchas', label: 'Canchas', icon: MapPin },
  { href: '/arbitros', label: 'Árbitros', icon: UserCheck },
  { href: '/reportes', label: 'Reportes', icon: FileText },
  { href: '/config', label: 'Config', icon: Settings },
]

function getInitials(name: string | null | undefined): string {
  if (!name) return '?'
  return name.split(' ').slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('')
}

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { user } = useAuth()
  const { activeEdition, clearActiveEdition } = useActiveEdition()

  async function handleLogout() {
    await signOut()
    router.replace('/login')
  }

  return (
    <aside className="w-52 flex-shrink-0 flex flex-col h-full" style={{ backgroundColor: '#1B2535' }}>
      <div className="px-4 py-5 border-b border-white/10">
        <p className="text-white font-bold text-lg tracking-wide">MOVERIX</p>
        <p className="text-slate-400 text-xs mt-0.5">BACKOFFICE ADMIN</p>
      </div>

      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-6">
        {activeEdition && (
          <div>
            <div className="flex items-center justify-between px-2 mb-2">
              <p className="text-slate-500 text-[10px] uppercase tracking-widest">
                Torneo activo
              </p>
              <button
                type="button"
                onClick={clearActiveEdition}
                title="Salir del torneo"
                className="text-slate-500 hover:text-red-400 transition-colors"
              >
                <X size={12} />
              </button>
            </div>

            <div className="mx-2 mb-3 px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 flex items-center gap-2.5">
              {activeEdition.logoUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={activeEdition.logoUrl}
                  alt=""
                  className="w-8 h-8 rounded-lg object-cover border border-white/10 flex-shrink-0"
                />
              ) : (
                <div className="w-8 h-8 rounded-lg bg-green-600/20 border border-green-600/30 flex items-center justify-center flex-shrink-0">
                  <Trophy size={14} className="text-green-400" />
                </div>
              )}
              <div className="min-w-0">
                <p className="text-white text-xs font-semibold truncate">
                  {activeEdition.leagueName} {activeEdition.season}
                </p>
                <p className="text-slate-400 text-[10px] truncate">{activeEdition.name}</p>
              </div>
            </div>

            {TORNEO_ACTIVO_LINKS.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={clsx(
                  'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                  pathname === href
                    ? 'bg-white/10 text-white border-l-2 border-green-500'
                    : 'text-slate-400 hover:text-white hover:bg-white/5',
                )}
              >
                <Icon size={16} />
                {label}
              </Link>
            ))}
          </div>
        )}

        <div>
          <p className="text-slate-500 text-[10px] uppercase tracking-widest px-2 mb-2">General</p>
          {GENERAL_LINKS.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={clsx(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                pathname === href
                  ? 'bg-white/10 text-white border-l-2 border-green-500'
                  : 'text-slate-400 hover:text-white hover:bg-white/5',
              )}
            >
              <Icon size={16} />
              {label}
            </Link>
          ))}
        </div>
      </nav>

      <div className="px-4 py-4 border-t border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-green-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            {getInitials(user?.displayName ?? user?.email)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-xs font-medium truncate">
              {user?.displayName ?? user?.email ?? 'Admin'}
            </p>
            <p className="text-slate-400 text-[10px] truncate">{user?.email ?? ''}</p>
          </div>
          <button
            onClick={handleLogout}
            title="Cerrar sesión"
            className="text-slate-500 hover:text-red-400 transition-colors flex-shrink-0"
          >
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </aside>
  )
}
