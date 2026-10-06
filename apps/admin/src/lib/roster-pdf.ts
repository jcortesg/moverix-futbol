import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { PLAYER_POSITION_LABEL, type RegistrationPlayerFromApi } from './registration-players'

export type RosterPdfInput = {
  editionName: string
  teamName: string
  teamLogoUrl?: string | null
  groupName?: string | null
  city?: string | null
  players: RegistrationPlayerFromApi[]
}

/** Carga una imagen remota y la convierte a dataURL (best-effort; null si CORS/falla). */
async function loadImageDataUrl(url: string): Promise<{ dataUrl: string; w: number; h: number } | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = img.naturalWidth
        canvas.height = img.naturalHeight
        const ctx = canvas.getContext('2d')
        if (!ctx) return resolve(null)
        ctx.drawImage(img, 0, 0)
        resolve({ dataUrl: canvas.toDataURL('image/png'), w: img.naturalWidth, h: img.naturalHeight })
      } catch {
        resolve(null)
      }
    }
    img.onerror = () => resolve(null)
    img.src = url
  })
}

function fmtDate(d: string | null): string {
  if (!d) return '—'
  const m = d.match(/^(\d{4})-(\d{2})-(\d{2})/)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : d
}

function slug(s: string): string {
  return (
    s
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '_')
      .replace(/^_|_$/g, '')
      .slice(0, 40) || 'planilla'
  )
}

/** Genera y descarga la planilla del equipo en PDF (encabezado + tabla de jugadores). */
export async function downloadRosterPdf(input: RosterPdfInput): Promise<void> {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const margin = 40
  const y0 = margin

  // Logo del equipo (best-effort)
  let logoOffset = 0
  if (input.teamLogoUrl) {
    const img = await loadImageDataUrl(input.teamLogoUrl)
    if (img) {
      const size = 48
      const ratio = img.w && img.h ? img.w / img.h : 1
      const w = ratio >= 1 ? size : size * ratio
      const h = ratio >= 1 ? size / ratio : size
      try {
        doc.addImage(img.dataUrl, 'PNG', margin, y0, w, h)
        logoOffset = size + 12
      } catch {
        logoOffset = 0
      }
    }
  }

  // Encabezado
  const tx = margin + logoOffset
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text(input.teamName, tx, y0 + 16)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(90)
  const meta = [input.editionName, input.groupName ? `Grupo ${input.groupName}` : null, input.city || null]
    .filter(Boolean)
    .join('   ·   ')
  doc.text(meta, tx, y0 + 32)
  doc.text(
    `Generado: ${new Date().toLocaleDateString('es-CO')}   ·   ${input.players.length} jugador${input.players.length === 1 ? '' : 'es'}`,
    tx,
    y0 + 46,
  )
  doc.setTextColor(0)

  const startY = Math.max(y0 + logoOffset, y0 + 60)

  // Orden: por dorsal (nulos al final), luego nombre
  const rows = [...input.players].sort((a, b) => {
    const ja = a.jerseyNumber ?? 9999
    const jb = b.jerseyNumber ?? 9999
    if (ja !== jb) return ja - jb
    return (a.playerName || '').localeCompare(b.playerName || '')
  })

  const body = rows.map((p) => {
    const name = [p.firstName, p.lastName].filter(Boolean).join(' ').trim() || p.playerName
    const pos = p.position ? PLAYER_POSITION_LABEL[p.position] : '—'
    return [
      p.jerseyNumber != null ? String(p.jerseyNumber) : '—',
      name + (p.isCaptain ? '  (C)' : ''),
      p.docNumber || '—',
      pos,
      fmtDate(p.birthDate),
    ]
  })

  autoTable(doc, {
    startY,
    head: [['#', 'Jugador', 'Documento', 'Posición', 'F. Nac.']],
    body,
    margin: { left: margin, right: margin },
    styles: { fontSize: 9, cellPadding: 4 },
    headStyles: { fillColor: [22, 163, 74], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 247, 246] },
    columnStyles: {
      0: { cellWidth: 30, halign: 'center' },
      2: { cellWidth: 95 },
      4: { cellWidth: 70, halign: 'center' },
    },
    didParseCell: (data) => {
      if (data.section === 'body' && rows[data.row.index]?.isCaptain) {
        data.cell.styles.fontStyle = 'bold'
      }
    },
  })

  doc.save(`Planilla_${slug(input.teamName)}_${slug(input.editionName)}.pdf`)
}
