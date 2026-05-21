// Tiny CSV parser/serializer (RFC 4180-ish).
// Handles quoted fields, embedded commas, escaped quotes ("") and \r\n.

export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  let i = 0

  // Strip BOM
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1)

  while (i < text.length) {
    const c = text[i]

    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue }
        inQuotes = false
        i++
        continue
      }
      field += c
      i++
      continue
    }

    if (c === '"') { inQuotes = true; i++; continue }
    if (c === ',') { row.push(field); field = ''; i++; continue }
    if (c === '\r') { i++; continue }
    if (c === '\n') { row.push(field); field = ''; rows.push(row); row = []; i++; continue }

    field += c
    i++
  }
  // flush last field/row
  if (field.length > 0 || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows.filter((r) => r.some((f) => f.trim().length > 0))
}

export function generateCsv(rows: (string | number | null | undefined)[][]): string {
  return rows
    .map((r) =>
      r
        .map((v) => {
          if (v == null) return ''
          const s = String(v)
          if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
          return s
        })
        .join(','),
    )
    .join('\r\n')
}

export function downloadCsv(filename: string, rows: (string | number | null | undefined)[][]) {
  const csv = generateCsv(rows)
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// Normalize accents + lowercase + trim, for fuzzy header matching
export function normalizeHeader(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

// Parse "1/21/1989", "21/1/1989", "1989-01-21", "21-01-1989", trailing time/TZ,
// Excel's re-serialized strings, or anything `new Date(...)` can understand.
// Returns "YYYY-MM-DD" | null.
export function parseDateLoose(input: string | Date | null | undefined): string | null {
  if (input == null) return null

  // Native Date (Excel with cellDates gives these)
  if (input instanceof Date) {
    if (isNaN(input.getTime())) return null
    return toIsoDate(input)
  }

  let s = String(input).trim()
  if (!s) return null

  // ISO YYYY-MM-DD (optionally followed by Tnn:nn or space time)
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ]|$)/)
  if (m) {
    const [, y, mo, d] = m
    return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`
  }

  // Slash/dash separators — assume DD/MM/YYYY (es-CO convention).
  // Allow trailing whitespace + time (e.g. "2/10/1985 0:00:00").
  m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})(?:\s|$)/)
  if (m) {
    let [, d, mo, y] = m
    if (y.length === 2) y = (parseInt(y) >= 50 ? '19' : '20') + y
    return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`
  }

  // Fallback: let the engine try (handles "Fri Oct 02 1985 ...", ISO with Z, etc.)
  const parsed = new Date(s)
  if (!isNaN(parsed.getTime())) return toIsoDate(parsed)

  return null
}

function toIsoDate(d: Date): string {
  const y = d.getUTCFullYear()
  const mo = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${mo}-${day}`
}
