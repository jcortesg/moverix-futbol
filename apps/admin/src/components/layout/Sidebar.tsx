'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
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
} from 'lucide-react'
import { clsx } from 'clsx'

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
  { href: '/reportes', label: 'Reportes', icon: FileText },
  { href: '/config', label: 'Config', icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-52 flex-shrink-0 flex flex-col h-full" style={{ backgroundColor: '#1B2535' }}>
      <div className="px-4 py-5 border-b border-white/10">
        <p className="text-white font-bold text-lg tracking-wide">MOVERIX</p>
        <p className="text-slate-400 text-xs mt-0.5">BACKOFFICE ADMIN</p>
      </div>

      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-6">
        <div>
          <p className="text-slate-500 text-[10px] uppercase tracking-widest px-2 mb-2">
            Torneo activo
          </p>
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
          <div className="w-8 h-8 rounded-full bg-green-600 flex items-center justify-center text-white text-xs font-bold">
            JR
          </div>
          <div>
            <p className="text-white text-xs font-medium">Juan Rivera</p>
            <p className="text-slate-400 text-[10px]">Super Admin</p>
          </div>
        </div>
      </div>
    </aside>
  )
}
