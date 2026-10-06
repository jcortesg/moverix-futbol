import type {
  FormatType,
  FormatConfig,
  PhaseConfig,
  PhaseKind,
  PhaseGroups,
  CupConfig,
  CupDistribution,
} from './leagues'

// ─── Math helpers ────────────────────────────────────────────────────────────

export function nearestPowerOf2(n: number): number {
  let p = 2
  while (p < n) p *= 2
  return p
}

// ─── Group distribution ──────────────────────────────────────────────────────

export function computeGroupDefaults(totalTeams: number, groupCount: number) {
  if (groupCount <= 0) return { teamsPerGroup: 0, remainder: 0, distribution: '' }
  const base = Math.floor(totalTeams / groupCount)
  const remainder = totalTeams % groupCount
  const distribution = remainder > 0
    ? `${remainder} grupo${remainder > 1 ? 's' : ''} de ${base + 1} y ${groupCount - remainder} de ${base}`
    : `${groupCount} grupos de ${base}`
  return { teamsPerGroup: base > 0 ? base : 1, remainder, distribution }
}

export function computeGroupsFromTeamsPerGroup(totalTeams: number, teamsPerGroup: number) {
  if (teamsPerGroup <= 0) return { groupCount: 0, remainder: 0 }
  const groupCount = Math.ceil(totalTeams / teamsPerGroup)
  const remainder = totalTeams % teamsPerGroup
  return { groupCount, remainder }
}

// ─── Derive FormatType from phases array ─────────────────────────────────────

export function deriveFormatType(phases: PhaseConfig[]): FormatType | undefined {
  const kinds = phases.map((p) => p.kind)
  const key = kinds.join(',')
  const map: Record<string, FormatType> = {
    'groups,knockout': 'groups_knockout',
    'groups,multi_cup': 'groups_multi_cup',
    'round_robin,knockout': 'round_robin_playoffs',
    'knockout': 'knockout_only',
    'round_robin': 'round_robin_only',
  }
  return map[key]
}

// ─── Smart cup defaults ──────────────────────────────────────────────────────

export function buildSmartCupDefaults(
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
      cups.push({
        name: `Copa ${String.fromCharCode(65 + cups.length)}`,
        from: pos,
        to,
        size: nearestPowerOf2(teams),
      })
      pos = to + 1
    }
    return cups
  }

  // Reclassification: top ~65% → Copa A, rest → Copa B
  const topTeams = nearestPowerOf2(Math.ceil(totalQualified * 0.65))
  const top = Math.min(topTeams, totalQualified)
  const rest = totalQualified - top
  const cups: CupConfig[] = [{ name: 'Copa A', from: 1, to: top, size: nearestPowerOf2(top) }]
  if (rest > 0) cups.push({ name: 'Copa B', from: top + 1, to: totalQualified, size: nearestPowerOf2(rest) })
  return cups
}

// ─── Template prefills ───────────────────────────────────────────────────────

export type FormatTemplate = {
  id: FormatType
  label: string
  icon: string
  desc: string
  phaseKinds: PhaseKind[]
}

export const FORMAT_TEMPLATES: FormatTemplate[] = [
  {
    id: 'groups_knockout',
    label: 'Grupos + Eliminatoria',
    icon: '⚽',
    desc: 'Fase de grupos donde clasifican los mejores, luego eliminación directa.',
    phaseKinds: ['groups', 'knockout'],
  },
  {
    id: 'groups_multi_cup',
    label: 'Grupos + Multi-Copa',
    icon: '🏆',
    desc: 'Grupos → múltiples copas (A, B, C) según clasificación. Más partidos para todos.',
    phaseKinds: ['groups', 'multi_cup'],
  },
  {
    id: 'round_robin_playoffs',
    label: 'Todos vs Todos + Playoffs',
    icon: '🔄',
    desc: 'Todos los equipos se enfrentan entre sí. Los mejores avanzan a playoffs.',
    phaseKinds: ['round_robin', 'knockout'],
  },
  {
    id: 'knockout_only',
    label: 'Solo Eliminatoria',
    icon: '⚡',
    desc: 'Cuadro de eliminación directa. Ideal para torneos cortos o copas.',
    phaseKinds: ['knockout'],
  },
  {
    id: 'round_robin_only',
    label: 'Solo Liga',
    icon: '📋',
    desc: 'Todos contra todos. El que más puntos acumule gana.',
    phaseKinds: ['round_robin'],
  },
]

/**
 * Build a default phase config for a given kind.
 * `precedingPhases` lets knockout/multi_cup compute qualifiers from earlier groups.
 */
export function buildPhaseDefault(
  kind: PhaseKind,
  maxTeams: number,
  precedingPhases: PhaseConfig[] = [],
): PhaseConfig {
  const teams = maxTeams || 16

  if (kind === 'groups') {
    const idealGroups = Math.max(2, Math.round(teams / 4))
    const { teamsPerGroup } = computeGroupDefaults(teams, idealGroups)
    return { kind: 'groups', groupCount: idealGroups, teamsPerGroup, qualifiersPerGroup: Math.min(2, teamsPerGroup), doubleLeg: false }
  }
  if (kind === 'round_robin') {
    return { kind: 'round_robin', doubleLeg: true }
  }
  if (kind === 'knockout') {
    const groupsPhase = precedingPhases.findLast((p) => p.kind === 'groups') as PhaseGroups | undefined
    const rrPhase = precedingPhases.findLast((p) => p.kind === 'round_robin')
    const qualifiers = groupsPhase
      ? groupsPhase.groupCount * groupsPhase.qualifiersPerGroup
      : rrPhase
        ? Math.min(8, teams)
        : teams
    return { kind: 'knockout', bracketSize: nearestPowerOf2(Math.max(2, qualifiers)), hasThirdPlace: false, hasRepechage: false }
  }
  // multi_cup
  const groupsPhase = precedingPhases.findLast((p) => p.kind === 'groups') as PhaseGroups | undefined
  const gc = groupsPhase?.groupCount ?? 0
  const tpg = groupsPhase?.teamsPerGroup ?? 0
  return {
    kind: 'multi_cup',
    distribution: 'group_position' as CupDistribution,
    cups: buildSmartCupDefaults(gc, tpg, 'group_position'),
  }
}

/**
 * Build a smart prefill for phases based on a template and maxTeams.
 */
export function buildPrefill(
  template: FormatTemplate,
  maxTeams: number,
): Pick<FormatConfig, 'type' | 'phases'> {
  const phases: PhaseConfig[] = []
  for (const kind of template.phaseKinds) {
    phases.push(buildPhaseDefault(kind, maxTeams, phases))
  }
  return { type: template.id, phases }
}
