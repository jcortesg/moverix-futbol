import type {
  FormatType,
  PhaseGroups,
  CupConfig,
  CupDistribution,
  FormatConfig,
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
  // remainder groups get base+1, the rest get base
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

// ─── Derive FormatType from phase kinds ──────────────────────────────────────

type PhaseKind = 'groups' | 'round_robin' | null
type Phase2Kind = 'knockout' | 'multi_cup' | null

export function deriveFormatType(phase1Kind: PhaseKind, phase2Kind: Phase2Kind): FormatType | undefined {
  if (phase1Kind === 'groups' && phase2Kind === 'knockout') return 'groups_knockout'
  if (phase1Kind === 'groups' && phase2Kind === 'multi_cup') return 'groups_multi_cup'
  if (phase1Kind === 'round_robin' && phase2Kind === 'knockout') return 'round_robin_playoffs'
  if (phase1Kind === null && phase2Kind === 'knockout') return 'knockout_only'
  if (phase1Kind === 'round_robin' && phase2Kind === null) return 'round_robin_only'
  return undefined
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
  phase1Kind: PhaseKind
  phase2Kind: Phase2Kind
}

export const FORMAT_TEMPLATES: FormatTemplate[] = [
  {
    id: 'groups_knockout',
    label: 'Grupos + Eliminatoria',
    icon: '⚽',
    desc: 'Fase de grupos donde clasifican los mejores, luego eliminación directa.',
    phase1Kind: 'groups',
    phase2Kind: 'knockout',
  },
  {
    id: 'groups_multi_cup',
    label: 'Grupos + Multi-Copa',
    icon: '🏆',
    desc: 'Grupos → múltiples copas (A, B, C) según clasificación. Más partidos para todos.',
    phase1Kind: 'groups',
    phase2Kind: 'multi_cup',
  },
  {
    id: 'round_robin_playoffs',
    label: 'Todos vs Todos + Playoffs',
    icon: '🔄',
    desc: 'Todos los equipos se enfrentan entre sí. Los mejores avanzan a playoffs.',
    phase1Kind: 'round_robin',
    phase2Kind: 'knockout',
  },
  {
    id: 'knockout_only',
    label: 'Solo Eliminatoria',
    icon: '⚡',
    desc: 'Cuadro de eliminación directa. Ideal para torneos cortos o copas.',
    phase1Kind: null,
    phase2Kind: 'knockout',
  },
  {
    id: 'round_robin_only',
    label: 'Solo Liga',
    icon: '📋',
    desc: 'Todos contra todos. El que más puntos acumule gana.',
    phase1Kind: 'round_robin',
    phase2Kind: null,
  },
]

/**
 * Build a smart prefill for phase1 and phase2 based on a template and maxTeams.
 */
export function buildPrefill(
  template: FormatTemplate,
  maxTeams: number,
): Pick<FormatConfig, 'type' | 'phase1' | 'phase2'> {
  const teams = maxTeams || 16

  let phase1: FormatConfig['phase1']
  if (template.phase1Kind === 'groups') {
    // Smart group count: aim for 4 per group
    const idealGroups = Math.max(2, Math.round(teams / 4))
    const { teamsPerGroup } = computeGroupDefaults(teams, idealGroups)
    const qualifiersPerGroup = template.phase2Kind === 'multi_cup' ? 0 : Math.min(2, teamsPerGroup)
    phase1 = { kind: 'groups', groupCount: idealGroups, teamsPerGroup, qualifiersPerGroup, doubleLeg: false }
  } else if (template.phase1Kind === 'round_robin') {
    phase1 = { kind: 'round_robin', doubleLeg: true }
  }

  let phase2: FormatConfig['phase2']
  if (template.phase2Kind === 'knockout') {
    const qualifiers = phase1?.kind === 'groups'
      ? (phase1 as PhaseGroups).groupCount * (phase1 as PhaseGroups).qualifiersPerGroup
      : phase1?.kind === 'round_robin'
        ? Math.min(8, teams)
        : teams
    phase2 = {
      kind: 'knockout',
      bracketSize: nearestPowerOf2(Math.max(2, qualifiers)),
      hasThirdPlace: false,
      hasRepechage: false,
    }
  } else if (template.phase2Kind === 'multi_cup') {
    const gc = phase1?.kind === 'groups' ? (phase1 as PhaseGroups).groupCount : 0
    const tpg = phase1?.kind === 'groups' ? (phase1 as PhaseGroups).teamsPerGroup : 0
    phase2 = {
      kind: 'multi_cup',
      distribution: 'group_position' as CupDistribution,
      cups: buildSmartCupDefaults(gc, tpg, 'group_position'),
    }
  }

  return { type: template.id, phase1, phase2 }
}

/**
 * Build default phase config when user selects a phase kind from the dropdown.
 */
export function buildPhase1Default(kind: PhaseKind, maxTeams: number): FormatConfig['phase1'] {
  if (kind === 'groups') {
    const idealGroups = Math.max(2, Math.round((maxTeams || 16) / 4))
    const { teamsPerGroup } = computeGroupDefaults(maxTeams || 16, idealGroups)
    return { kind: 'groups', groupCount: idealGroups, teamsPerGroup, qualifiersPerGroup: Math.min(2, teamsPerGroup), doubleLeg: false }
  }
  if (kind === 'round_robin') {
    return { kind: 'round_robin', doubleLeg: true }
  }
  return undefined
}

export function buildPhase2Default(kind: Phase2Kind, phase1: FormatConfig['phase1'], maxTeams: number): FormatConfig['phase2'] {
  if (kind === 'knockout') {
    const qualifiers = phase1?.kind === 'groups'
      ? (phase1 as PhaseGroups).groupCount * (phase1 as PhaseGroups).qualifiersPerGroup
      : Math.min(8, maxTeams || 16)
    return { kind: 'knockout', bracketSize: nearestPowerOf2(Math.max(2, qualifiers)), hasThirdPlace: false, hasRepechage: false }
  }
  if (kind === 'multi_cup') {
    const gc = phase1?.kind === 'groups' ? (phase1 as PhaseGroups).groupCount : 0
    const tpg = phase1?.kind === 'groups' ? (phase1 as PhaseGroups).teamsPerGroup : 0
    return { kind: 'multi_cup', distribution: 'group_position' as CupDistribution, cups: buildSmartCupDefaults(gc, tpg, 'group_position') }
  }
  return undefined
}
