import { Injectable } from '@nestjs/common'
import { eq, inArray } from 'drizzle-orm'
import { FirestoreService } from '../../common/services/firestore.service'
import { DatabaseService } from '../../db/database.service'
import { playerProfiles } from '../../db/schema'

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

    // Collect unique playerIds to batch-fetch avatars
    const playerUids = new Set<string>()
    for (const doc of snapshot.docs) {
      const ctx = doc.data().context
      if (ctx?.playerId) playerUids.add(ctx.playerId)
    }

    const avatarMap = await this.getAvatars([...playerUids])

    return snapshot.docs.map((doc) => {
      const data = doc.data()
      const ctx = data.context ?? {}

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
}
