/**
 * Seed social posts in Firestore from existing match events.
 * Fan-out to tournament, team, match AND user feeds.
 *
 * Usage:
 *   npx ts-node -r tsconfig-paths/register src/db/seed-social.ts
 */
// eslint-disable-next-line @typescript-eslint/no-var-requires
require('dotenv').config()
import * as admin from 'firebase-admin'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { eq, sql, inArray } from 'drizzle-orm'
import {
  matchEvents,
  matches,
  matchdays,
  registrations,
  registrationPlayers,
  teams,
} from './schema'

if (!admin.apps.length) {
  admin.initializeApp({
    projectId: process.env.FIREBASE_PROJECT_ID ?? 'moverix',
  })
}

const firestore = admin.firestore()
firestore.settings({ databaseId: process.env.FIRESTORE_DATABASE_ID ?? 'moverix-social' })

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const db = drizzle(pool)

const POST_WORTHY = ['goal', 'own_goal', 'red_card', 'penalty_scored', 'penalty_missed', 'mvp']

function generateText(
  type: string,
  data: {
    playerName?: string | null
    teamName?: string
    minute?: number | null
    homeTeamName?: string
    awayTeamName?: string
    homeScore?: number | null
    awayScore?: number | null
  },
): string {
  const player = data.playerName ?? 'Jugador'
  const team = data.teamName ?? ''
  const min = data.minute != null ? ` al minuto ${data.minute}` : ''

  switch (type) {
    case 'goal':
      return `${player} marco para ${team}${min}`
    case 'own_goal':
      return `Autogol de ${player} (${team})${min}`
    case 'red_card':
      return `Tarjeta roja para ${player} (${team})${min}`
    case 'mvp':
      return `${player} fue elegido MVP del partido`
    case 'penalty_scored':
      return `${player} convirtio penal para ${team}${min}`
    case 'penalty_missed':
      return `${player} fallo penal para ${team}${min}`
    case 'match_result':
      return `Resultado final: ${data.homeTeamName} ${data.homeScore ?? 0} - ${data.awayScore ?? 0} ${data.awayTeamName}`
    default:
      return 'Evento de partido'
  }
}

/** Get all user UIDs registered in a given edition (players + directors) */
async function getUsersForEdition(editionId: string): Promise<string[]> {
  const uids = new Set<string>()

  const regs = await db
    .select({ id: registrations.id, teamId: registrations.teamId })
    .from(registrations)
    .where(eq(registrations.editionId, editionId))

  if (regs.length === 0) return []

  const regIds = regs.map((r) => r.id)
  const teamIds = regs.map((r) => r.teamId)

  const players = await db
    .select({ playerUid: registrationPlayers.playerUid })
    .from(registrationPlayers)
    .where(inArray(registrationPlayers.registrationId, regIds))

  for (const p of players) {
    if (p.playerUid) uids.add(p.playerUid)
  }

  const directors = await db
    .select({ directorUid: teams.directorUid })
    .from(teams)
    .where(inArray(teams.id, teamIds))

  for (const d of directors) {
    if (d.directorUid) uids.add(d.directorUid)
  }

  return Array.from(uids)
}

async function deleteCollection(path: string) {
  const colRef = firestore.collection(path)
  const snapshot = await colRef.limit(500).get()
  if (snapshot.empty) return
  const batch = firestore.batch()
  for (const doc of snapshot.docs) batch.delete(doc.ref)
  await batch.commit()
}

async function main() {
  console.log('Cleaning old Firestore data...')

  // Clean posts collection
  await deleteCollection('posts')

  // Clean feed items (we need to find all feed docs first)
  const feedsSnapshot = await firestore.collection('feeds').listDocuments()
  for (const feedDoc of feedsSnapshot) {
    const items = await feedDoc.collection('items').limit(500).get()
    if (!items.empty) {
      const batch = firestore.batch()
      for (const doc of items.docs) batch.delete(doc.ref)
      await batch.commit()
    }
    await feedDoc.delete()
  }

  console.log('Seeding social posts to Firestore...\n')

  // Cache user UIDs per edition
  const usersByEdition = new Map<string, string[]>()

  async function getUsersForEditionCached(editionId: string): Promise<string[]> {
    if (!usersByEdition.has(editionId)) {
      usersByEdition.set(editionId, await getUsersForEdition(editionId))
    }
    return usersByEdition.get(editionId)!
  }

  async function createPost(
    sourceId: string,
    type: string,
    text: string,
    context: any,
    createdAt: Date,
  ) {
    const postRef = firestore.collection('posts').doc()
    const postDoc = {
      id: postRef.id,
      source: 'system',
      sourceId,
      type,
      text,
      authorType: 'system',
      authorId: null,
      context,
      media: [],
      counts: { reactions: 0, comments: 0, shares: 0 },
      createdAt,
    }

    const feedItem = {
      postId: postRef.id,
      type,
      text,
      context,
      createdAt,
    }

    // Static feeds
    const feedTargets = [
      `tournament_${context.tournamentId}`,
      `team_${context.homeTeam.id}`,
      `team_${context.awayTeam.id}`,
      `match_${context.matchId}`,
    ]

    // User feeds
    const userUids = await getUsersForEditionCached(context.tournamentId)
    for (const uid of userUids) {
      feedTargets.push(`user_${uid}`)
    }

    const batch = firestore.batch()
    batch.set(postRef, postDoc)
    for (const feedId of feedTargets) {
      const itemRef = firestore
        .collection('feeds')
        .doc(feedId)
        .collection('items')
        .doc(postRef.id)
      batch.set(itemRef, feedItem)
    }
    await batch.commit()

    console.log(`  [${type}] ${text} -> ${feedTargets.length} feeds (${userUids.length} users)`)
  }

  // Get all match events with context
  const events = await db
    .select({
      id: matchEvents.id,
      matchId: matchEvents.matchId,
      teamId: matchEvents.teamId,
      eventType: matchEvents.eventType,
      minute: matchEvents.minute,
      playerUid: matchEvents.playerUid,
      playerName: matchEvents.playerName,
      createdAt: matchEvents.createdAt,
      editionId: matchdays.editionId,
      homeTeamId: matches.homeTeamId,
      awayTeamId: matches.awayTeamId,
      homeScore: matches.homeScore,
      awayScore: matches.awayScore,
      homeTeamName: sql<string>`ht.name`,
      homeTeamLogo: sql<string | null>`ht.logo_url`,
      awayTeamName: sql<string>`att.name`,
      awayTeamLogo: sql<string | null>`att.logo_url`,
    })
    .from(matchEvents)
    .innerJoin(matches, eq(matches.id, matchEvents.matchId))
    .innerJoin(matchdays, eq(matchdays.id, matches.matchdayId))
    .leftJoin(sql`teams ht`, sql`ht.id = ${matches.homeTeamId}`)
    .leftJoin(sql`teams att`, sql`att.id = ${matches.awayTeamId}`)

  let count = 0

  for (const ev of events) {
    if (!POST_WORTHY.includes(ev.eventType)) continue

    const teamName =
      ev.teamId === ev.homeTeamId ? ev.homeTeamName : ev.awayTeamName

    const text = generateText(ev.eventType, {
      playerName: ev.playerName,
      teamName,
      minute: ev.minute,
    })

    const context = {
      matchId: ev.matchId,
      teamId: ev.teamId,
      tournamentId: ev.editionId,
      playerId: ev.playerUid,
      homeTeam: { id: ev.homeTeamId!, name: ev.homeTeamName, logoUrl: ev.homeTeamLogo },
      awayTeam: { id: ev.awayTeamId!, name: ev.awayTeamName, logoUrl: ev.awayTeamLogo },
      homeScore: ev.homeScore,
      awayScore: ev.awayScore,
      minute: ev.minute,
    }

    await createPost(ev.id, ev.eventType, text, context, ev.createdAt ?? new Date())
    count++
  }

  // Match result posts for finished matches
  const finishedMatches = await db
    .select({
      id: matches.id,
      homeTeamId: matches.homeTeamId,
      awayTeamId: matches.awayTeamId,
      homeScore: matches.homeScore,
      awayScore: matches.awayScore,
      finishedAt: matches.finishedAt,
      editionId: matchdays.editionId,
      homeTeamName: sql<string>`ht.name`,
      homeTeamLogo: sql<string | null>`ht.logo_url`,
      awayTeamName: sql<string>`att.name`,
      awayTeamLogo: sql<string | null>`att.logo_url`,
    })
    .from(matches)
    .innerJoin(matchdays, eq(matchdays.id, matches.matchdayId))
    .leftJoin(sql`teams ht`, sql`ht.id = ${matches.homeTeamId}`)
    .leftJoin(sql`teams att`, sql`att.id = ${matches.awayTeamId}`)
    .where(eq(matches.status, 'finished'))

  for (const m of finishedMatches) {
    const text = generateText('match_result', {
      homeTeamName: m.homeTeamName,
      awayTeamName: m.awayTeamName,
      homeScore: m.homeScore,
      awayScore: m.awayScore,
    })

    const context = {
      matchId: m.id,
      teamId: m.homeTeamId!,
      tournamentId: m.editionId,
      playerId: null,
      homeTeam: { id: m.homeTeamId!, name: m.homeTeamName, logoUrl: m.homeTeamLogo },
      awayTeam: { id: m.awayTeamId!, name: m.awayTeamName, logoUrl: m.awayTeamLogo },
      homeScore: m.homeScore,
      awayScore: m.awayScore,
      minute: null,
    }

    await createPost(`finalize_${m.id}`, 'match_result', text, context, m.finishedAt ?? new Date())
    count++
  }

  console.log(`\nDone! Created ${count} social posts in Firestore.`)
  await pool.end()
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
