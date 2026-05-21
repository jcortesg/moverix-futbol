'use client'

import { ActiveEditionRequired } from '@/components/torneos/ActiveEditionRequired'
import { PartidosManager } from '@/components/torneos/PartidosManager'

export default function PartidosPage() {
  return (
    <ActiveEditionRequired moduleLabel="los partidos">
      {(editionId) => (
        <PartidosManager
          editionId={editionId}
          backHref="/"
          backLabel="Torneo activo"
        />
      )}
    </ActiveEditionRequired>
  )
}
