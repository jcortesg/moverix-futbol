'use client'

import { ActiveEditionRequired } from '@/components/torneos/ActiveEditionRequired'
import { PagosManager } from '@/components/torneos/PagosManager'

export default function PagosPage() {
  return (
    <ActiveEditionRequired moduleLabel="los pagos">
      {(editionId) => (
        <PagosManager
          editionId={editionId}
          backHref="/"
          backLabel="Torneo activo"
        />
      )}
    </ActiveEditionRequired>
  )
}
