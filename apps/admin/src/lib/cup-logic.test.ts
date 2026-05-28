import { nearestPowerOf2, cupTeams, buildDefaultCups, validateCups } from './cup-logic'

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

function eq<T>(a: T, b: T, msg: string) {
  assert(JSON.stringify(a) === JSON.stringify(b), `${msg} → got ${JSON.stringify(a)}, expected ${JSON.stringify(b)}`)
}

// ─── nearestPowerOf2 ──────────────────────────────────────────────────────────

console.log('\n--- nearestPowerOf2 ---')
eq(nearestPowerOf2(1), 2, 'p2(1)=2')
eq(nearestPowerOf2(2), 2, 'p2(2)=2')
eq(nearestPowerOf2(3), 4, 'p2(3)=4')
eq(nearestPowerOf2(5), 8, 'p2(5)=8')
eq(nearestPowerOf2(6), 8, 'p2(6)=8')
eq(nearestPowerOf2(8), 8, 'p2(8)=8')
eq(nearestPowerOf2(9), 16, 'p2(9)=16')
eq(nearestPowerOf2(12), 16, 'p2(12)=16')
eq(nearestPowerOf2(16), 16, 'p2(16)=16')
eq(nearestPowerOf2(17), 32, 'p2(17)=32')
eq(nearestPowerOf2(32), 32, 'p2(32)=32')
eq(nearestPowerOf2(48), 64, 'p2(48)=64')

// ─── cupTeams ─────────────────────────────────────────────────────────────────

console.log('\n--- cupTeams ---')

// Reclassification: teams = to - from + 1
eq(cupTeams({ name: 'A', from: 1, to: 32, size: 32 }, 'reclassification', 6), 32, 'reclass: pos 1-32 = 32 teams')
eq(cupTeams({ name: 'B', from: 33, to: 48, size: 16 }, 'reclassification', 6), 16, 'reclass: pos 33-48 = 16 teams')
eq(cupTeams({ name: 'A', from: 1, to: 1, size: 2 }, 'reclassification', 6), 1, 'reclass: pos 1-1 = 1 team')

// Group position: teams = (to - from + 1) * groupCount
eq(cupTeams({ name: 'A', from: 1, to: 2, size: 16 }, 'group_position', 6), 12, 'group_pos: pos 1-2, 6 groups = 12 teams')
eq(cupTeams({ name: 'B', from: 3, to: 4, size: 16 }, 'group_position', 6), 12, 'group_pos: pos 3-4, 6 groups = 12 teams')
eq(cupTeams({ name: 'C', from: 5, to: 6, size: 16 }, 'group_position', 6), 12, 'group_pos: pos 5-6, 6 groups = 12 teams')
eq(cupTeams({ name: 'A', from: 1, to: 1, size: 8 }, 'group_position', 8), 8, 'group_pos: pos 1, 8 groups = 8 teams')

// Invalid ranges
eq(cupTeams({ name: 'X', from: 5, to: 3, size: 4 }, 'reclassification', 4), 0, 'invalid range = 0')
eq(cupTeams({ name: 'X', from: 5, to: 3, size: 4 }, 'group_position', 4), 0, 'invalid range group_pos = 0')

// ─── buildDefaultCups: CASB example (6 groups of 8) ──────────────────────────

console.log('\n--- buildDefaultCups: CASB 6×8 reclassification ---')
{
  const cups = buildDefaultCups(6, 8, 'reclassification')
  const totalTeams = 6 * 8 // 48
  console.log('  cups:', JSON.stringify(cups))
  assert(cups.length >= 1, `at least 1 cup (got ${cups.length})`)
  // All teams should be covered
  const assigned = cups.reduce((s, c) => s + (c.to - c.from + 1), 0)
  eq(assigned, totalTeams, `all ${totalTeams} teams assigned`)
  // No gaps
  assert(cups[0].from === 1, 'starts at 1')
  for (let i = 1; i < cups.length; i++) {
    eq(cups[i].from, cups[i - 1].to + 1, `cup ${i} from = prev to + 1`)
  }
  eq(cups[cups.length - 1].to, totalTeams, `last cup ends at ${totalTeams}`)
  // Bracket sizes are powers of 2
  for (const c of cups) {
    assert(c.size >= (c.to - c.from + 1), `${c.name} bracket (${c.size}) >= teams (${c.to - c.from + 1})`)
    assert((c.size & (c.size - 1)) === 0, `${c.name} bracket (${c.size}) is power of 2`)
  }
}

console.log('\n--- buildDefaultCups: CASB 6×8 group_position ---')
{
  const cups = buildDefaultCups(6, 8, 'group_position')
  console.log('  cups:', JSON.stringify(cups))
  // maxPos = 8 (teamsPerGroup)
  assert(cups.length >= 1, `at least 1 cup (got ${cups.length})`)
  assert(cups[0].from === 1, 'starts at pos 1')
  eq(cups[cups.length - 1].to, 8, 'last cup ends at pos 8 (teamsPerGroup)')
  // Total teams = sum of cupTeams
  const totalAssigned = cups.reduce((s, c) => s + cupTeams(c, 'group_position', 6), 0)
  eq(totalAssigned, 48, 'all 48 teams assigned')
  // No gaps
  for (let i = 1; i < cups.length; i++) {
    eq(cups[i].from, cups[i - 1].to + 1, `cup ${i} from = prev to + 1`)
  }
  // Bracket sizes valid
  for (const c of cups) {
    const teams = cupTeams(c, 'group_position', 6)
    assert(c.size >= teams, `${c.name} bracket (${c.size}) >= teams (${teams})`)
    assert((c.size & (c.size - 1)) === 0, `${c.name} bracket (${c.size}) is power of 2`)
  }
}

// ─── buildDefaultCups: 4 groups of 4 ─────────────────────────────────────────

console.log('\n--- buildDefaultCups: 4×4 reclassification ---')
{
  const cups = buildDefaultCups(4, 4, 'reclassification')
  console.log('  cups:', JSON.stringify(cups))
  const assigned = cups.reduce((s, c) => s + (c.to - c.from + 1), 0)
  eq(assigned, 16, 'all 16 teams assigned')
}

console.log('\n--- buildDefaultCups: 4×4 group_position ---')
{
  const cups = buildDefaultCups(4, 4, 'group_position')
  console.log('  cups:', JSON.stringify(cups))
  const totalAssigned = cups.reduce((s, c) => s + cupTeams(c, 'group_position', 4), 0)
  eq(totalAssigned, 16, 'all 16 teams assigned')
  eq(cups[cups.length - 1].to, 4, 'last cup ends at pos 4')
}

// ─── buildDefaultCups: 8 groups of 5 ─────────────────────────────────────────

console.log('\n--- buildDefaultCups: 8×5 group_position ---')
{
  const cups = buildDefaultCups(8, 5, 'group_position')
  console.log('  cups:', JSON.stringify(cups))
  const totalAssigned = cups.reduce((s, c) => s + cupTeams(c, 'group_position', 8), 0)
  eq(totalAssigned, 40, 'all 40 teams assigned')
  eq(cups[cups.length - 1].to, 5, 'last cup ends at pos 5')
}

// ─── validateCups ─────────────────────────────────────────────────────────────

console.log('\n--- validateCups: valid CASB reclassification ---')
{
  const cups = [
    { name: 'Copa A', from: 1, to: 32, size: 32 },
    { name: 'Copa B', from: 33, to: 48, size: 16 },
  ]
  const v = validateCups(cups, 'reclassification', 6, 8)
  eq(v.totalAssigned, 48, 'totalAssigned = 48')
  eq(v.totalExpected, 48, 'totalExpected = 48')
  eq(v.allValid, true, 'all valid')
  eq(v.hasOverlap, false, 'no overlap')
  eq(v.hasGaps, false, 'no gaps')
  eq(v.cupErrors, [null, null], 'no errors')
}

console.log('\n--- validateCups: valid group_position 6×8 ---')
{
  const cups = [
    { name: 'Copa A', from: 1, to: 2, size: 16 },
    { name: 'Copa B', from: 3, to: 4, size: 16 },
    { name: 'Copa C', from: 5, to: 6, size: 16 },
    { name: 'Copa D', from: 7, to: 8, size: 16 },
  ]
  const v = validateCups(cups, 'group_position', 6, 8)
  eq(v.totalAssigned, 48, 'totalAssigned = 48')
  eq(v.allValid, true, 'all valid')
  eq(v.maxPos, 8, 'maxPos = 8')
}

console.log('\n--- validateCups: overlap error ---')
{
  const cups = [
    { name: 'Copa A', from: 1, to: 3, size: 32 },
    { name: 'Copa B', from: 3, to: 5, size: 32 },
  ]
  const v = validateCups(cups, 'group_position', 6, 8)
  eq(v.hasOverlap, true, 'detects overlap')
  eq(v.allValid, false, 'not valid')
}

console.log('\n--- validateCups: gap error ---')
{
  const cups = [
    { name: 'Copa A', from: 1, to: 2, size: 16 },
    { name: 'Copa B', from: 4, to: 5, size: 16 },
  ]
  const v = validateCups(cups, 'group_position', 6, 8)
  eq(v.hasGaps, true, 'detects gap')
  eq(v.allValid, false, 'not valid')
}

console.log('\n--- validateCups: exceeds maxPos ---')
{
  const cups = [
    { name: 'Copa A', from: 1, to: 10, size: 64 },
  ]
  const v = validateCups(cups, 'group_position', 6, 8)
  assert(v.cupErrors[0] !== null, 'error: exceeds maxPos 8')
  eq(v.allValid, false, 'not valid')
}

console.log('\n--- validateCups: bracket too small ---')
{
  const cups = [
    { name: 'Copa A', from: 1, to: 4, size: 8 }, // 4 pos × 6 groups = 24 teams, bracket 8 < 24
  ]
  const v = validateCups(cups, 'group_position', 6, 8)
  assert(v.cupErrors[0] !== null, 'error: bracket too small')
}

console.log('\n--- validateCups: bracket too big ---')
{
  const cups = [
    { name: 'Copa A', from: 1, to: 1, size: 64 }, // 1 pos × 6 groups = 6 teams, bracket 64 >> 12
  ]
  const v = validateCups(cups, 'group_position', 6, 8)
  assert(v.cupErrors[0] !== null, 'error: bracket too big')
}

console.log('\n--- validateCups: missing teams ---')
{
  const cups = [
    { name: 'Copa A', from: 1, to: 32, size: 32 },
    // Missing 33-48
  ]
  const v = validateCups(cups, 'reclassification', 6, 8)
  eq(v.totalAssigned, 32, 'only 32 assigned')
  eq(v.totalExpected, 48, 'expected 48')
  eq(v.allValid, false, 'not valid — missing teams')
}

// ─── Edge cases ───────────────────────────────────────────────────────────────

console.log('\n--- Edge: empty groups ---')
{
  const cups = buildDefaultCups(0, 0, 'reclassification')
  eq(cups.length, 0, 'no cups for 0 groups')
}

console.log('\n--- Edge: 1 group of 2 ---')
{
  const cups = buildDefaultCups(1, 2, 'group_position')
  console.log('  cups:', JSON.stringify(cups))
  const totalAssigned = cups.reduce((s, c) => s + cupTeams(c, 'group_position', 1), 0)
  eq(totalAssigned, 2, 'all 2 teams assigned')
}

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n${'='.repeat(50)}`)
console.log(`Results: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
