import { Injectable, Logger } from '@nestjs/common'
import { eq, sql, inArray } from 'drizzle-orm'
import { FirestoreService } from '../../common/services/firestore.service'
import { DatabaseService } from '../../db/database.service'
import { matches, matchdays, editions, registrations, registrationPlayers, teams, playerProfiles } from '../../db/schema'

interface MatchContext {
  matchId: string
  editionId: string
  editionName: string | null
  homeTeam: { id: string; name: string; logoUrl: string | null }
  awayTeam: { id: string; name: string; logoUrl: string | null }
  homeScore: number | null
  awayScore: number | null
}

interface PostData {
  sourceId: string
  type: string
  text: string
  context: {
    matchId: string
    teamId: string
    tournamentId: string
    tournamentName: string | null
    playerId: string | null
    playerName: string | null
    playerAvatarUrl: string | null
    teamName: string | null
    homeTeam: { id: string; name: string; logoUrl: string | null }
    awayTeam: { id: string; name: string; logoUrl: string | null }
    homeScore: number | null
    awayScore: number | null
    minute: number | null
  }
}

const POST_WORTHY_EVENTS = [
  'goal',
  'own_goal',
  'red_card',
  'penalty_scored',
  'penalty_missed',
  'mvp',
]

@Injectable()
export class SocialPostsService {
  private readonly logger = new Logger(SocialPostsService.name)

  constructor(
    private readonly firestoreService: FirestoreService,
    private readonly database: DatabaseService,
  ) {}

  private get db() {
    return this.database.db
  }

  private get firestore() {
    return this.firestoreService.db
  }

  /**
   * Called after a match event is created in PostgreSQL.
   */
  async onMatchEvent(event: {
    id: string
    matchId: string
    teamId: string
    eventType: string
    minute: number | null
    playerUid: string | null
    playerName: string | null
    assistPlayerUid: string | null
    assistPlayerName: string | null
  }) {
    if (!POST_WORTHY_EVENTS.includes(event.eventType)) return

    const ctx = await this.resolveMatchContext(event.matchId)
    if (!ctx) return

    const teamName =
      event.teamId === ctx.homeTeam.id
        ? ctx.homeTeam.name
        : ctx.awayTeam.name

    const text = this.generateText(event.eventType, {
      playerName: event.playerName,
      teamName,
      minute: event.minute,
      homeTeamName: ctx.homeTeam.name,
      awayTeamName: ctx.awayTeam.name,
      homeScore: ctx.homeScore,
      awayScore: ctx.awayScore,
    })

    // Resolve player avatar
    const playerAvatarUrl = await this.getPlayerAvatar(event.playerUid)

    await this.createAndDistribute({
      sourceId: event.id,
      type: event.eventType,
      text,
      context: {
        matchId: event.matchId,
        teamId: event.teamId,
        tournamentId: ctx.editionId,
        tournamentName: ctx.editionName,
        playerId: event.playerUid,
        playerName: event.playerName,
        playerAvatarUrl,
        teamName,
        homeTeam: ctx.homeTeam,
        awayTeam: ctx.awayTeam,
        homeScore: ctx.homeScore,
        awayScore: ctx.awayScore,
        minute: event.minute,
      },
    })
  }

  /**
   * Called after a match is finalized.
   */
  async onMatchFinalized(match: {
    id: string
    homeTeamId: string | null
    awayTeamId: string | null
    homeScore: number | null
    awayScore: number | null
  }) {
    const ctx = await this.resolveMatchContext(match.id)
    if (!ctx) return

    const text = this.generateText('match_result', {
      homeTeamName: ctx.homeTeam.name,
      awayTeamName: ctx.awayTeam.name,
      homeScore: match.homeScore,
      awayScore: match.awayScore,
    })

    await this.createAndDistribute({
      sourceId: `finalize_${match.id}`,
      type: 'match_result',
      text,
      context: {
        matchId: match.id,
        teamId: ctx.homeTeam.id,
        tournamentId: ctx.editionId,
        tournamentName: ctx.editionName,
        playerId: null,
        playerName: null,
        playerAvatarUrl: null,
        teamName: null,
        homeTeam: ctx.homeTeam,
        awayTeam: ctx.awayTeam,
        homeScore: match.homeScore,
        awayScore: match.awayScore,
        minute: null,
      },
    })
  }

  private async getPlayerAvatar(playerUid: string | null): Promise<string | null> {
    if (!playerUid) return null
    const [row] = await this.db
      .select({ avatarUrl: playerProfiles.avatarUrl })
      .from(playerProfiles)
      .where(eq(playerProfiles.uid, playerUid))
    return row?.avatarUrl ?? null
  }

  private async resolveMatchContext(
    matchId: string,
  ): Promise<MatchContext | null> {
    const [row] = await this.db
      .select({
        matchId: matches.id,
        editionId: matchdays.editionId,
        editionName: editions.name,
        homeTeamId: matches.homeTeamId,
        awayTeamId: matches.awayTeamId,
        homeScore: matches.homeScore,
        awayScore: matches.awayScore,
        homeTeamName: sql<string>`ht.name`,
        homeTeamLogo: sql<string | null>`ht.logo_url`,
        awayTeamName: sql<string>`at.name`,
        awayTeamLogo: sql<string | null>`at.logo_url`,
      })
      .from(matches)
      .innerJoin(matchdays, eq(matchdays.id, matches.matchdayId))
      .innerJoin(editions, eq(editions.id, matchdays.editionId))
      .leftJoin(sql`teams ht`, sql`ht.id = ${matches.homeTeamId}`)
      .leftJoin(sql`teams at`, sql`at.id = ${matches.awayTeamId}`)
      .where(eq(matches.id, matchId))

    if (!row) return null

    return {
      matchId: row.matchId,
      editionId: row.editionId,
      editionName: row.editionName,
      homeTeam: {
        id: row.homeTeamId!,
        name: row.homeTeamName,
        logoUrl: row.homeTeamLogo,
      },
      awayTeam: {
        id: row.awayTeamId!,
        name: row.awayTeamName,
        logoUrl: row.awayTeamLogo,
      },
      homeScore: row.homeScore,
      awayScore: row.awayScore,
    }
  }

  private generateText(
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
        return `Evento de partido`
    }
  }

  private async createAndDistribute(post: PostData) {
    // Idempotency: check if post with this sourceId already exists
    const existing = await this.firestore
      .collection('posts')
      .where('sourceId', '==', post.sourceId)
      .limit(1)
      .get()

    if (!existing.empty) {
      this.logger.debug(`Post already exists for sourceId ${post.sourceId}`)
      return
    }

    const postRef = this.firestore.collection('posts').doc()
    const postDoc = {
      id: postRef.id,
      source: 'system',
      sourceId: post.sourceId,
      type: post.type,
      text: post.text,
      authorType: 'system',
      authorId: null,
      context: post.context,
      media: [],
      counts: { reactions: 0, comments: 0, shares: 0 },
      createdAt: new Date(),
    }

    // Feed item (denormalized copy)
    const feedItem = {
      postId: postRef.id,
      type: post.type,
      text: post.text,
      context: post.context,
      createdAt: postDoc.createdAt,
    }

    // Resolve all feed targets (tournament, teams, match + user feeds)
    const staticTargets = this.resolveStaticFeedTargets(post.context)
    const userUids = await this.resolveUserFeeds(post.context.tournamentId)

    const allTargets = [
      ...staticTargets,
      ...userUids.map((uid) => `user_${uid}`),
    ]

    // Batch write: post + all feed items (max 500 per batch)
    const batch = this.firestore.batch()
    batch.set(postRef, postDoc)

    for (const feedId of allTargets) {
      const itemRef = this.firestore
        .collection('feeds')
        .doc(feedId)
        .collection('items')
        .doc(postRef.id)
      batch.set(itemRef, feedItem)
    }

    await batch.commit()
    this.logger.log(
      `Social post created: ${post.type} -> ${allTargets.length} feeds (${userUids.length} users)`,
    )
  }

  /**
   * Static feeds: tournament, both teams, match.
   */
  private resolveStaticFeedTargets(context: PostData['context']): string[] {
    const targets: string[] = []

    if (context.tournamentId) {
      targets.push(`tournament_${context.tournamentId}`)
    }
    if (context.homeTeam?.id) {
      targets.push(`team_${context.homeTeam.id}`)
    }
    if (context.awayTeam?.id) {
      targets.push(`team_${context.awayTeam.id}`)
    }
    if (context.matchId) {
      targets.push(`match_${context.matchId}`)
    }

    return targets
  }

  /**
   * Get all user UIDs that should receive posts from this tournament:
   * - Players registered in any team in the edition
   * - Team directors of teams in the edition
   */
  private async resolveUserFeeds(editionId: string): Promise<string[]> {
    const uids = new Set<string>()

    // Get all approved registrations for this edition
    const regs = await this.db
      .select({ id: registrations.id, teamId: registrations.teamId })
      .from(registrations)
      .where(eq(registrations.editionId, editionId))

    if (regs.length === 0) return []

    const regIds = regs.map((r) => r.id)
    const teamIds = regs.map((r) => r.teamId)

    // Players registered in these teams
    const players = await this.db
      .select({ playerUid: registrationPlayers.playerUid })
      .from(registrationPlayers)
      .where(inArray(registrationPlayers.registrationId, regIds))

    for (const p of players) {
      if (p.playerUid) uids.add(p.playerUid)
    }

    // Team directors
    const directors = await this.db
      .select({ directorUid: teams.directorUid })
      .from(teams)
      .where(inArray(teams.id, teamIds))

    for (const d of directors) {
      if (d.directorUid) uids.add(d.directorUid)
    }

    return Array.from(uids)
  }
}
