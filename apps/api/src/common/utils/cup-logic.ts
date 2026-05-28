/**
 * Pure logic for cup distribution calculations.
 * Mirrors packages/types/src/cup-logic.ts for backend use.
 */

export type CupDistribution = 'reclassification' | 'group_position'

export type CupConfig = {
  name: string
  from: number
  to: number
  size: number
}

export function nearestPowerOf2(n: number): number {
  let p = 2
  while (p < n) p *= 2
  return p
}

export function cupTeams(cup: CupConfig, distribution: CupDistribution, groupCount: number): number {
  const positions = cup.to - cup.from + 1
  if (positions <= 0) return 0
  return distribution === 'group_position' ? positions * groupCount : positions
}

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
