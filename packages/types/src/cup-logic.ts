/**
 * Pure logic for cup distribution calculations.
 * Shared between admin (frontend) and API (backend).
 */

import type { CupConfig, CupDistribution } from './index'

export function nearestPowerOf2(n: number): number {
  let p = 2
  while (p < n) p *= 2
  return p
}

/** Calculate teams in a cup based on distribution mode */
export function cupTeams(cup: CupConfig, distribution: CupDistribution, groupCount: number): number {
  const positions = cup.to - cup.from + 1
  if (positions <= 0) return 0
  return distribution === 'group_position' ? positions * groupCount : positions
}

/** Build default cup configs based on groups and distribution */
export function buildDefaultCups(
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

  // Reclassification
  const topTeams = nearestPowerOf2(Math.ceil(totalQualified * 0.65))
  const top = Math.min(topTeams, totalQualified)
  const rest = totalQualified - top
  const cups: CupConfig[] = [
    { name: 'Copa A', from: 1, to: top, size: nearestPowerOf2(top) },
  ]
  if (rest > 0) {
    cups.push({ name: 'Copa B', from: top + 1, to: totalQualified, size: nearestPowerOf2(rest) })
  }
  return cups
}

/** Validate cups against group config */
export function validateCups(
  cups: CupConfig[],
  distribution: CupDistribution,
  groupCount: number,
  teamsPerGroup: number,
): {
  totalAssigned: number
  totalExpected: number
  maxPos: number
  hasOverlap: boolean
  hasGaps: boolean
  allValid: boolean
  cupErrors: (string | null)[]
} {
  const totalExpected = groupCount * teamsPerGroup
  const maxPos = distribution === 'group_position' ? teamsPerGroup : totalExpected

  const totalAssigned = cups.reduce((sum, c) => sum + Math.max(0, cupTeams(c, distribution, groupCount)), 0)

  const hasOverlap = cups.some((c, i) =>
    cups.some((c2, j) => i !== j && c.from <= c2.to && c.to >= c2.from),
  )

  const hasGaps = cups.length > 1 && (() => {
    const sorted = [...cups].sort((a, b) => a.from - b.from)
    return sorted.some((c, i) => i > 0 && c.from !== sorted[i - 1].to + 1)
  })()

  const cupErrors = cups.map((c) => {
    const positions = c.to - c.from + 1
    if (positions <= 0) return 'Rango inválido'
    if (maxPos > 0 && c.to > maxPos) return `Posición máxima: ${maxPos}`
    if (c.from < 1) return 'Posición mínima: 1'
    const teams = cupTeams(c, distribution, groupCount)
    if (c.size < teams) return `Bracket (${c.size}) menor que equipos (${teams})`
    if (c.size > teams * 2) return `Bracket (${c.size}) muy grande para ${teams} equipos`
    return null
  })

  const allValid = totalAssigned === totalExpected && !hasOverlap && !hasGaps && cupErrors.every((e) => e === null)

  return { totalAssigned, totalExpected, maxPos, hasOverlap, hasGaps, allValid, cupErrors }
}
