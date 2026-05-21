'use client'

import { ActiveEditionRequired } from '@/components/torneos/ActiveEditionRequired'
import { GruposManager } from '@/components/torneos/GruposManager'

export default function GruposLlavesPage() {
  return (
    <ActiveEditionRequired moduleLabel="los grupos">
      {(editionId) => (
        <GruposManager
          editionId={editionId}
          backHref="/"
          backLabel="Torneo activo"
        />
      )}
    </ActiveEditionRequired>
  )
}
