'use client'

import { ActiveEditionRequired } from '@/components/torneos/ActiveEditionRequired'
import { TablaManager } from '@/components/torneos/TablaManager'

export default function TablaPage() {
  return (
    <ActiveEditionRequired moduleLabel="la tabla de posiciones">
      {(editionId) => (
        <TablaManager
          editionId={editionId}
          backHref="/"
          backLabel="Torneo activo"
        />
      )}
    </ActiveEditionRequired>
  )
}
