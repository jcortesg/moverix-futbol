'use client'

import { clsx } from 'clsx'
import { ChevronDown, Plus, Trash2, ArrowUp, ArrowDown } from 'lucide-react'
import type {
  EditionStatus,
  FormatConfig,
  FormatType,
  PhaseConfig,
  PhaseKind,
  PhaseGroups,
  PhaseRoundRobin,
  PhaseKnockout,
  PhaseMultiCup,
  CupConfig,
  CupDistribution,
  CupFormat,
  CupGroupsConfig,
} from '@/lib/leagues'
import { CUP_DISTRIBUTION_LABEL, PHASE_KIND_LABEL } from '@/lib/leagues'
import {
  FORMAT_TEMPLATES,
  buildPrefill,
  buildPhaseDefault,
  deriveFormatType,
  computeGroupDefaults,
} from '@/lib/format-defaults'
import { Field, Toggle, inputCls } from '@/components/ui/form'

export { FORMAT_TEMPLATES }

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function seasonCodeFromDate(dateStr: string): string {
  const d = dateStr ? new Date(dateStr) : new Date()
  const year = d.getUTCFullYear()
  const half = d.getUTCMonth() < 6 ? 'I' : 'II'
  return `${year}-${half}`
}

const ALL_PHASE_KINDS: PhaseKind[] = ['groups', 'round_robin', 'knockout', 'multi_cup']

// ─── Phase sub-forms ─────────────────────────────────────────────────────────

export function PhaseGroupsForm({
  value,
  onChange,
  isMultiCup,
  maxTeams,
  label = 'Grupos',
}: {
  value: PhaseGroups
  onChange: (v: PhaseGroups) => void
  isMultiCup?: boolean
  maxTeams?: number
  label?: string
}) {
  function patch(p: Partial<PhaseGroups>) { onChange({ ...value, ...p }) }

  function handleGroupCountChange(gc: number) {
    if (maxTeams && gc > 0) {
      const { teamsPerGroup } = computeGroupDefaults(maxTeams, gc)
      const qualifiersPerGroup = isMultiCup ? 0 : Math.min(value.qualifiersPerGroup || 2, teamsPerGroup)
      patch({ groupCount: gc, teamsPerGroup, qualifiersPerGroup })
    } else {
      patch({ groupCount: gc })
    }
  }

  function handleTeamsPerGroupChange(tpg: number) {
    if (maxTeams && tpg > 0) {
      const gc = Math.max(1, Math.ceil(maxTeams / tpg))
      const qualifiersPerGroup = isMultiCup ? 0 : Math.min(value.qualifiersPerGroup || 2, tpg)
      patch({ teamsPerGroup: tpg, groupCount: gc, qualifiersPerGroup })
    } else {
      patch({ teamsPerGroup: tpg })
    }
  }

  const totalSlots = value.groupCount && value.teamsPerGroup ? value.groupCount * value.teamsPerGroup : 0
  const remainder = maxTeams && value.groupCount ? maxTeams % value.groupCount : 0

  return (
    <div className="space-y-4">
      <p className="text-xs font-bold text-blue-700 uppercase tracking-wide">{label}</p>
      <div className={clsx('grid gap-3', isMultiCup ? 'grid-cols-2' : 'grid-cols-3')}>
        <Field label="N° de grupos">
          <input type="number" min={1} className={inputCls} value={value.groupCount || ''} placeholder="4"
            onChange={(e) => handleGroupCountChange(parseInt(e.target.value) || 1)} />
        </Field>
        <Field label="Equipos por grupo">
          <input type="number" min={2} className={inputCls} value={value.teamsPerGroup || ''} placeholder="4"
            onChange={(e) => handleTeamsPerGroupChange(parseInt(e.target.value) || 2)} />
        </Field>
        {!isMultiCup && (
          <Field label="Clasifican por grupo">
            <input type="number" min={1} className={inputCls} value={value.qualifiersPerGroup || ''} placeholder="2"
              onChange={(e) => patch({ qualifiersPerGroup: parseInt(e.target.value) || 1 })} />
          </Field>
        )}
      </div>
      <Toggle
        checked={value.doubleLeg}
        onChange={(v) => patch({ doubleLeg: v })}
        label="Partidos de ida y vuelta"
        description="Cada enfrentamiento se juega dos veces: de local y de visitante."
      />
      {value.groupCount && value.teamsPerGroup ? (
        <div className="text-xs text-blue-600 bg-blue-100 rounded-lg px-3 py-2 space-y-1">
          <p>
            Total: <strong>{totalSlots} equipos</strong> en {value.groupCount} grupos de {value.teamsPerGroup}.
            {!isMultiCup && <> Clasifican <strong>{value.groupCount * (value.qualifiersPerGroup || 2)}</strong> a la siguiente fase.</>}
            {isMultiCup && <> Todos clasifican a las copas de la siguiente fase.</>}
          </p>
          {maxTeams && remainder > 0 && (
            <p className="text-blue-500">
              {maxTeams} equipos / {value.groupCount} grupos = {remainder} grupo{remainder > 1 ? 's' : ''} de {value.teamsPerGroup + 1} y {value.groupCount - remainder} de {value.teamsPerGroup}
            </p>
          )}
          {maxTeams && totalSlots !== maxTeams && remainder === 0 && (
            <p className="text-amber-600">
              Capacidad del torneo: {maxTeams} equipos — slots en grupos: {totalSlots}
            </p>
          )}
        </div>
      ) : null}
    </div>
  )
}

export function PhaseRoundRobinForm({
  value,
  onChange,
  label = 'Todos contra todos',
}: {
  value: PhaseRoundRobin
  onChange: (v: PhaseRoundRobin) => void
  label?: string
}) {
  return (
    <div className="space-y-3">
      <p className="text-xs font-bold text-blue-700 uppercase tracking-wide">{label}</p>
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
  label = 'Eliminatoria',
}: {
  value: PhaseKnockout
  onChange: (v: PhaseKnockout) => void
  label?: string
}) {
  function patch(p: Partial<PhaseKnockout>) { onChange({ ...value, ...p }) }
  const BRACKET_SIZES = [4, 8, 16, 32, 64]
  return (
    <div className="space-y-4">
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

// Cup logic functions
function nearestPowerOf2(n: number): number {
  let p = 2
  while (p < n) p *= 2
  return p
}

function cupTeams(cup: { from: number; to: number }, distribution: CupDistribution, groupCount: number): number {
  const positions = cup.to - cup.from + 1
  if (positions <= 0) return 0
  return distribution === 'group_position' ? positions * groupCount : positions
}

function buildDefaultCups(
  groupCount: number,
  teamsPerGroup: number,
  distribution: CupDistribution,
): CupConfig[] {
  if (groupCount <= 0 || teamsPerGroup <= 0) return []
  const totalQualified = groupCount * teamsPerGroup
  if (distribution === 'group_position') {
    const cups: CupConfig[] = []
    let pos = 1
    while (pos <= teamsPerGroup) {
      const bandSize = Math.min(2, teamsPerGroup - pos + 1)
      const to = pos + bandSize - 1
      const teams = bandSize * groupCount
      cups.push({ name: `Copa ${String.fromCharCode(65 + cups.length)}`, from: pos, to, size: nearestPowerOf2(teams) })
      pos = to + 1
    }
    return cups
  }
  const topTeams = nearestPowerOf2(Math.ceil(totalQualified * 0.65))
  const top = Math.min(topTeams, totalQualified)
  const rest = totalQualified - top
  const cups: CupConfig[] = [{ name: 'Copa A', from: 1, to: top, size: nearestPowerOf2(top) }]
  if (rest > 0) cups.push({ name: 'Copa B', from: top + 1, to: totalQualified, size: nearestPowerOf2(rest) })
  return cups
}

export function PhaseMultiCupForm({
  value,
  onChange,
  precedingPhases = [],
}: {
  value: PhaseMultiCup
  onChange: (v: PhaseMultiCup) => void
  precedingPhases?: PhaseConfig[]
}) {
  const groupsPhase = precedingPhases.findLast((p) => p.kind === 'groups') as PhaseGroups | undefined
  const groupCount = groupsPhase?.groupCount ?? 0
  const teamsPerGroup = groupsPhase?.teamsPerGroup ?? 0
  const qualifiersPerGroup = teamsPerGroup
  const totalQualified = groupCount * qualifiersPerGroup
  const dist: CupDistribution = value.distribution ?? 'reclassification'
  const maxPos = dist === 'group_position' ? qualifiersPerGroup : totalQualified

  function teamsFor(cup: CupConfig): number {
    return cupTeams(cup, dist, groupCount)
  }

  function updateCup(i: number, patch: Partial<CupConfig>) {
    const updated = { ...value.cups[i], ...patch }
    if ('from' in patch || 'to' in patch) {
      const teams = cupTeams(updated, dist, groupCount)
      if (teams > 0) updated.size = nearestPowerOf2(teams)
    }
    const cups = value.cups.map((c, idx) => idx === i ? updated : c)
    onChange({ ...value, cups })
  }
  function addCup() {
    const last = value.cups[value.cups.length - 1]
    const from = last ? last.to + 1 : 1
    const to = dist === 'group_position' ? Math.min(from + 1, maxPos) : Math.min(from + 15, maxPos)
    const teams = cupTeams({ from, to }, dist, groupCount)
    onChange({ ...value, cups: [...value.cups, { name: `Copa ${String.fromCharCode(65 + value.cups.length)}`, from, to, size: nearestPowerOf2(Math.max(2, teams)) }] })
  }
  function removeCup(i: number) {
    onChange({ ...value, cups: value.cups.filter((_, idx) => idx !== i) })
  }

  const totalAssigned = value.cups.reduce((sum, c) => sum + Math.max(0, teamsFor(c)), 0)
  const hasOverlap = value.cups.some((c, i) =>
    value.cups.some((c2, j) => i !== j && c.from <= c2.to && c.to >= c2.from),
  )
  const hasGaps = value.cups.length > 1 && (() => {
    const sorted = [...value.cups].sort((a, b) => a.from - b.from)
    return sorted.some((c, i) => i > 0 && c.from !== sorted[i - 1].to + 1)
  })()
  const cupErrors = value.cups.map((c) => {
    const positions = c.to - c.from + 1
    if (positions <= 0) return 'Rango inválido'
    if (maxPos > 0 && c.to > maxPos) return `Posición máxima: ${maxPos}`
    if (c.from < 1) return 'Posición mínima: 1'
    const teams = teamsFor(c)
    if (c.size < teams) return `Bracket (${c.size}) menor que equipos (${teams})`
    if (c.size > teams * 2) return `Bracket (${c.size}) muy grande para ${teams} equipos`
    return null
  })
  function switchDistribution(newDist: CupDistribution) {
    const cups = totalQualified > 0
      ? buildDefaultCups(groupCount, qualifiersPerGroup, newDist)
      : value.cups
    onChange({ ...value, distribution: newDist, cups })
  }

  const posLabel = dist === 'group_position' ? 'Posición en grupo' : 'Posición global'

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-indigo-700 uppercase tracking-wide">Multi-Copa</p>
        <button
          type="button"
          onClick={addCup}
          className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-100 hover:bg-indigo-200 px-3 py-1.5 rounded-lg transition-colors"
        >
          <Plus size={12} /> Agregar copa
        </button>
      </div>

      {!groupsPhase && (
        <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Multi-Copa requiere una fase de Grupos anterior. Agrega una fase de Grupos antes de esta.
        </p>
      )}

      <div className="bg-indigo-100 rounded-lg px-3 py-3 space-y-2">
        <p className="text-xs font-semibold text-indigo-700">Distribución de equipos a copas</p>
        <div className="flex gap-2">
          {(Object.entries(CUP_DISTRIBUTION_LABEL) as [CupDistribution, string][]).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => switchDistribution(key)}
              className={clsx(
                'flex-1 text-xs font-medium px-3 py-2 rounded-lg border transition-colors',
                dist === key
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-indigo-700 border-indigo-200 hover:bg-indigo-50',
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-indigo-500">
          {dist === 'reclassification'
            ? `Ranking general 1° a ${totalQualified || 'N'}°. Cada posición = 1 equipo.`
            : `Posición dentro del grupo (1° a ${qualifiersPerGroup || 'N'}°). Cada posición = ${groupCount || 'N'} equipos (uno por grupo).`
          }
        </p>
      </div>
      {totalQualified > 0 && (
        <div className="space-y-1 px-1">
          <p className="text-[11px] text-indigo-600 font-medium">
            Total: {totalQualified} equipos ({groupCount} grupos × {teamsPerGroup} por grupo)
            {dist === 'group_position' && <> — posiciones 1° a {qualifiersPerGroup}°</>}
          </p>
          {value.cups.length > 0 && totalAssigned !== totalQualified && (
            <p className="text-[11px] text-amber-600 font-medium">
              ⚠ Asignados en copas: {totalAssigned} — {totalAssigned < totalQualified ? `faltan ${totalQualified - totalAssigned}` : `sobran ${totalAssigned - totalQualified}`} equipos
            </p>
          )}
          {hasOverlap && (
            <p className="text-[11px] text-red-600 font-medium">⚠ Hay posiciones superpuestas entre copas</p>
          )}
          {hasGaps && !hasOverlap && (
            <p className="text-[11px] text-amber-600 font-medium">⚠ Hay huecos entre las posiciones de las copas</p>
          )}
          {value.cups.length > 0 && totalAssigned === totalQualified && !hasOverlap && !hasGaps && (
            <p className="text-[11px] text-green-600 font-medium">✓ Todos los equipos están asignados correctamente</p>
          )}
        </div>
      )}
      {value.cups.length === 0 && (
        <p className="text-xs text-slate-400 text-center py-4">No hay copas. Agrega la primera.</p>
      )}
      <div className="space-y-3">
        {value.cups.map((cup, i) => {
          const cupFormat: CupFormat = cup.format ?? 'knockout'
          const teams = teamsFor(cup)
          const defaultGroups: CupGroupsConfig = cup.groups ?? {
            groupCount: Math.max(2, Math.floor(teams / 4)),
            teamsPerGroup: Math.max(2, Math.ceil(teams / Math.max(2, Math.floor(teams / 4)))),
            qualifiersPerGroup: 2,
            doubleLeg: false,
          }
          return (
            <div key={i} className={clsx('bg-white rounded-xl border p-4', cupErrors[i] ? 'border-red-300' : 'border-indigo-200')}>
              <div className="flex items-center gap-2 mb-3">
                <input
                  className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-bold text-slate-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200"
                  value={cup.name}
                  onChange={(e) => updateCup(i, { name: e.target.value })}
                  placeholder="Copa A"
                />
                <span className="text-[10px] text-slate-400 font-medium whitespace-nowrap">
                  {teams} equipos
                </span>
                <button type="button" onClick={() => removeCup(i)} className="text-slate-300 hover:text-red-500 transition-colors p-1">
                  <Trash2 size={14} />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Field label={`Desde ${posLabel.toLowerCase()}`}>
                  <input type="number" min={1} max={maxPos || undefined} className={inputCls} value={cup.from} onChange={(e) => updateCup(i, { from: parseInt(e.target.value) || 1 })} />
                </Field>
                <Field label={`Hasta ${posLabel.toLowerCase()}`}>
                  <input type="number" min={1} max={maxPos || undefined} className={inputCls} value={cup.to} onChange={(e) => updateCup(i, { to: parseInt(e.target.value) || 1 })} />
                </Field>
                <Field label="Equipos en bracket">
                  <input type="number" min={2} className={inputCls} value={cup.size} onChange={(e) => updateCup(i, { size: parseInt(e.target.value) || 2 })} />
                </Field>
              </div>
              {dist === 'group_position' && teams > 0 && (
                <p className="text-[10px] text-slate-400 mt-1.5">
                  Pos. {cup.from}{cup.from !== cup.to ? `–${cup.to}` : ''} × {groupCount} grupos = {teams} equipos
                </p>
              )}

              {/* Cup format selector */}
              <div className="mt-3 pt-3 border-t border-slate-100">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-2">Formato de la copa</p>
                <div className="flex gap-2">
                  {([
                    { key: 'knockout' as CupFormat, label: 'Eliminatoria' },
                    { key: 'groups_knockout' as CupFormat, label: 'Grupos + Eliminatoria' },
                    { key: 'league' as CupFormat, label: 'Liga' },
                  ]).map(({ key, label }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        if (key === 'groups_knockout') {
                          const gc = Math.max(2, Math.floor(teams / 4))
                          const tpg = Math.max(2, Math.ceil(teams / gc))
                          const qpg = Math.min(2, tpg)
                          const qualified = gc * qpg
                          updateCup(i, {
                            format: key,
                            groups: { groupCount: gc, teamsPerGroup: tpg, qualifiersPerGroup: qpg, doubleLeg: false },
                            size: nearestPowerOf2(qualified),
                          })
                        } else {
                          updateCup(i, { format: key, groups: undefined })
                        }
                      }}
                      className={clsx(
                        'flex-1 text-[11px] font-medium px-3 py-1.5 rounded-lg border transition-colors',
                        cupFormat === key
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100',
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Groups config within cup */}
              {cupFormat === 'groups_knockout' && (
                <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200 space-y-3">
                  <p className="text-[10px] font-bold text-blue-700 uppercase tracking-wide">Grupos dentro de {cup.name}</p>
                  <div className="grid grid-cols-3 gap-2">
                    <Field label="Grupos">
                      <input type="number" min={2} className={inputCls} value={defaultGroups.groupCount}
                        onChange={(e) => {
                          const gc = parseInt(e.target.value) || 2
                          const g = { ...defaultGroups, groupCount: gc, teamsPerGroup: Math.max(2, Math.ceil(teams / gc)) }
                          const qualified = g.groupCount * g.qualifiersPerGroup
                          updateCup(i, { groups: g, size: nearestPowerOf2(qualified) })
                        }}
                      />
                    </Field>
                    <Field label="Equipos/grupo">
                      <input type="number" min={2} className={inputCls} value={defaultGroups.teamsPerGroup}
                        onChange={(e) => {
                          const g = { ...defaultGroups, teamsPerGroup: parseInt(e.target.value) || 2 }
                          updateCup(i, { groups: g })
                        }}
                      />
                    </Field>
                    <Field label="Clasifican">
                      <input type="number" min={1} className={inputCls} value={defaultGroups.qualifiersPerGroup}
                        onChange={(e) => {
                          const qpg = parseInt(e.target.value) || 1
                          const g = { ...defaultGroups, qualifiersPerGroup: qpg }
                          const qualified = g.groupCount * qpg
                          updateCup(i, { groups: g, size: nearestPowerOf2(qualified) })
                        }}
                      />
                    </Field>
                  </div>
                  <Toggle
                    checked={defaultGroups.doubleLeg}
                    onChange={(v) => updateCup(i, { groups: { ...defaultGroups, doubleLeg: v } })}
                    label="Ida y vuelta"
                    description="Cada enfrentamiento se juega dos veces."
                  />
                  <p className="text-[10px] text-blue-600">
                    {defaultGroups.groupCount} grupos de {defaultGroups.teamsPerGroup} → clasifican {defaultGroups.groupCount * defaultGroups.qualifiersPerGroup} → bracket de {cup.size}
                  </p>
                </div>
              )}

              {/* League config */}
              {cupFormat === 'league' && (
                <div className="mt-3 p-3 bg-emerald-50 rounded-lg border border-emerald-200 space-y-2">
                  <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wide">Liga — Todos contra todos</p>
                  <Toggle
                    checked={cup.doubleLeg ?? false}
                    onChange={(v) => updateCup(i, { doubleLeg: v })}
                    label="Ida y vuelta"
                    description="Cada par de equipos se enfrenta dos veces."
                  />
                  <p className="text-[10px] text-emerald-600">
                    {teams} equipos juegan todos contra todos. El que más puntos acumule gana.
                  </p>
                </div>
              )}

              {/* Rondas adicionales */}
              {cupFormat !== 'league' && (
                <div className="mt-3 p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Rondas</p>
                  <div className="grid grid-cols-2 gap-2">
                    <Toggle
                      checked={cup.hasCrossover ?? false}
                      onChange={(v) => updateCup(i, { hasCrossover: v })}
                      label="Cruzados"
                      description="1°A vs 2°B, 1°B vs 2°A"
                    />
                    <Toggle
                      checked={cup.hasThirdPlace ?? false}
                      onChange={(v) => updateCup(i, { hasThirdPlace: v })}
                      label="Final 3° / 4°"
                      description="Perdedores de semis juegan por el 3er puesto."
                    />
                  </div>
                </div>
              )}

              {/* Round summary */}
              <div className="mt-2 px-1">
                <p className="text-[10px] text-slate-400 font-medium">
                  {cupFormat === 'league' && `Liga (${teams} equipos${cup.doubleLeg ? ', ida y vuelta' : ''})`}
                  {cupFormat === 'groups_knockout' && `Grupos → ${cup.hasCrossover ? 'Cruzados → ' : ''}Eliminatoria${cup.hasThirdPlace ? ' + 3°/4°' : ''}`}
                  {cupFormat === 'knockout' && `Eliminatoria${cup.hasCrossover ? ' con cruzados' : ''} (bracket de ${cup.size})${cup.hasThirdPlace ? ' + 3°/4°' : ''}`}
                </p>
              </div>

              {cupErrors[i] && (
                <p className="text-[11px] text-red-500 font-medium mt-2">{cupErrors[i]}</p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Phase card colors ──────────────────────────────────────────────────────

const PHASE_COLORS: Record<PhaseKind, { bg: string; border: string; text: string }> = {
  groups:      { bg: 'bg-blue-50',   border: 'border-blue-200',   text: 'text-blue-700' },
  round_robin: { bg: 'bg-blue-50',   border: 'border-blue-200',   text: 'text-blue-700' },
  knockout:    { bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-700' },
  multi_cup:   { bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-700' },
}

// ─── Main FormatSection ─────────────────────────────────────────────────────

export function FormatSection({
  formatConfig,
  onChange,
  maxTeams,
}: {
  formatConfig: FormatConfig
  onChange: (fc: FormatConfig) => void
  maxTeams: number
}) {
  const phases = formatConfig.phases ?? []
  const selectedTemplateId = formatConfig.type

  function selectTemplate(templateId: FormatType) {
    const template = FORMAT_TEMPLATES.find((t) => t.id === templateId)!
    const prefill = buildPrefill(template, maxTeams)
    onChange({ ...formatConfig, ...prefill })
  }

  function updatePhase(index: number, phase: PhaseConfig) {
    const newPhases = [...phases]
    newPhases[index] = phase
    onChange({ ...formatConfig, phases: newPhases, type: deriveFormatType(newPhases) })
  }

  function changePhaseKind(index: number, kind: PhaseKind) {
    const newPhases = [...phases]
    newPhases[index] = buildPhaseDefault(kind, maxTeams, newPhases.slice(0, index))
    onChange({ ...formatConfig, phases: newPhases, type: deriveFormatType(newPhases) })
  }

  function removePhase(index: number) {
    const newPhases = phases.filter((_, i) => i !== index)
    onChange({ ...formatConfig, phases: newPhases, type: deriveFormatType(newPhases) })
  }

  function addPhase(kind: PhaseKind) {
    const newPhases = [...phases, buildPhaseDefault(kind, maxTeams, phases)]
    onChange({ ...formatConfig, phases: newPhases, type: deriveFormatType(newPhases) })
  }

  function movePhase(index: number, dir: -1 | 1) {
    const target = index + dir
    if (target < 0 || target >= phases.length) return
    const newPhases = [...phases]
    ;[newPhases[index], newPhases[target]] = [newPhases[target], newPhases[index]]
    onChange({ ...formatConfig, phases: newPhases, type: deriveFormatType(newPhases) })
  }

  // Check if next multi_cup has a groups before it
  function hasGroupsBefore(index: number): boolean {
    return phases.slice(0, index).some((p) => p.kind === 'groups')
  }

  return (
    <div className="space-y-5">
      {/* Templates */}
      <div>
        <p className="text-sm font-semibold text-slate-700 mb-3">Plantilla de formato</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {FORMAT_TEMPLATES.map(({ id, label, icon, desc }) => (
            <button
              key={id}
              type="button"
              onClick={() => selectTemplate(id)}
              className={clsx(
                'flex flex-col items-start gap-1.5 px-4 py-3 rounded-xl border text-left transition-all',
                selectedTemplateId === id
                  ? 'border-indigo-400 bg-indigo-50 ring-2 ring-indigo-300 ring-offset-1'
                  : 'border-slate-200 bg-white hover:border-indigo-200 hover:bg-indigo-50/40',
              )}
            >
              <span className="flex items-center gap-2 text-sm font-bold text-slate-800">
                <span>{icon}</span> {label}
              </span>
              <span className="text-xs text-slate-500 leading-relaxed">{desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Dynamic phases list */}
      <div className="space-y-3">
        <p className="text-sm font-semibold text-slate-700">Fases del torneo</p>

        {phases.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-6">
            Selecciona una plantilla arriba o agrega fases manualmente.
          </p>
        )}

        {phases.map((phase, i) => {
          const colors = PHASE_COLORS[phase.kind]
          const isMultiCupWithoutGroups = phase.kind === 'multi_cup' && !hasGroupsBefore(i)
          return (
            <div key={i} className={clsx('rounded-xl border p-4', colors.bg, colors.border)}>
              {/* Phase header */}
              <div className="flex items-center gap-3 mb-3">
                <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-white border border-slate-200 text-xs font-mono font-bold text-slate-500">
                  {i + 1}
                </span>
                <div className="relative flex-1">
                  <select
                    className={clsx(inputCls, 'appearance-none pr-8 text-sm font-bold')}
                    value={phase.kind}
                    onChange={(e) => changePhaseKind(i, e.target.value as PhaseKind)}
                  >
                    {ALL_PHASE_KINDS.map((k) => (
                      <option key={k} value={k}>{PHASE_KIND_LABEL[k]}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => movePhase(i, -1)}
                    disabled={i === 0}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    title="Subir"
                  >
                    <ArrowUp size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => movePhase(i, 1)}
                    disabled={i === phases.length - 1}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    title="Bajar"
                  >
                    <ArrowDown size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => removePhase(i)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-white transition-colors"
                    title="Eliminar fase"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {/* Validation warning */}
              {isMultiCupWithoutGroups && (
                <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">
                  Multi-Copa requiere una fase de Grupos anterior.
                </p>
              )}

              {/* Phase config form */}
              {phase.kind === 'groups' && (
                <PhaseGroupsForm
                  value={phase}
                  onChange={(p) => updatePhase(i, p)}
                  isMultiCup={phases.some((p, j) => j > i && p.kind === 'multi_cup')}
                  maxTeams={maxTeams}
                  label={`Fase ${i + 1} — Grupos`}
                />
              )}
              {phase.kind === 'round_robin' && (
                <PhaseRoundRobinForm
                  value={phase}
                  onChange={(p) => updatePhase(i, p)}
                  label={`Fase ${i + 1} — Todos contra todos`}
                />
              )}
              {phase.kind === 'knockout' && (
                <PhaseKnockoutForm
                  value={phase}
                  onChange={(p) => updatePhase(i, p)}
                  label={`Fase ${i + 1} — Eliminatoria`}
                />
              )}
              {phase.kind === 'multi_cup' && (
                <PhaseMultiCupForm
                  value={phase}
                  onChange={(p) => updatePhase(i, p)}
                  precedingPhases={phases.slice(0, i)}
                />
              )}
            </div>
          )
        })}

        {/* Add phase button */}
        <div className="flex items-center gap-2 pt-1">
          <div className="relative flex-1">
            <select
              className={clsx(inputCls, 'appearance-none pr-8')}
              value=""
              onChange={(e) => {
                if (e.target.value) addPhase(e.target.value as PhaseKind)
                e.target.value = ''
              }}
            >
              <option value="" disabled>Agregar fase...</option>
              {ALL_PHASE_KINDS.map((k) => (
                <option key={k} value={k}>{PHASE_KIND_LABEL[k]}</option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Match rules */}
      {phases.length > 0 && (
        <div className="pt-2 border-t border-slate-100 space-y-3">
          <p className="text-sm font-semibold text-slate-700">Reglas del partido</p>
          <div className="grid grid-cols-2 gap-3">
            <Toggle
              checked={formatConfig.hasExtraTime ?? false}
              onChange={(v) => onChange({ ...formatConfig, hasExtraTime: v })}
              label="Tiempo extra"
              description="Si el partido termina empatado."
            />
            <Toggle
              checked={formatConfig.hasPenalties ?? false}
              onChange={(v) => onChange({ ...formatConfig, hasPenalties: v })}
              label="Penales"
              description="Si persiste el empate."
            />
          </div>
          <div className="flex items-end gap-4">
            <div className="w-44">
              <Field label="Minutos por tiempo">
                <div className="relative">
                  <input
                    type="number" min={5} max={60}
                    className={inputCls}
                    value={formatConfig.minutesPerHalf ?? ''}
                    onChange={(e) => onChange({ ...formatConfig, minutesPerHalf: parseInt(e.target.value) || undefined })}
                    placeholder="25"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">min</span>
                </div>
              </Field>
            </div>
            {formatConfig.minutesPerHalf ? (
              <div className="flex items-center gap-2 mb-1 px-4 py-2.5 bg-indigo-50 border border-indigo-200 rounded-xl">
                <span className="text-sm font-semibold text-indigo-700">{formatConfig.minutesPerHalf * 2} min totales</span>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  )
}
