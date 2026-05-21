'use client'

import { ActiveEditionRequired } from '@/components/torneos/ActiveEditionRequired'
import { EquiposManager } from '@/components/torneos/EquiposManager'

export default function EquiposPage() {
  return (
    <ActiveEditionRequired moduleLabel="sus equipos">
      {(editionId) => (
        <EquiposManager
          editionId={editionId}
          backHref="/"
          backLabel="Torneo activo"
        />
      )}
    </ActiveEditionRequired>
  )
}
