import { buildLayout, CARD_H, COL_W, CHANNEL, HEADER_H, STEP } from './bracket-layout'

let passed = 0
let failed = 0

function assert(condition: boolean, msg: string) {
  if (condition) {
    console.log(`  ✓ ${msg}`)
    passed++
  } else {
    console.error(`  ✗ ${msg}`)
    failed++
  }
}

type Slot = { id: string; round: number; slot: number; nextSlotId: string | null }

/** Cuadro perfecto de `size` equipos: rondas llenas, sin byes. */
function perfectBracket(size: number): Slot[] {
  const slots: Slot[] = []
  const rounds = Math.log2(size)
  for (let r = 1; r <= rounds; r++) {
    const count = size / 2 ** r
    for (let i = 0; i < count; i++) {
      slots.push({
        id: `r${r}s${i}`,
        round: r,
        slot: i,
        nextSlotId: r === rounds ? null : `r${r + 1}s${Math.floor(i / 2)}`,
      })
    }
  }
  return slots
}

/** Invariantes que debe cumplir cualquier cuadro dibujable. */
function checkInvariants(slots: Slot[], label: string) {
  const L = buildLayout(slots)

  // 1. Dos llaves de la misma ronda nunca se pisan.
  let overlap = false
  for (const r of L.rounds) {
    const centers = slots
      .filter((s) => s.round === r)
      .map((s) => L.center.get(s.id)!)
      .sort((a, b) => a - b)
    for (let i = 1; i < centers.length; i++) {
      if (centers[i] - centers[i - 1] < CARD_H) overlap = true
    }
  }
  assert(!overlap, `${label}: ninguna llave se solapa con otra de su ronda`)

  // 2. Toda llave queda dentro del rango vertical de sus hijos: si no, el
  //    conector saldría torcido o apuntaría a otra llave.
  let outside = false
  for (const s of slots) {
    const kids = (L.childrenOf.get(s.id) ?? []) as unknown as Slot[]
    if (kids.length === 0) continue
    const ys = kids.map((k) => L.center.get(k.id)!)
    const c = L.center.get(s.id)!
    if (c < Math.min(...ys) - 0.01 || c > Math.max(...ys) + 0.01) outside = true
  }
  assert(!outside, `${label}: cada llave cae entre sus hijos`)

  // 3. Todo cabe en el lienzo que se reporta.
  const maxBottom = Math.max(...slots.map((s) => HEADER_H + L.center.get(s.id)! + CARD_H / 2))
  assert(maxBottom <= L.height + 0.01, `${label}: el alto alcanza para todas las llaves`)
  assert(
    L.width === L.rounds.length * COL_W - CHANNEL,
    `${label}: el ancho cubre las ${L.rounds.length} rondas`,
  )

  // 4. Nada queda por encima del borde superior.
  const minTop = Math.min(...slots.map((s) => HEADER_H + L.center.get(s.id)! - CARD_H / 2))
  assert(minTop >= HEADER_H - 0.01, `${label}: nada se sale por arriba`)

  return L
}

console.log('\n── Cuadro perfecto de 8 equipos ──')
{
  const slots = perfectBracket(8)
  const L = checkInvariants(slots, '8 equipos')

  assert(L.rounds.length === 3, 'son 3 rondas: cuartos, semis y final')
  assert(L.center.get('r1s0') === STEP / 2, 'la primera llave arranca a media separación')
  assert(
    L.center.get('r2s0') === (L.center.get('r1s0')! + L.center.get('r1s1')!) / 2,
    'la semifinal queda centrada entre sus dos cuartos',
  )
  assert(
    L.center.get('r3s0') === (L.center.get('r2s0')! + L.center.get('r2s1')!) / 2,
    'la final queda centrada entre las dos semis',
  )
}

console.log('\n── Cuadro con byes (repechaje de 2 llaves) ──')
{
  // 6 equipos en cuadro de 8: dos cruces de repechaje, dos pasan directo.
  const slots: Slot[] = [
    // Ronda 1 (repechaje): solo 2 llaves, no 4.
    { id: 'rep-a', round: 1, slot: 0, nextSlotId: 'sf-a' },
    { id: 'rep-b', round: 1, slot: 1, nextSlotId: 'sf-b' },
    // Ronda 2 (semis): una recibe al del repechaje, la otra tiene a los dos
    // cabezas de serie que entraron sin jugar.
    { id: 'sf-a', round: 2, slot: 0, nextSlotId: 'final' },
    { id: 'sf-b', round: 2, slot: 1, nextSlotId: 'final' },
    { id: 'final', round: 3, slot: 0, nextSlotId: null },
  ]
  const L = checkInvariants(slots, 'con byes')

  assert(
    L.center.get('sf-a') === L.center.get('rep-a'),
    'la semi con un solo hijo se alinea con él, no a media altura',
  )
  assert(
    L.center.get('sf-b')! - L.center.get('sf-a')! >= CARD_H,
    'las dos semis mantienen la separación mínima',
  )
}

console.log('\n── Llave que entra por bye, sin hijos ──')
{
  // La segunda semi no tiene hijos: los dos equipos entraron directo.
  const slots: Slot[] = [
    { id: 'q1', round: 1, slot: 0, nextSlotId: 'sf1' },
    { id: 'q2', round: 1, slot: 1, nextSlotId: 'sf1' },
    { id: 'sf1', round: 2, slot: 0, nextSlotId: 'final' },
    { id: 'sf2', round: 2, slot: 1, nextSlotId: 'final' },
    { id: 'final', round: 3, slot: 0, nextSlotId: null },
  ]
  const L = checkInvariants(slots, 'bye sin hijos')

  assert(
    L.center.get('sf2')! >= L.center.get('sf1')! + STEP,
    'la llave sin hijos toma el siguiente hueco libre de su ronda',
  )
}

console.log('\n── Cuadro vacío ──')
{
  const L = buildLayout([])
  assert(L.rounds.length === 0, 'sin llaves no hay rondas')
  assert(L.width <= 0, 'sin llaves el ancho no es positivo')
  assert(L.height > 0, 'el alto sigue siendo un número válido')
}

console.log(`\n${passed} pasaron, ${failed} fallaron\n`)
if (failed > 0) process.exit(1)
