/**
 * Seed script — populates the database with sample tournament data.
 *
 * Usage:
 *   npm run db:seed
 *   # or
 *   ts-node -r tsconfig-paths/register src/db/seed.ts
 *
 * ⚠️  Truncates existing data before seeding.
 */
// eslint-disable-next-line @typescript-eslint/no-var-requires
require('dotenv').config()
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { sql } from 'drizzle-orm'
import {
  organizations,
  leagues,
  editions,
  venues,
  teams,
  registrations,
  registrationPlayers,
  groups,
} from './schema'

// ── Replace with your own Firebase UID after registering in the app ──
const MY_UID = process.env.SEED_USER_UID || 'seed-user-001'

async function seed() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  const db = drizzle(pool)

  console.log('🌱  Seeding database...\n')

  // ── Truncate (cascade) ───────────────────────────────────────
  await db.execute(sql`
    TRUNCATE organizations, leagues, editions, venues, teams,
             registrations, registration_players, groups
    CASCADE
  `)
  console.log('   Truncated tables.')

  // ── 1. Organization ──────────────────────────────────────────
  const [casb] = await db
    .insert(organizations)
    .values({
      name: 'Club Atlético Santa Bárbara',
      slug: 'casb',
      city: 'Bogotá',
      country: 'CO',
      ownerUid: MY_UID,
    })
    .returning()

  const [comItagui] = await db
    .insert(organizations)
    .values({
      name: 'Comunidad Itagüí',
      slug: 'comunidad-itagui',
      city: 'Itagüí',
      country: 'CO',
      ownerUid: MY_UID,
    })
    .returning()

  const [escNorte] = await db
    .insert(organizations)
    .values({
      name: 'Escenarios Norte',
      slug: 'escenarios-norte',
      city: 'Medellín',
      country: 'CO',
      ownerUid: MY_UID,
    })
    .returning()

  console.log('   3 organizations created.')

  // ── 2. Venues ────────────────────────────────────────────────
  await db.insert(venues).values([
    { organizationId: casb.id, name: 'Cancha Central CASB', city: 'Bogotá', pitchCount: 2 },
    { organizationId: casb.id, name: 'Sede Norte CASB', city: 'Bogotá', pitchCount: 1 },
    { organizationId: casb.id, name: 'Complejo Sur CASB', city: 'Bogotá', pitchCount: 1 },
    { organizationId: comItagui.id, name: 'Polideportivo Itagüí', city: 'Itagüí', pitchCount: 2 },
    { organizationId: escNorte.id, name: 'Escenario Nocturno Norte', city: 'Medellín', pitchCount: 1 },
  ])
  console.log('   5 venues created.')

  // ── 3. Leagues ───────────────────────────────────────────────
  const [ligaCasb] = await db
    .insert(leagues)
    .values({
      organizationId: casb.id,
      name: 'Liga CASB',
      slug: 'liga-casb',
      sportFormat: 'F11',
      gender: 'M',
      description: 'Liga principal de fútbol 11 del Club Atlético Santa Bárbara',
    })
    .returning()

  const [ligaBarrio] = await db
    .insert(leagues)
    .values({
      organizationId: comItagui.id,
      name: 'Liga Barrio Sur',
      slug: 'liga-barrio-sur',
      sportFormat: 'F5',
      gender: 'M',
      description: 'Torneo de microfútbol barrial — domingos',
    })
    .returning()

  const [copaNocturna] = await db
    .insert(leagues)
    .values({
      organizationId: escNorte.id,
      name: 'Copa Nocturna',
      slug: 'copa-nocturna',
      sportFormat: 'F5',
      gender: 'M',
      description: 'Torneo nocturno de fútbol 5 — viernes noche',
    })
    .returning()

  const [ligaVerano] = await db
    .insert(leagues)
    .values({
      organizationId: casb.id,
      name: 'Copa Verano',
      slug: 'copa-verano',
      sportFormat: 'F11',
      gender: 'M',
      description: 'Torneo de verano del CASB',
    })
    .returning()

  console.log('   4 leagues created.')

  // ── 4. Editions ──────────────────────────────────────────────
  const [copaCasb2025] = await db
    .insert(editions)
    .values({
      leagueId: ligaCasb.id,
      name: 'Copa CASB 2025',
      slug: 'copa-casb-2025',
      season: '2025-I',
      status: 'active',
      maxTeams: 48,
      registrationFee: 1200000,
      prizePool: 15000000,
      currency: 'COP',
      startDate: new Date('2025-03-15'),
      endDate: new Date('2025-11-30'),
    })
    .returning()

  const [ligaBarrioSur] = await db
    .insert(editions)
    .values({
      leagueId: ligaBarrio.id,
      name: 'Liga Barrio Sur 2025',
      slug: 'liga-barrio-sur-2025',
      season: '2025',
      status: 'registration',
      maxTeams: 16,
      registrationFee: 400000,
      prizePool: 3000000,
      currency: 'COP',
      startDate: new Date('2025-06-01'),
    })
    .returning()

  const [torneoNocturno] = await db
    .insert(editions)
    .values({
      leagueId: copaNocturna.id,
      name: 'Torneo Nocturno Copa Luna',
      slug: 'torneo-nocturno-copa-luna',
      season: '2025',
      status: 'registration',
      maxTeams: 12,
      registrationFee: 200000,
      prizePool: 1500000,
      currency: 'COP',
      startDate: new Date('2025-07-01'),
    })
    .returning()

  await db
    .insert(editions)
    .values({
      leagueId: ligaVerano.id,
      name: 'Copa Verano 2025',
      slug: 'copa-verano-2025',
      season: '2025',
      status: 'draft',
      maxTeams: 24,
      registrationFee: 800000,
      prizePool: 8000000,
      currency: 'COP',
      startDate: new Date('2025-12-01'),
    })
    .returning()

  console.log('   4 editions created.')

  // ── 5. Groups (for active edition) ───────────────────────────
  const [grupoA] = await db
    .insert(groups)
    .values({ editionId: copaCasb2025.id, name: 'Grupo A', code: 'A', phase: 'Jd/7', order: 0, maxTeams: 8 })
    .returning()

  await db.insert(groups).values([
    { editionId: copaCasb2025.id, name: 'Grupo B', code: 'B', phase: 'Jd/7', order: 1, maxTeams: 8 },
    { editionId: copaCasb2025.id, name: 'Grupo C', code: 'C', phase: 'Jd/7', order: 2, maxTeams: 8 },
    { editionId: copaCasb2025.id, name: 'Grupo D', code: 'D', phase: 'Jd/7', order: 3, maxTeams: 8 },
  ])
  console.log('   4 groups created.')

  // ── 6. Teams ─────────────────────────────────────────────────
  const [domun] = await db
    .insert(teams)
    .values({
      directorUid: MY_UID,
      name: 'Domun FC',
      shortName: 'DOM',
      slug: 'domun_fc_' + Math.random().toString(36).slice(2, 8),
      accessCode: 'DOMUN1',
      primaryColor: '#7BFF00',
      secondaryColor: '#050B10',
      city: 'Bogotá',
    })
    .returning()

  const teamNames = [
    { name: 'Real Santander', short: 'RSA', color: '#FFCC00', city: 'Bucaramanga' },
    { name: 'Atlético Norte', short: 'ATN', color: '#FF4444', city: 'Medellín' },
    { name: 'Deportivo Sur', short: 'DSU', color: '#4488FF', city: 'Cali' },
    { name: 'Club Nacional', short: 'CNA', color: '#00AA44', city: 'Bogotá' },
    { name: 'Independiente FC', short: 'IFC', color: '#FF6600', city: 'Bogotá' },
    { name: 'Sporting Barrio', short: 'SPB', color: '#AA44FF', city: 'Itagüí' },
    { name: 'FC Estrellas', short: 'EST', color: '#FFD700', city: 'Medellín' },
    { name: 'Los Halcones', short: 'HAL', color: '#888888', city: 'Bogotá' },
    { name: 'Pumas FC', short: 'PUM', color: '#FF2277', city: 'Cali' },
    { name: 'Águilas Doradas', short: 'AGU', color: '#DDAA00', city: 'Barranquilla' },
    { name: 'Rebeldes FC', short: 'REB', color: '#CC0000', city: 'Medellín' },
  ]

  const otherTeams = await db
    .insert(teams)
    .values(
      teamNames.map((t) => ({
        directorUid: `seed-director-${t.short.toLowerCase()}`,
        name: t.name,
        shortName: t.short,
        slug: t.short.toLowerCase() + '_' + Math.random().toString(36).slice(2, 8),
        accessCode: t.short.toUpperCase().slice(0, 4) + '01',
        primaryColor: t.color,
        city: t.city,
      })),
    )
    .returning()

  console.log(`   ${1 + otherTeams.length} teams created.`)

  // ── 7. Registrations ─────────────────────────────────────────
  // My team in Copa CASB 2025 (active, group A)
  const [myReg] = await db
    .insert(registrations)
    .values({
      editionId: copaCasb2025.id,
      teamId: domun.id,
      groupId: grupoA.id,
      status: 'approved',
      registeredByUid: MY_UID,
      paidAt: new Date(),
      approvedAt: new Date(),
    })
    .returning()

  // Register other teams in Copa CASB 2025
  const casbTeams = otherTeams.slice(0, 7)
  for (const t of casbTeams) {
    await db.insert(registrations).values({
      editionId: copaCasb2025.id,
      teamId: t.id,
      status: 'approved',
      registeredByUid: t.directorUid,
      approvedAt: new Date(),
    })
  }

  // Register some teams in Liga Barrio Sur (registration open)
  const barrioTeams = otherTeams.slice(5, 9)
  for (const t of barrioTeams) {
    await db.insert(registrations).values({
      editionId: ligaBarrioSur.id,
      teamId: t.id,
      status: 'approved',
      registeredByUid: t.directorUid,
      approvedAt: new Date(),
    })
  }

  // Register some teams in Torneo Nocturno
  const noctTeams = otherTeams.slice(8, 11)
  for (const t of noctTeams) {
    await db.insert(registrations).values({
      editionId: torneoNocturno.id,
      teamId: t.id,
      status: 'approved',
      registeredByUid: t.directorUid,
      approvedAt: new Date(),
    })
  }

  console.log('   Registrations created.')

  // ── 8. Roster — My team players ──────────────────────────────
  const players = [
    { name: 'Jhon Cortés', pos: 'CM', num: 10, captain: true, uid: MY_UID },
    { name: 'Santiago Muñoz', pos: 'GK', num: 1, captain: false, uid: 'seed-p-02' },
    { name: 'Andrés Gómez', pos: 'CB', num: 4, captain: false, uid: 'seed-p-03' },
    { name: 'Daniel Ríos', pos: 'CB', num: 5, captain: false, uid: 'seed-p-04' },
    { name: 'Mateo López', pos: 'LB', num: 3, captain: false, uid: 'seed-p-05' },
    { name: 'Sebastián Torres', pos: 'RB', num: 2, captain: false, uid: 'seed-p-06' },
    { name: 'Felipe Herrera', pos: 'CDM', num: 6, captain: false, uid: 'seed-p-07' },
    { name: 'Camilo Vargas', pos: 'CAM', num: 8, captain: false, uid: 'seed-p-08' },
    { name: 'David Mejía', pos: 'LW', num: 11, captain: false, uid: 'seed-p-09' },
    { name: 'Nicolás Arias', pos: 'RW', num: 7, captain: false, uid: 'seed-p-10' },
    { name: 'Juan Pablo Ruiz', pos: 'ST', num: 9, captain: false, uid: 'seed-p-11' },
    { name: 'Carlos Martínez', pos: 'CM', num: 14, captain: false, uid: 'seed-p-12' },
    { name: 'Luis Salazar', pos: 'CF', num: 20, captain: false, uid: 'seed-p-13' },
  ]

  await db.insert(registrationPlayers).values(
    players.map((p) => ({
      registrationId: myReg.id,
      playerUid: p.uid,
      playerName: p.name,
      position: p.pos as any,
      jerseyNumber: p.num,
      isCaptain: p.captain,
    })),
  )

  console.log(`   ${players.length} players added to Domun FC roster.`)

  // ── Done ─────────────────────────────────────────────────────
  console.log('\n✅  Seed complete!')
  console.log(`\n   UID used: ${MY_UID}`)
  console.log('   Set SEED_USER_UID env var to your Firebase UID before seeding.')
  console.log('   Example: SEED_USER_UID=abc123 npm run db:seed\n')

  await pool.end()
}

seed().catch((err) => {
  console.error('❌  Seed failed:', err)
  process.exit(1)
})
