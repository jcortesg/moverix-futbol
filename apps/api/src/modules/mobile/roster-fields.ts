// Config de campos del jugador para la inscripción a un campeonato.
// El organizador elige cuáles son obligatorios por edición; si no elige
// ninguno, se aplican los DEFAULT.

export const DEFAULT_REQUIRED_PLAYER_FIELDS = [
  'firstName',
  'lastName',
  'docNumber',
  'birthDate',
] as const

// Campos que el organizador puede marcar como requeridos (clave + etiqueta).
export const ROSTER_PLAYER_FIELDS: { key: string; label: string }[] = [
  { key: 'firstName', label: 'Nombre' },
  { key: 'lastName', label: 'Apellido' },
  { key: 'docNumber', label: 'Documento' },
  { key: 'birthDate', label: 'Fecha de nacimiento' },
  { key: 'phone', label: 'Teléfono' },
  { key: 'email', label: 'Email' },
  { key: 'employer', label: 'Empresa' },
  { key: 'healthProvider', label: 'EPS' },
  { key: 'jerseyNumber', label: 'Dorsal' },
  { key: 'position', label: 'Posición' },
  { key: 'photoFileUrl', label: 'Foto' },
  { key: 'docFileUrl', label: 'Documento (archivo)' },
  { key: 'emergencyContactName', label: 'Contacto de emergencia (nombre)' },
  { key: 'emergencyContactPhone', label: 'Contacto de emergencia (teléfono)' },
]

const VALID_KEYS = new Set(ROSTER_PLAYER_FIELDS.map((f) => f.key))
const LABELS = new Map(ROSTER_PLAYER_FIELDS.map((f) => [f.key, f.label]))

/** Normaliza la config almacenada: filtra claves válidas o devuelve los default. */
export function resolveRequiredFields(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    const filtered = raw.filter((k): k is string => typeof k === 'string' && VALID_KEYS.has(k))
    if (filtered.length) return filtered
  }
  return [...DEFAULT_REQUIRED_PLAYER_FIELDS]
}

export function fieldLabel(key: string): string {
  return LABELS.get(key) ?? key
}

/** ¿El jugador tiene el campo lleno? (string no vacío / número / fecha presente) */
export function isFieldFilled(player: Record<string, unknown>, key: string): boolean {
  const v = player[key]
  if (v === null || v === undefined) return false
  if (typeof v === 'string') return v.trim().length > 0
  return true
}
