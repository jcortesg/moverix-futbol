'use client'

import Link from 'next/link'
import { Loader2, Trophy } from 'lucide-react'
import { useActiveEdition } from '@/contexts/ActiveEditionContext'

export function ActiveEditionRequired({
  children,
  moduleLabel,
}: {
  children: (editionId: string) => React.ReactNode
  moduleLabel: string
}) {
  const { activeEdition, ready } = useActiveEdition()

  if (!ready) {
    return (
      <div className="flex items-center justify-center gap-3 py-32 text-slate-400">
        <Loader2 size={22} className="animate-spin" />
        <span className="text-sm">Cargando...</span>
      </div>
    )
  }

  if (!activeEdition) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24 bg-white rounded-2xl border-2 border-dashed border-slate-200">
        <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center">
          <Trophy size={26} className="text-slate-300" />
        </div>
        <div className="text-center max-w-xs">
          <p className="text-sm font-semibold text-slate-700">
            No hay torneo activo
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Selecciona un torneo para ver {moduleLabel}.
          </p>
        </div>
        <Link
          href="/torneos"
          className="px-4 py-2 bg-green-600 text-white text-sm font-bold rounded-xl hover:bg-green-700 transition-all shadow-sm"
        >
          Ir a torneos
        </Link>
      </div>
    )
  }

  return <>{children(activeEdition.id)}</>
}
