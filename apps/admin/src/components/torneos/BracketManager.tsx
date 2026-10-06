'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  AlertCircle, ChevronLeft, Loader2, Swords, Wand2, RotateCcw, Medal, Info,
} from 'lucide-react'
import { clsx } from 'clsx'
import { BracketCanvas, roundLabel } from './BracketCanvas'
import {
  cupLabel,
  generateBracket,
  generateConsolationBracket,
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

// ─── Component ───────────────────────────────────────────────────────────────

export function BracketManager({ editionId, backHref, backLabel = 'Gestionar' }: Props) {
  const [slots, setSlots] = useState<BracketSlotFromApi[]>([])
  const [cups, setCups] = useState<string[]>([])
  const [activeCup, setActiveCup] = useState('main')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

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

  /**
   * Copa de consolación: la arman los perdedores de la primera ronda de esta
   * copa. No toca el cuadro actual, solo crea uno nuevo enlazado a él.
   */
  async function handleGenerateConsolation() {
    const nombre = prompt(
      'Nombre de la copa para los perdedores de la primera ronda (ej. "plata"):',
      'plata',
    )?.trim()
    if (!nombre) return

    setBusy('consolation')
    setError(null)
    try {
      const res = await generateConsolationBracket(editionId, nombre, activeCup, 1)
      await reload()
      setActiveCup(res.cupName)
      await reload(res.cupName)
      const partes = [`Copa "${res.cupName}" creada con ${res.bracketSize} lugares.`]
      if (res.backfilled > 0) {
        partes.push(`Ya bajaron ${res.backfilled} equipo(s) de llaves jugadas.`)
      } else {
        partes.push(
          `Los equipos entran a medida que se jueguen los partidos de ${roundLabel(1, totalRounds, hasByes).toLowerCase()}.`,
        )
      }
      if (res.byesInSource > 0) {
        partes.push(
          `Ojo: ${res.byesInSource} llave(s) de origen pasan sin jugar, así que no aportan perdedor y dejarán ese lugar vacío.`,
        )
      }
      setNotice(partes.join(' '))
    } catch (err) {
      setError(extractError(err) ?? 'Error al crear la copa de consolación.')
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

  // Una llave sin los dos equipos en la ronda 1 es un bye: el cabeza de serie
  // pasa sin jugar y la ronda se llama Repechaje.
  const hasByes = (rounds.get(1) ?? []).some((sl) => !sl.homeTeamId || !sl.awayTeamId)

  // Esta copa ya manda sus perdedores a otra: no se ofrece crear una segunda.
  const sendsLosersAway = (rounds.get(1) ?? []).some((sl) => sl.loserNextSlotId)

  // Estado de cada ronda, para ver de un vistazo en cuál va el campeonato.
  const roundStatus = new Map<number, { jugadas: number; total: number; estado: 'lista' | 'en_juego' | 'pendiente' }>()
  for (const rn of roundNumbers) {
    const rs = rounds.get(rn) ?? []
    const jugadas = rs.filter((sl) => sl.winnerId).length
    const listas = rs.filter((sl) => sl.homeTeamId && sl.awayTeamId).length
    roundStatus.set(rn, {
      jugadas,
      total: rs.length,
      estado: jugadas === rs.length ? 'lista' : listas > 0 ? 'en_juego' : 'pendiente',
    })
  }
  const rondaActual = roundNumbers.find((rn) => roundStatus.get(rn)!.estado !== 'lista') ?? null

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
          {hasBracket && !sendsLosersAway && (
            <button
              onClick={handleGenerateConsolation}
              disabled={busy !== null}
              title="Crea una copa aparte con los perdedores de la primera ronda de esta copa"
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-indigo-200 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 transition-colors disabled:opacity-50"
            >
              {busy === 'consolation'
                ? <Loader2 size={13} className="animate-spin" />
                : <Medal size={13} />}
              Copa de consolación
            </button>
          )}
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

      {/* Aviso de la copa de consolación recién creada */}
      {notice && (
        <div className="flex items-start gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-800 mb-4">
          <Info size={14} className="mt-0.5 shrink-0" />
          <span className="flex-1">{notice}</span>
          <button
            onClick={() => setNotice(null)}
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-900"
          >
            Entendido
          </button>
        </div>
      )}

      {/* Esta copa alimenta a otra: se dice, para que no sorprenda. */}
      {hasBracket && sendsLosersAway && (
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs text-slate-600 mb-4">
          <Medal size={13} className="text-indigo-600 shrink-0" />
          Los perdedores de {roundLabel(1, totalRounds, hasByes).toLowerCase()} pasan a la copa de
          consolación en lugar de quedar eliminados.
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
              {cupLabel(cups, cup)}
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

      {/* Rondas del campeonato: en cuál va y qué falta */}
      {hasBracket && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {roundNumbers.map((rn) => {
            const st = roundStatus.get(rn)!
            const actual = rn === rondaActual
            return (
              <div
                key={rn}
                className={clsx(
                  'flex items-center gap-2 rounded-xl border px-3 py-2',
                  actual
                    ? 'border-green-300 bg-green-50'
                    : st.estado === 'lista'
                      ? 'border-slate-200 bg-white'
                      : 'border-slate-200 bg-slate-50',
                )}
              >
                <span className={clsx(
                  'text-[11px] font-bold uppercase tracking-wide',
                  actual ? 'text-green-700' : st.estado === 'lista' ? 'text-slate-500' : 'text-slate-400',
                )}>
                  {roundLabel(rn, totalRounds, hasByes)}
                </span>
                <span className={clsx(
                  'rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums',
                  st.estado === 'lista' ? 'bg-slate-100 text-slate-500'
                    : actual ? 'bg-green-600 text-white' : 'bg-slate-200 text-slate-500',
                )}>
                  {st.jugadas}/{st.total}
                </span>
                {actual && <span className="text-[10px] font-semibold text-green-700">en juego</span>}
              </div>
            )
          })}
          {rondaActual === null && (
            <span className="text-[11px] font-semibold text-amber-700">Torneo definido</span>
          )}
        </div>
      )}

      {/* Cuadro */}
      {hasBracket && <BracketCanvas slots={slots} />}
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
