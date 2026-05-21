'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  AlertCircle, ChevronLeft, Loader2, Swords, Wand2, Trophy,
  RotateCcw, Shield,
} from 'lucide-react'
import { clsx } from 'clsx'
import {
  generateBracket,
  getBracket,
  getBracketCups,
  resetBracket,
  type BracketSlotFromApi,
} from '@/lib/brackets'

type Props = {
  editionId: string
  backHref?: string
  backLabel?: string
}

// ─── Round labels ────────────────────────────────────────────────────────────

function roundLabel(round: number, totalRounds: number): string {
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

// ─── Component ───────────────────────────────────────────────────────────────

export function BracketManager({ editionId, backHref, backLabel = 'Gestionar' }: Props) {
  const [slots, setSlots] = useState<BracketSlotFromApi[]>([])
  const [cups, setCups] = useState<string[]>([])
  const [activeCup, setActiveCup] = useState('main')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async (cup?: string) => {
    try {
      const c = cup ?? activeCup
      const [s, allCups] = await Promise.all([
        getBracket(editionId, c),
        getBracketCups(editionId),
      ])
      setSlots(s)
      setCups(allCups)
    } catch {
      // no bracket yet — that's fine
      setSlots([])
    }
  }, [editionId, activeCup])

  useEffect(() => {
    reload().finally(() => setLoading(false))
  }, [reload])

  async function handleGenerate() {
    setBusy('generating')
    setError(null)
    try {
      await generateBracket(editionId, activeCup === 'main' ? undefined : activeCup)
      await reload()
    } catch (err) {
      setError(extractError(err) ?? 'Error al generar el bracket.')
    } finally {
      setBusy(null)
    }
  }

  async function handleReset() {
    if (!confirm('¿Estás seguro? Esto elimina el bracket y sus partidos asociados.')) return
    setBusy('resetting')
    setError(null)
    try {
      await resetBracket(editionId, activeCup)
      await reload()
    } catch (err) {
      setError(extractError(err) ?? 'Error al resetear.')
    } finally {
      setBusy(null)
    }
  }

  // ─── Group slots by round ──────────────────────────────────────────────────

  const rounds = new Map<number, BracketSlotFromApi[]>()
  for (const slot of slots) {
    if (!rounds.has(slot.round)) rounds.set(slot.round, [])
    rounds.get(slot.round)!.push(slot)
  }
  const roundNumbers = [...rounds.keys()].sort((a, b) => a - b)
  const totalRounds = roundNumbers.length > 0 ? Math.max(...roundNumbers) : 0
  const hasBracket = slots.length > 0

  // ─── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-3 py-32 text-slate-400">
        <Loader2 size={22} className="animate-spin" />
        <span className="text-sm">Cargando bracket...</span>
      </div>
    )
  }

  return (
    <div>
      {/* Breadcrumb */}
      <div className="flex items-center gap-3 mb-6">
        <Link
          href={backHref ?? `/torneos/edicion/${editionId}/gestionar`}
          className="flex items-center gap-1 text-sm text-slate-400 hover:text-slate-700 transition-colors"
        >
          <ChevronLeft size={15} />
          <span>{backLabel}</span>
        </Link>
        <span className="text-slate-300">/</span>
        <span className="text-sm font-semibold text-slate-900">Bracket</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center">
            <Swords size={18} className="text-indigo-700" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900">Fase eliminatoria</h1>
            <p className="text-xs text-slate-400">
              {hasBracket
                ? `${slots.length} llaves · ${totalRounds} rondas`
                : 'Sin bracket generado'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hasBracket && (
            <button
              onClick={handleReset}
              disabled={busy !== null}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-red-200 text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
            >
              <RotateCcw size={13} />
              Resetear
            </button>
          )}
          {!hasBracket && (
            <button
              onClick={handleGenerate}
              disabled={busy !== null}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-green-600 text-white text-sm font-bold hover:bg-green-700 transition-colors shadow-sm disabled:opacity-50"
            >
              {busy === 'generating' ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
              Generar llaves
            </button>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 mb-4">
          <AlertCircle size={14} /> {error}
        </div>
      )}

      {/* Cup tabs (for multi-cup) */}
      {cups.length > 1 && (
        <div className="flex items-center gap-2 mb-4">
          {cups.map((cup) => (
            <button
              key={cup}
              onClick={() => { setActiveCup(cup); reload(cup) }}
              className={clsx(
                'px-3 py-1.5 rounded-lg text-xs font-bold transition-colors',
                cup === activeCup
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
              )}
            >
              {cup === 'main' ? 'Principal' : cup.replace(/^cup_/, '').replace(/_/g, ' ')}
            </button>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!hasBracket && (
        <div className="flex flex-col items-center justify-center gap-3 py-16 bg-white rounded-2xl border-2 border-dashed border-slate-200">
          <Swords size={28} className="text-slate-300" />
          <p className="text-sm font-semibold text-slate-500">No hay bracket generado</p>
          <p className="text-xs text-slate-400 max-w-sm text-center">
            Completa la fase de grupos y luego genera las llaves eliminatorias desde los equipos clasificados.
          </p>
        </div>
      )}

      {/* Bracket visualization */}
      {hasBracket && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-x-auto">
          <div className="flex gap-0 min-w-max p-6">
            {roundNumbers.map((roundNum, rIdx) => {
              const roundSlots = rounds.get(roundNum) ?? []
              const label = roundLabel(roundNum, totalRounds)
              const isFinal = roundNum === totalRounds

              return (
                <div key={roundNum} className="flex flex-col items-center" style={{ minWidth: 220 }}>
                  {/* Round header */}
                  <div className={clsx(
                    'text-[10px] font-bold uppercase tracking-widest mb-4 px-3 py-1 rounded-full',
                    isFinal
                      ? 'bg-amber-100 text-amber-700 border border-amber-200'
                      : 'bg-slate-100 text-slate-500',
                  )}>
                    {isFinal && <Trophy size={10} className="inline mr-1 -mt-0.5" />}
                    {label}
                  </div>

                  {/* Slots */}
                  <div
                    className="flex flex-col justify-around flex-1 gap-2"
                    style={{ minHeight: roundSlots.length * 90 }}
                  >
                    {roundSlots.map((slot) => (
                      <SlotCard key={slot.id} slot={slot} isFinal={isFinal} />
                    ))}
                  </div>

                  {/* Connector lines between rounds */}
                  {rIdx < roundNumbers.length - 1 && (
                    <div className="w-px" />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Slot Card ───────────────────────────────────────────────────────────────

function SlotCard({ slot, isFinal }: { slot: BracketSlotFromApi; isFinal: boolean }) {
  const isFinished = slot.matchStatus === 'finished'
  const hasTeams = slot.homeTeamId || slot.awayTeamId

  if (!hasTeams) {
    return (
      <div className="w-48 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50 px-3 py-3 flex items-center justify-center">
        <span className="text-[11px] text-slate-300 italic">Por definir</span>
      </div>
    )
  }

  return (
    <div className={clsx(
      'w-48 rounded-xl border overflow-hidden transition-shadow',
      isFinal ? 'border-amber-200 shadow-md' : 'border-slate-200',
      isFinished ? 'bg-white' : 'bg-white',
    )}>
      {/* Home team */}
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
      {/* Away team */}
      <TeamRow
        name={slot.awayTeamName ?? null}
        logoUrl={slot.awayTeamLogoUrl ?? null}
        score={slot.awayScore ?? null}
        penalties={slot.awayPenalties ?? null}
        isWinner={slot.winnerId === slot.awayTeamId && slot.winnerId !== null}
        isFinished={isFinished}
        isEmpty={!slot.awayTeamId}
      />
    </div>
  )
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
      <div className="flex items-center gap-2 px-3 py-2.5 min-h-[38px]">
        <span className="text-[11px] text-slate-300 italic">Por definir</span>
      </div>
    )
  }

  return (
    <div className={clsx(
      'flex items-center gap-2 px-3 py-2.5 min-h-[38px] transition-colors',
      isWinner && isFinished && 'bg-green-50',
      !isWinner && isFinished && 'opacity-50',
    )}>
      {/* Logo */}
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt="" className="w-5 h-5 rounded-md object-cover flex-shrink-0" />
      ) : (
        <div className="w-5 h-5 rounded-md bg-slate-100 flex items-center justify-center flex-shrink-0">
          <Shield size={10} className="text-slate-400" />
        </div>
      )}

      {/* Name */}
      <span className={clsx(
        'text-xs truncate flex-1',
        isWinner && isFinished ? 'font-bold text-green-800' : 'font-medium text-slate-700',
      )}>
        {name ?? '?'}
      </span>

      {/* Score */}
      {score !== null && (
        <span className={clsx(
          'text-sm tabular-nums font-bold min-w-[18px] text-center',
          isWinner && isFinished ? 'text-green-700' : 'text-slate-600',
        )}>
          {score}
        </span>
      )}

      {/* Penalties */}
      {penalties !== null && (
        <span className="text-[10px] text-slate-400 font-mono">
          ({penalties})
        </span>
      )}

      {/* Winner indicator */}
      {isWinner && isFinished && (
        <Trophy size={11} className="text-amber-500 flex-shrink-0" />
      )}
    </div>
  )
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function extractError(err: unknown): string | null {
  if (typeof err !== 'object' || err === null) return null
  const maybeAxios = err as { response?: { data?: { message?: string | string[] } } }
  const msg = maybeAxios.response?.data?.message
  if (!msg) return null
  return Array.isArray(msg) ? msg[0] ?? null : msg
}
