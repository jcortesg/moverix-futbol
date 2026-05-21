'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { AlertCircle } from 'lucide-react'
import { EditionCreateWizard } from '@/components/torneos/EditionCreateWizard'

export default function NuevaEdicionPage() {
  const leagueId = useSearchParams().get('leagueId')

  if (!leagueId) {
    return (
      <div className="flex flex-col items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
        <div className="flex items-center gap-2">
          <AlertCircle size={16} />
          Falta el parámetro <code className="font-mono">leagueId</code>.
        </div>
        <Link href="/torneos" className="text-xs font-semibold text-red-700 underline">
          Volver a Torneos
        </Link>
      </div>
    )
  }

  return <EditionCreateWizard leagueId={leagueId} />
}
