/**
 * Normalize legacy formatConfig (phase1/phase2) into phases array.
 * Safe to call on already-normalized data.
 */
export type PhaseKind = 'groups' | 'round_robin' | 'knockout' | 'multi_cup'

export type NormalizedFormatConfig = {
  type?: string
  phases: Array<{ kind: PhaseKind;[key: string]: unknown }>
  [key: string]: unknown
}

export function normalizeFormatConfig(raw: Record<string, unknown> | undefined): NormalizedFormatConfig {
  if (!raw) return { phases: [] }
  if (Array.isArray(raw.phases)) {
    const { phase1, phase2, ...rest } = raw
    return rest as NormalizedFormatConfig
  }
  const { phase1, phase2, ...rest } = raw
  const phases: Array<{ kind: PhaseKind;[key: string]: unknown }> = []
  if (phase1 && typeof phase1 === 'object' && 'kind' in (phase1 as object)) {
    phases.push(phase1 as { kind: PhaseKind;[key: string]: unknown })
  }
  if (phase2 && typeof phase2 === 'object' && 'kind' in (phase2 as object)) {
    phases.push(phase2 as { kind: PhaseKind;[key: string]: unknown })
  }
  return { ...rest, phases } as NormalizedFormatConfig
}

/** Find the first phase of a given kind */
export function findPhase(
  phases: NormalizedFormatConfig['phases'],
  kind: PhaseKind,
): (typeof phases)[number] | undefined {
  return phases.find((p) => p.kind === kind)
}
