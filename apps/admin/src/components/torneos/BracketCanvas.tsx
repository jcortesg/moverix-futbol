'use client'

/**
 * El cuadro de llaves dibujado: rondas, tarjetas y conectores.
 *
 * Va aparte de BracketManager porque se muestra en dos sitios — la pantalla de
 * la fase eliminatoria, con sus acciones, y la pestaña Llaves de la tabla de
 * posiciones, que es de solo lectura.
 */
import { Trophy, Shield, Calendar, MapPin } from 'lucide-react'
import { clsx } from 'clsx'
import {
  CARD_H, CARD_W, CHANNEL, COL_W, HEADER_H, META_H, buildLayout,
} from '@/lib/bracket-layout'
import type { BracketSlotFromApi } from '@/lib/brackets'

/** Con byes la primera ronda es un repechaje, no "16avos" — igual que la API. */
export function roundLabel(round: number, totalRounds: number, hasByes = false): string {
  if (round === 1 && hasByes) return 'Repechaje'
  const fromFinal = totalRounds - round
  switch (fromFinal) {
    case 0: return 'Final'
    case 1: return 'Semifinales'
    case 2: return 'Cuartos'
    case 3: return 'Octavos'
    case 4: return '16avos'
    default: return `Ronda ${round}`
  }
}

export function BracketCanvas({ slots }: { slots: BracketSlotFromApi[] }) {
  const layout = buildLayout(slots)
  const colX = (round: number) => layout.rounds.indexOf(round) * COL_W
  const totalRounds = layout.rounds.length ? layout.rounds[layout.rounds.length - 1] : 0

  const firstRound = layout.rounds[0]
  const hasByes = slots
    .filter((s) => s.round === firstRound)
    .some((s) => !s.homeTeamId || !s.awayTeamId)

  // Conectores: del borde de cada llave al canal, y del canal a la siguiente.
  const connectors: React.ReactElement[] = []
  for (const slot of slots) {
    const kids = layout.childrenOf.get(slot.id) ?? []
    if (kids.length === 0) continue

    const parentX = colX(slot.round)
    const midX = parentX - CHANNEL / 2
    const parentY = HEADER_H + (layout.center.get(slot.id) ?? 0)
    const kidYs: number[] = []

    for (const kid of kids) {
      const kidY = HEADER_H + (layout.center.get(kid.id) ?? 0)
      kidYs.push(kidY)
      const kidRight = colX(kid.round) + CARD_W
      connectors.push(
        <div
          key={`h-${kid.id}`}
          className={clsx('absolute h-px', kid.winnerId ? 'bg-green-400' : 'bg-slate-200')}
          style={{ left: kidRight, top: kidY, width: Math.max(0, midX - kidRight) }}
        />,
      )
    }

    if (kidYs.length > 1) {
      const top = Math.min(...kidYs)
      connectors.push(
        <div
          key={`v-${slot.id}`}
          className="absolute w-px bg-slate-200"
          style={{ left: midX, top, height: Math.max(...kidYs) - top }}
        />,
      )
    }

    connectors.push(
      <div
        key={`p-${slot.id}`}
        className={clsx(
          'absolute h-px',
          slot.homeTeamId || slot.awayTeamId ? 'bg-green-400' : 'bg-slate-200',
        )}
        style={{ left: midX, top: parentY, width: Math.max(0, parentX - midX) }}
      />,
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-x-auto">
      <div className="inline-block p-6">
        <div className="relative" style={{ width: layout.width, height: layout.height }}>
          {connectors}

          {/* Cabecera de cada ronda */}
          {layout.rounds.map((rn) => {
            const isFinal = rn === totalRounds
            return (
              <div
                key={`head-${rn}`}
                className="absolute top-0 flex items-center justify-center"
                style={{ left: colX(rn), width: CARD_W, height: HEADER_H }}
              >
                <span className={clsx(
                  'text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full',
                  isFinal
                    ? 'bg-amber-100 text-amber-700 border border-amber-200'
                    : 'bg-slate-100 text-slate-500',
                )}>
                  {isFinal && <Trophy size={10} className="inline mr-1 -mt-0.5" />}
                  {roundLabel(rn, totalRounds, hasByes)}
                </span>
              </div>
            )
          })}

          {/* Llaves */}
          {slots.map((slot) => (
            <div
              key={slot.id}
              className="absolute"
              style={{
                left: colX(slot.round),
                top: HEADER_H + (layout.center.get(slot.id) ?? 0) - CARD_H / 2,
              }}
            >
              <SlotCard slot={slot} isFinal={slot.round === totalRounds} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Slot Card ───────────────────────────────────────────────────────────────

function SlotCard({ slot, isFinal }: { slot: BracketSlotFromApi; isFinal: boolean }) {
  const isFinished = slot.matchStatus === 'finished'
  const hasTeams = slot.homeTeamId || slot.awayTeamId

  // La altura es fija: el cuadro calcula las posiciones con ella, así que la
  // franja del fixture se reserva aunque el partido aún no tenga fecha.
  if (!hasTeams) {
    return (
      <div
        className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50 flex items-center justify-center"
        style={{ width: CARD_W, height: CARD_H }}
      >
        <span className="text-[11px] text-slate-300 italic">Por definir</span>
      </div>
    )
  }

  return (
    <div
      className={clsx(
        'flex flex-col rounded-xl border overflow-hidden bg-white',
        isFinal ? 'border-amber-300 shadow-md' : 'border-slate-200',
      )}
      style={{ width: CARD_W, height: CARD_H }}
    >
      <TeamRow
        name={slot.homeTeamName ?? null}
        logoUrl={slot.homeTeamLogoUrl ?? null}
        score={slot.homeScore ?? null}
        penalties={slot.homePenalties ?? null}
        isWinner={slot.winnerId === slot.homeTeamId && slot.winnerId !== null}
        isFinished={isFinished}
        isEmpty={!slot.homeTeamId}
      />
      <div className="border-t border-slate-100" />
      <TeamRow
        name={slot.awayTeamName ?? null}
        logoUrl={slot.awayTeamLogoUrl ?? null}
        score={slot.awayScore ?? null}
        penalties={slot.awayPenalties ?? null}
        isWinner={slot.winnerId === slot.awayTeamId && slot.winnerId !== null}
        isFinished={isFinished}
        isEmpty={!slot.awayTeamId}
      />

      {/* Fixture: cuándo y dónde se juega */}
      <div
        className="border-t border-slate-100 bg-slate-50/70 px-2.5 flex flex-col justify-center"
        style={{ height: META_H }}
      >
        {slot.scheduledAt ? (
          <div className="flex items-center gap-1 text-[10px] text-slate-500">
            <Calendar size={9} className="shrink-0" />
            <span className="tabular-nums truncate">{formatKickoff(slot.scheduledAt)}</span>
          </div>
        ) : (
          <div className="flex items-center gap-1 text-[10px] font-semibold text-amber-600">
            <Calendar size={9} className="shrink-0" />
            <span>Sin programar</span>
          </div>
        )}
        {slot.venueName && (
          <div className="flex items-center gap-1 text-[10px] text-slate-400">
            <MapPin size={9} className="shrink-0" />
            <span className="truncate">{slot.venueName}</span>
          </div>
        )}
      </div>
    </div>
  )
}

/** "vie 12 sep · 5:30 p. m." — hora de Bogotá, que es donde se juega. */
function formatKickoff(iso: string) {
  const d = new Date(iso)
  const fecha = d.toLocaleDateString('es-CO', {
    weekday: 'short', day: 'numeric', month: 'short', timeZone: 'America/Bogota',
  })
  const hora = d.toLocaleTimeString('es-CO', {
    hour: 'numeric', minute: '2-digit', timeZone: 'America/Bogota',
  })
  return `${fecha} · ${hora}`
}

function TeamRow({
  name, logoUrl, score, penalties, isWinner, isFinished, isEmpty,
}: {
  name: string | null
  logoUrl: string | null
  score: number | null
  penalties: number | null
  isWinner: boolean
  isFinished: boolean
  isEmpty: boolean
}) {
  if (isEmpty) {
    return (
      <div className="flex flex-1 items-center gap-2 px-3">
        <span className="text-[11px] text-slate-300 italic">Por definir</span>
      </div>
    )
  }

  return (
    <div className={clsx(
      'flex flex-1 items-center gap-2 px-3 transition-colors',
      isWinner && isFinished && 'bg-green-50',
      !isWinner && isFinished && 'opacity-50',
    )}>
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt="" className="w-5 h-5 rounded-md object-cover flex-shrink-0" />
      ) : (
        <div className="w-5 h-5 rounded-md bg-slate-100 flex items-center justify-center flex-shrink-0">
          <Shield size={10} className="text-slate-400" />
        </div>
      )}

      <span className={clsx(
        'text-xs truncate flex-1',
        isWinner && isFinished ? 'font-bold text-green-800' : 'font-medium text-slate-700',
      )}>
        {name ?? '?'}
      </span>

      {penalties !== null && (
        <span className="text-[10px] text-slate-400 font-mono">({penalties})</span>
      )}

      {score !== null && (
        <span className={clsx(
          'text-sm tabular-nums font-bold min-w-[18px] text-center',
          isWinner && isFinished ? 'text-green-700' : 'text-slate-600',
        )}>
          {score}
        </span>
      )}

      {isWinner && isFinished && (
        <Trophy size={11} className="text-amber-500 flex-shrink-0" />
      )}
    </div>
  )
}
