import { Injectable } from '@nestjs/common'
import { eq, inArray } from 'drizzle-orm'
import { FirestoreService } from '../../common/services/firestore.service'
import { DatabaseService } from '../../db/database.service'
import { playerProfiles, teams, editions } from '../../db/schema'

export interface FeedItemResponse {
  id: string
  type: string
  text: string
  createdAt: string
  context: {
    matchId?: string
    teamId?: string
    tournamentId?: string
    tournamentName?: string | null
    playerId?: string | null
    playerName?: string | null
    teamName?: string | null
    homeTeam?: { id: string; name: string; logoUrl: string | null }
    awayTeam?: { id: string; name: string; logoUrl: string | null }
    homeScore?: number | null
    awayScore?: number | null
    minute?: number | null
  }
  imageUrl: string | null
  imageType: 'player' | 'team' | 'edition'
}

@Injectable()
export class MobileFeedService {
  constructor(
    private readonly firestoreService: FirestoreService,
    private readonly database: DatabaseService,
  ) {}

  private get firestore() {
    return this.firestoreService.db
  }

  private get db() {
    return this.database.db
  }

  async getFeed(uid: string, limit = 30): Promise<FeedItemResponse[]> {
    const snapshot = await this.firestore
      .collection('feeds')
      .doc(`user_${uid}`)
      .collection('items')
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get()

    if (snapshot.empty) return []

    // Collect unique playerIds, teamIds and editionIds to batch-fetch live data
    const playerUids = new Set<string>()
    const teamIds = new Set<string>()
    const editionIds = new Set<string>()
    for (const doc of snapshot.docs) {
      const ctx = doc.data().context
      if (ctx?.playerId) playerUids.add(ctx.playerId)
      if (ctx?.homeTeam?.id) teamIds.add(ctx.homeTeam.id)
      if (ctx?.awayTeam?.id) teamIds.add(ctx.awayTeam.id)
      if (ctx?.tournamentId) editionIds.add(ctx.tournamentId)
    }

    const [avatarMap, teamLogoMap, editionNameMap] = await Promise.all([
      this.getAvatars([...playerUids]),
      this.getTeamLogos([...teamIds]),
      this.getEditionNames([...editionIds]),
    ])

    return snapshot.docs.map((doc) => {
      const data = doc.data()
      const ctx = data.context ?? {}

      // Hydrate logos and tournament name from live data so updates replace stale snapshots
      if (ctx.homeTeam?.id && teamLogoMap.has(ctx.homeTeam.id)) {
        ctx.homeTeam.logoUrl = teamLogoMap.get(ctx.homeTeam.id)!
      }
      if (ctx.awayTeam?.id && teamLogoMap.has(ctx.awayTeam.id)) {
        ctx.awayTeam.logoUrl = teamLogoMap.get(ctx.awayTeam.id)!
      }
      if (ctx.tournamentId && editionNameMap.has(ctx.tournamentId)) {
        ctx.tournamentName = editionNameMap.get(ctx.tournamentId)!
      }

      // Resolve image: player avatar > team logo > home team logo
      let imageUrl: string | null = null
      let imageType: 'player' | 'team' | 'edition' = 'edition'

      if (ctx.playerId && avatarMap.get(ctx.playerId)) {
        imageUrl = avatarMap.get(ctx.playerId)!
        imageType = 'player'
      } else if (ctx.teamId) {
        const teamLogo =
          ctx.homeTeam?.id === ctx.teamId
            ? ctx.homeTeam?.logoUrl
            : ctx.awayTeam?.logoUrl
        if (teamLogo) {
          imageUrl = teamLogo
          imageType = 'team'
        }
      }

      if (!imageUrl && ctx.homeTeam?.logoUrl) {
        imageUrl = ctx.homeTeam.logoUrl
        imageType = 'team'
      }

      return {
        id: doc.id,
        type: data.type,
        text: data.text,
        createdAt: data.createdAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
        context: ctx,
        imageUrl,
        imageType,
      }
    })
  }

  async purgeOldPosts(before: Date) {
    // Delete old posts
    const postsSnap = await this.firestore
      .collection('posts')
      .where('createdAt', '<', before)
      .get()

    if (postsSnap.empty) return { deletedPosts: 0, deletedFeedItems: 0 }

    const postIds = postsSnap.docs.map((d) => d.id)

    // Delete feed items referencing these posts
    const feedDocs = await this.firestore.collection('feeds').listDocuments()
    let deletedFeedItems = 0

    // Firestore batches max 500 ops
    let batch = this.firestore.batch()
    let ops = 0

    for (const feedDoc of feedDocs) {
      const itemsSnap = await feedDoc.collection('items').where('createdAt', '<', before).get()
      for (const item of itemsSnap.docs) {
        batch.delete(item.ref)
        ops++
        deletedFeedItems++
        if (ops >= 490) {
          await batch.commit()
          batch = this.firestore.batch()
          ops = 0
        }
      }
    }

    // Delete posts themselves
    for (const doc of postsSnap.docs) {
      batch.delete(doc.ref)
      ops++
      if (ops >= 490) {
        await batch.commit()
        batch = this.firestore.batch()
        ops = 0
      }
    }

    if (ops > 0) await batch.commit()

    return { deletedPosts: postIds.length, deletedFeedItems }
  }

  private async getAvatars(uids: string[]): Promise<Map<string, string | null>> {
    const map = new Map<string, string | null>()
    if (uids.length === 0) return map

    const rows = await this.db
      .select({ uid: playerProfiles.uid, avatarUrl: playerProfiles.avatarUrl })
      .from(playerProfiles)
      .where(uids.length === 1 ? eq(playerProfiles.uid, uids[0]) : inArray(playerProfiles.uid, uids))

    for (const r of rows) {
      map.set(r.uid, r.avatarUrl)
    }

    return map
  }

  private async getTeamLogos(ids: string[]): Promise<Map<string, string | null>> {
    const map = new Map<string, string | null>()
    if (ids.length === 0) return map

    const rows = await this.db
      .select({ id: teams.id, logoUrl: teams.logoUrl })
      .from(teams)
      .where(ids.length === 1 ? eq(teams.id, ids[0]) : inArray(teams.id, ids))

    for (const r of rows) {
      map.set(r.id, r.logoUrl)
    }

    return map
  }

  private async getEditionNames(ids: string[]): Promise<Map<string, string>> {
    const map = new Map<string, string>()
    if (ids.length === 0) return map

    const rows = await this.db
      .select({ id: editions.id, name: editions.name })
      .from(editions)
      .where(ids.length === 1 ? eq(editions.id, ids[0]) : inArray(editions.id, ids))

    for (const r of rows) {
      map.set(r.id, r.name)
    }

    return map
  }
}
