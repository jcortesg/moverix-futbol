'use client'

import { useEffect, useState } from 'react'
import clsx from 'clsx'
import { BracketCanvas } from './BracketCanvas'
import { cupLabel, getBracket, getBracketCups, type BracketSlotFromApi } from '@/lib/brackets'

/**
 * Cuadro de SOLO LECTURA con pestañas por copa (Copa A, Copa B, …). Lo usan
 * Tabla de posiciones y Grupos y llaves; generar o resetear sigue en Fase
 * eliminatoria. `mainSlots` es la copa principal que la pantalla ya cargó para
 * decidir si muestra la sección; las demás se piden al elegirlas.
 */
export function CupsBracketView({ editionId, mainSlots }: {
  editionId: string
  mainSlots: BracketSlotFromApi[]
}) {
  const [cups, setCups] = useState<string[]>([])
  const [active, setActive] = useState('main')
  const [slots, setSlots] = useState<BracketSlotFromApi[]>(mainSlots)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    getBracketCups(editionId).then(setCups).catch(() => setCups([]))
  }, [editionId])

  useEffect(() => {
    if (active === 'main') {
      setSlots(mainSlots)
      return
    }
    let vigente = true
    setLoading(true)
    getBracket(editionId, active)
      .then((s) => { if (vigente) setSlots(s) })
      .catch(() => { if (vigente) setSlots([]) })
      .finally(() => { if (vigente) setLoading(false) })
    return () => { vigente = false }
  }, [editionId, active, mainSlots])

  return (
    <div className="space-y-3">
      {cups.length > 1 && (
        <div className="flex items-center gap-2">
          {cups.map((cup) => (
            <button
              key={cup}
              type="button"
              onClick={() => setActive(cup)}
              className={clsx(
                'px-3 py-1.5 rounded-lg text-xs font-bold transition-colors',
                cup === active
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
              )}
            >
              {cupLabel(cups, cup)}
            </button>
          ))}
        </div>
      )}
      {loading ? (
        <p className="py-10 text-center text-xs text-slate-400">Cargando cuadro…</p>
      ) : (
        <BracketCanvas slots={slots} />
      )}
    </div>
  )
}
