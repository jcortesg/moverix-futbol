'use client'

import { clsx } from 'clsx'
import { Plus, Trash2 } from 'lucide-react'
import type {
  EditionStatus,
  FormatType,
  PhaseGroups,
  PhaseRoundRobin,
  PhaseKnockout,
  PhaseMultiCup,
  CupConfig,
} from '@/lib/leagues'
import { Field, Toggle, inputCls } from '@/components/ui/form'

// ─── Constants ────────────────────────────────────────────────────────────────

export const STATUSES: {
  value: EditionStatus
  label: string
  desc: string
  color: string
  bg: string
  dot: string
}[] = [
  { value: 'draft',        label: 'Borrador',    desc: 'No publicada',       color: 'text-slate-600', bg: 'bg-slate-50 border-slate-200',  dot: 'bg-slate-400' },
  { value: 'registration', label: 'Inscripción', desc: 'Recibiendo equipos', color: 'text-blue-700',  bg: 'bg-blue-50 border-blue-300',    dot: 'bg-blue-500' },
  { value: 'active',       label: 'En curso',    desc: 'Torneo activo',      color: 'text-green-700', bg: 'bg-green-50 border-green-300',  dot: 'bg-green-500' },
  { value: 'finished',     label: 'Finalizado',  desc: 'Torneo terminado',   color: 'text-slate-500', bg: 'bg-slate-50 border-slate-200',  dot: 'bg-slate-300' },
]

export const FORMAT_TYPES: {
  value: FormatType
  label: string
  icon: string
  desc: string
  phase1: 'groups' | 'round_robin' | null
  phase2: 'knockout' | 'multi_cup' | null
}[] = [
  {
    value: 'groups_knockout',
    label: 'Grupos + Eliminatoria',
    icon: '⚽',
    desc: 'El más popular. Fase de grupos donde clasifican los mejores, luego eliminación directa.',
    phase1: 'groups',
    phase2: 'knockout',
  },
  {
    value: 'groups_multi_cup',
    label: 'Grupos + Multi-Copa',
    icon: '🏆',
    desc: 'Grupos → múltiples copas (A, B, C) según clasificación. Garantiza más partidos a todos.',
    phase1: 'groups',
    phase2: 'multi_cup',
  },
  {
    value: 'round_robin_playoffs',
    label: 'Todos vs Todos + Playoffs',
    icon: '🔄',
    desc: 'Todos los equipos se enfrentan entre sí. Los mejores avanzan a una fase de playoffs.',
    phase1: 'round_robin',
    phase2: 'knockout',
  },
  {
    value: 'knockout_only',
    label: 'Solo Eliminatoria',
    icon: '⚡',
    desc: 'Cuadro de eliminación directa desde el inicio. Ideal para torneos cortos o copas.',
    phase1: null,
    phase2: 'knockout',
  },
  {
    value: 'round_robin_only',
    label: 'Solo Liga',
    icon: '📋',
    desc: 'Todos contra todos. El que más puntos acumule gana. Formato de liga tradicional.',
    phase1: 'round_robin',
    phase2: null,
  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function seasonCodeFromDate(dateStr: string): string {
  const d = dateStr ? new Date(dateStr) : new Date()
  const year = d.getUTCFullYear()
  const half = d.getUTCMonth() < 6 ? 'I' : 'II'
  return `${year}-${half}`
}

// ─── Format sub-sections ──────────────────────────────────────────────────────

export function PhaseGroupsForm({
  value,
  onChange,
}: {
  value: PhaseGroups
  onChange: (v: PhaseGroups) => void
}) {
  function patch(p: Partial<PhaseGroups>) { onChange({ ...value, ...p }) }
  return (
    <div className="p-4 bg-blue-50 rounded-xl border border-blue-200 space-y-4">
      <p className="text-xs font-bold text-blue-700 uppercase tracking-wide">Fase 1 — Grupos</p>
      <div className="grid grid-cols-3 gap-3">
        <Field label="N° de grupos">
          <input type="number" min={1} className={inputCls} value={value.groupCount || ''} placeholder="4"
            onChange={(e) => patch({ groupCount: parseInt(e.target.value) || 1 })} />
        </Field>
        <Field label="Equipos por grupo">
          <input type="number" min={2} className={inputCls} value={value.teamsPerGroup || ''} placeholder="4"
            onChange={(e) => patch({ teamsPerGroup: parseInt(e.target.value) || 2 })} />
        </Field>
        <Field label="Clasifican por grupo">
          <input type="number" min={1} className={inputCls} value={value.qualifiersPerGroup || ''} placeholder="2"
            onChange={(e) => patch({ qualifiersPerGroup: parseInt(e.target.value) || 1 })} />
        </Field>
      </div>
      <Toggle
        checked={value.doubleLeg}
        onChange={(v) => patch({ doubleLeg: v })}
        label="Partidos de ida y vuelta"
        description="Cada enfrentamiento se juega dos veces: de local y de visitante."
      />
      {value.groupCount && value.teamsPerGroup ? (
        <p className="text-xs text-blue-600 bg-blue-100 rounded-lg px-3 py-2">
          Total: <strong>{value.groupCount * value.teamsPerGroup} equipos</strong> en {value.groupCount} grupos de {value.teamsPerGroup}.
          Clasifican <strong>{value.groupCount * (value.qualifiersPerGroup || 2)}</strong> a la siguiente fase.
        </p>
      ) : null}
    </div>
  )
}

export function PhaseRoundRobinForm({
  value,
  onChange,
}: {
  value: PhaseRoundRobin
  onChange: (v: PhaseRoundRobin) => void
}) {
  return (
    <div className="p-4 bg-blue-50 rounded-xl border border-blue-200 space-y-3">
      <p className="text-xs font-bold text-blue-700 uppercase tracking-wide">Fase 1 — Todos contra todos</p>
      <Toggle
        checked={value.doubleLeg}
        onChange={(v) => onChange({ ...value, doubleLeg: v })}
        label="Partidos de ida y vuelta"
        description="Cada par de equipos se enfrenta dos veces: local y visitante."
      />
    </div>
  )
}

export function PhaseKnockoutForm({
  value,
  onChange,
  label = 'Fase 2 — Eliminatoria',
}: {
  value: PhaseKnockout
  onChange: (v: PhaseKnockout) => void
  label?: string
}) {
  function patch(p: Partial<PhaseKnockout>) { onChange({ ...value, ...p }) }
  const BRACKET_SIZES = [4, 8, 16, 32, 64]
  return (
    <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-200 space-y-4">
      <p className="text-xs font-bold text-indigo-700 uppercase tracking-wide">{label}</p>
      <Field label="Equipos en el cuadro" hint="Potencia de 2. Los equipos clasificados ocupan las posiciones del bracket.">
        <div className="flex gap-2 flex-wrap">
          {BRACKET_SIZES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => patch({ bracketSize: s })}
              className={clsx(
                'px-4 py-2 rounded-xl border text-sm font-bold transition-all',
                value.bracketSize === s
                  ? 'border-indigo-500 bg-indigo-500 text-white'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-indigo-300',
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Toggle
          checked={value.hasThirdPlace}
          onChange={(v) => patch({ hasThirdPlace: v })}
          label="Partido por 3° lugar"
          description="Los perdedores de semifinales juegan por el bronce."
        />
        <Toggle
          checked={value.hasRepechage}
          onChange={(v) => patch({ hasRepechage: v })}
          label="Repechaje"
          description="Los eliminados en primera ronda tienen una segunda oportunidad."
        />
      </div>
    </div>
  )
}

export function PhaseMultiCupForm({
  value,
  onChange,
}: {
  value: PhaseMultiCup
  onChange: (v: PhaseMultiCup) => void
}) {
  function updateCup(i: number, patch: Partial<CupConfig>) {
    const cups = value.cups.map((c, idx) => idx === i ? { ...c, ...patch } : c)
    onChange({ ...value, cups })
  }
  function addCup() {
    const last = value.cups[value.cups.length - 1]
    const from = last ? last.to + 1 : 1
    onChange({ ...value, cups: [...value.cups, { name: `Copa ${String.fromCharCode(65 + value.cups.length)}`, from, to: from + 15, size: 16 }] })
  }
  function removeCup(i: number) {
    onChange({ ...value, cups: value.cups.filter((_, idx) => idx !== i) })
  }
  return (
    <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-200 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-indigo-700 uppercase tracking-wide">Fase 2 — Multi-Copa</p>
        <button
          type="button"
          onClick={addCup}
          className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-100 hover:bg-indigo-200 px-3 py-1.5 rounded-lg transition-colors"
        >
          <Plus size={12} /> Agregar copa
        </button>
      </div>
      <p className="text-xs text-indigo-600 bg-indigo-100 rounded-lg px-3 py-2">
        Los equipos se distribuyen en copas según su posición final en grupos. Cada copa juega su propia eliminatoria.
      </p>
      {value.cups.length === 0 && (
        <p className="text-xs text-slate-400 text-center py-4">No hay copas. Agrega la primera.</p>
      )}
      <div className="space-y-3">
        {value.cups.map((cup, i) => (
          <div key={i} className="bg-white rounded-xl border border-indigo-200 p-4">
            <div className="flex items-center gap-2 mb-3">
              <input
                className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-bold text-slate-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200"
                value={cup.name}
                onChange={(e) => updateCup(i, { name: e.target.value })}
                placeholder="Copa A"
              />
              <button type="button" onClick={() => removeCup(i)} className="text-slate-300 hover:text-red-500 transition-colors p-1">
                <Trash2 size={14} />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Desde posición">
                <input type="number" min={1} className={inputCls} value={cup.from} onChange={(e) => updateCup(i, { from: parseInt(e.target.value) || 1 })} />
              </Field>
              <Field label="Hasta posición">
                <input type="number" min={1} className={inputCls} value={cup.to} onChange={(e) => updateCup(i, { to: parseInt(e.target.value) || 1 })} />
              </Field>
              <Field label="Equipos en bracket">
                <input type="number" min={2} className={inputCls} value={cup.size} onChange={(e) => updateCup(i, { size: parseInt(e.target.value) || 2 })} />
              </Field>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
