import { Injectable, ConflictException } from '@nestjs/common'
import { eq, sql, and, or, desc, ne, like, ilike } from 'drizzle-orm'
import * as admin from 'firebase-admin'
import { DatabaseService } from '../../db/database.service'
import { StorageService } from '../../common/services/storage.service'
import {
  playerProfiles,
  playerStats,
  registrationPlayers,
  registrations,
  teams,
  editions,
  leagues,
  matches,
  matchEvents,
  follows,
  fines,
  teamMembers,
} from '../../db/schema'

@Injectable()
export class MobilePlayersService {
  constructor(
    private readonly database: DatabaseService,
    private readonly storage: StorageService,
  ) {}

  private get db() {
    return this.database.db
  }

  /**
   * Public player profile: personal info + career stats + current teams.
   */
  async profile(uid: string, viewerUid?: string) {
    // Profile (optional — may not exist yet)
    const [profile] = await this.db
      .select()
      .from(playerProfiles)
      .where(eq(playerProfiles.uid, uid))

    // All-time stats across editions
    const stats = await this.db
      .select({
        editionId: playerStats.editionId,
        editionName: editions.name,
        editionSeason: editions.season,
        editionStatus: editions.status,
        leagueName: leagues.name,
        teamId: playerStats.teamId,
        teamName: sql<string>`t.name`,
        teamLogoUrl: sql<string | null>`t.logo_url`,
        matchesPlayed: playerStats.matchesPlayed,
        goals: playerStats.goals,
        assists: playerStats.assists,
        yellowCards: playerStats.yellowCards,
        redCards: playerStats.redCards,
        minutesPlayed: playerStats.minutesPlayed,
      })
      .from(playerStats)
      .innerJoin(editions, eq(editions.id, playerStats.editionId))
      .innerJoin(leagues, eq(leagues.id, editions.leagueId))
      .leftJoin(sql`teams t`, sql`t.id = ${playerStats.teamId}`)
      .where(eq(playerStats.playerUid, uid))
      .orderBy(desc(editions.startDate))

    // Current registrations (active teams)
    const currentTeams = await this.db
      .select({
        registrationId: registrations.id,
        jerseyNumber: registrationPlayers.jerseyNumber,
        position: registrationPlayers.position,
        isCaptain: registrationPlayers.isCaptain,
        playerName: registrationPlayers.playerName,
        team: {
          id: teams.id,
          name: teams.name,
          logoUrl: teams.logoUrl,
          primaryColor: teams.primaryColor,
        },
        edition: {
          id: editions.id,
          name: editions.name,
          status: editions.status,
        },
      })
      .from(registrationPlayers)
      .innerJoin(registrations, eq(registrations.id, registrationPlayers.registrationId))
      .innerJoin(teams, eq(teams.id, registrations.teamId))
      .innerJoin(editions, eq(editions.id, registrations.editionId))
      .where(eq(registrationPlayers.playerUid, uid))
      .orderBy(desc(editions.startDate))

    // Aggregate totals
    const totals = {
      matchesPlayed: 0,
      goals: 0,
      assists: 0,
      yellowCards: 0,
      redCards: 0,
      minutesPlayed: 0,
    }
    for (const s of stats) {
      totals.matchesPlayed += s.matchesPlayed
      totals.goals += s.goals
      totals.assists += s.assists
      totals.yellowCards += s.yellowCards
      totals.redCards += s.redCards
      totals.minutesPlayed += s.minutesPlayed
    }

    // Achievements: MVP awards
    const mvpAwards = await this.db
      .select({
        matchId: matchEvents.matchId,
        editionName: editions.name,
        editionSeason: editions.season,
        teamName: sql<string>`t2.name`,
      })
      .from(matchEvents)
      .innerJoin(matches, eq(matches.id, matchEvents.matchId))
      .innerJoin(sql`matchdays md`, sql`md.id = ${matches.matchdayId}`)
      .innerJoin(editions, sql`${editions.id} = md.edition_id`)
      .leftJoin(sql`teams t2`, sql`t2.id = ${matchEvents.teamId}`)
      .where(
        and(
          eq(matchEvents.playerUid, uid),
          eq(matchEvents.eventType, 'mvp'),
        ),
      )
      .orderBy(desc(matches.finishedAt))

    const achievements: { type: string; label: string; count?: number; detail?: string }[] = []
    if (mvpAwards.length > 0) {
      achievements.push({
        type: 'mvp',
        label: 'MVP',
        count: mvpAwards.length,
        detail: mvpAwards[0].editionName,
      })
    }

    // Recent matches with details (last 5)
    let recentMatches: {
      result: string
      opponent: string
      myScore: number
      oppScore: number
      playerGoals: number
      playerAssists: number
      wasMvp: boolean
    }[] = []

    const primaryTeam = currentTeams[0]
    if (primaryTeam) {
      const tid = primaryTeam.team.id

      const last5 = await this.db
        .select({
          id: matches.id,
          homeTeamId: matches.homeTeamId,
          awayTeamId: matches.awayTeamId,
          homeScore: matches.homeScore,
          awayScore: matches.awayScore,
          homeTeamName: sql<string>`ht.name`,
          awayTeamName: sql<string>`at.name`,
        })
        .from(matches)
        .leftJoin(sql`teams ht`, sql`ht.id = ${matches.homeTeamId}`)
        .leftJoin(sql`teams at`, sql`at.id = ${matches.awayTeamId}`)
        .where(
          and(
            eq(matches.status, 'finished'),
            or(eq(matches.homeTeamId, tid), eq(matches.awayTeamId, tid)),
          ),
        )
        .orderBy(desc(matches.finishedAt))
        .limit(5)

      // Get player events for these matches
      const matchIds = last5.map((m) => m.id)
      let pEvents: { matchId: string; eventType: string; playerUid: string | null; assistPlayerUid: string | null }[] = []

      if (matchIds.length > 0) {
        pEvents = await this.db
          .select({
            matchId: matchEvents.matchId,
            eventType: matchEvents.eventType,
            playerUid: matchEvents.playerUid,
            assistPlayerUid: matchEvents.assistPlayerUid,
          })
          .from(matchEvents)
          .where(
            and(
              sql`${matchEvents.matchId} IN (${sql.join(matchIds.map((id) => sql`${id}::uuid`), sql`, `)})`,
              or(eq(matchEvents.playerUid, uid), eq(matchEvents.assistPlayerUid, uid)),
            ),
          )
      }

      recentMatches = last5.map((m) => {
        const isHome = m.homeTeamId === tid
        const my = (isHome ? m.homeScore : m.awayScore) ?? 0
        const opp = (isHome ? m.awayScore : m.homeScore) ?? 0
        const opponent = (isHome ? m.awayTeamName : m.homeTeamName) ?? 'Rival'

        let result = 'D'
        if (my > opp) result = 'W'
        else if (my < opp) result = 'L'

        const evts = pEvents.filter((e) => e.matchId === m.id)

        return {
          result,
          opponent,
          myScore: my,
          oppScore: opp,
          playerGoals: evts.filter(
            (e) => e.playerUid === uid && (e.eventType === 'goal' || e.eventType === 'penalty_scored'),
          ).length,
          playerAssists: evts.filter(
            (e) => e.assistPlayerUid === uid && (e.eventType === 'goal' || e.eventType === 'penalty_scored'),
          ).length,
          wasMvp: evts.some((e) => e.playerUid === uid && e.eventType === 'mvp'),
        }
      })
    }

    // Is viewer following this player?
    let isFollowing = false
    if (viewerUid && viewerUid !== uid) {
      const [row] = await this.db
        .select({ id: follows.id })
        .from(follows)
        .where(and(eq(follows.followerUid, viewerUid), eq(follows.followedUid, uid)))
      isFollowing = !!row
    }

    // Derive name from registrations if no profile
    const displayName =
      profile?.fullName ??
      currentTeams[0]?.playerName ??
      stats[0]?.teamName ??
      'Jugador'

    return {
      uid,
      displayName,
      username: profile?.username ?? null,
      profile: profile
        ? {
            avatarUrl: profile.avatarUrl,
            bio: profile.bio,
            city: profile.city,
            country: profile.country,
            position: profile.position,
            preferredFoot: profile.preferredFoot,
            birthYear: profile.birthYear,
            docNumber: profile.docNumber,
            followersCount: profile.followersCount,
            followingCount: profile.followingCount,
          }
        : null,
      totals,
      statsByEdition: stats,
      currentTeams,
      recentMatches,
      mvpCount: mvpAwards.length,
      achievements,
      isFollowing,
    }
  }

  /**
   * Get or create the authenticated user's profile.
   */
  async myProfile(uid: string, email?: string, name?: string) {
    const [existing] = await this.db
      .select()
      .from(playerProfiles)
      .where(eq(playerProfiles.uid, uid))

    if (existing) return existing

    // Auto-create minimal profile
    const displayName =
      name ??
      email?.split('@')[0] ??
      'Jugador'

    const username = `player_${uid.slice(0, 8).toLowerCase()}`

    const [created] = await this.db
      .insert(playerProfiles)
      .values({
        uid,
        username,
        fullName: displayName,
      })
      .returning()

    return created
  }

  /**
   * Update the authenticated user's profile.
   * If docNumber is provided, claims all registration_players, player_stats
   * and fines that match that docNumber but have a placeholder playerUid.
   */
  async updateProfile(
    uid: string,
    dto: {
      fullName?: string
      username?: string
      bio?: string
      city?: string
      country?: string
      position?: string
      preferredFoot?: string
      birthYear?: number
      avatarUrl?: string
      docNumber?: string
    },
  ) {
    // Ensure profile exists
    await this.myProfile(uid)

    const { position, docNumber, ...rest } = dto
    try {
      const [updated] = await this.db
        .update(playerProfiles)
        .set({
          ...rest,
          ...(position !== undefined && { position: position as any }),
          ...(docNumber !== undefined && { docNumber }),
          updatedAt: new Date(),
        })
        .where(eq(playerProfiles.uid, uid))
        .returning()

      // Claim records that match this docNumber
      if (docNumber) {
        await this.claimByDocNumber(uid, docNumber, updated.fullName)
      }

      return updated
    } catch (err: any) {
      if (err?.code === '23505' && err?.constraint?.includes('username')) {
        throw new ConflictException('Este username ya esta en uso')
      }
      if (err?.code === '23505' && err?.constraint?.includes('doc_number')) {
        throw new ConflictException('Este numero de documento ya esta registrado por otro usuario')
      }
      throw err
    }
  }

  /**
   * Upload avatar photo for the authenticated user.
   */
  async uploadAvatar(uid: string, file: Express.Multer.File) {
    const profile = await this.myProfile(uid)

    if (profile.avatarUrl) {
      await this.storage.deleteFile(profile.avatarUrl)
    }

    const avatarUrl = await this.storage.uploadLogo(`players/${uid}`, file)

    const [updated] = await this.db
      .update(playerProfiles)
      .set({ avatarUrl, updatedAt: new Date() })
      .where(eq(playerProfiles.uid, uid))
      .returning()

    return updated
  }

  /**
   * Link all registration_players, player_stats and fines with a matching
   * docNumber to the claiming user's uid.
   */
  private async claimByDocNumber(uid: string, docNumber: string, fullName: string) {
    // 1. Find unclaimed registration_players by docNumber
    let orphanPlayers = await this.db
      .select({
        id: registrationPlayers.id,
        playerUid: registrationPlayers.playerUid,
        registrationId: registrationPlayers.registrationId,
      })
      .from(registrationPlayers)
      .where(
        and(
          eq(registrationPlayers.docNumber, docNumber),
          ne(registrationPlayers.playerUid, uid),
        ),
      )

    // 2. If no match by docNumber, try by name for placeholder UIDs (manual:*)
    if (orphanPlayers.length === 0 && fullName) {
      orphanPlayers = await this.db
        .select({
          id: registrationPlayers.id,
          playerUid: registrationPlayers.playerUid,
          registrationId: registrationPlayers.registrationId,
        })
        .from(registrationPlayers)
        .where(
          and(
            ilike(registrationPlayers.playerName, fullName.trim()),
            like(registrationPlayers.playerUid, 'manual:%'),
          ),
        )

      // Set docNumber on matched records so future lookups work by CC
      for (const p of orphanPlayers) {
        await this.db
          .update(registrationPlayers)
          .set({ docNumber })
          .where(eq(registrationPlayers.id, p.id))
      }
    }

    // Claim orphan records
    if (orphanPlayers.length > 0) {
      const oldUids = [...new Set(orphanPlayers.map((p) => p.playerUid))]

      // Update registration_players: set playerUid to the claiming user
      for (const p of orphanPlayers) {
        await this.db
          .update(registrationPlayers)
          .set({ playerUid: uid, docNumber })
          .where(eq(registrationPlayers.id, p.id))
      }

      // Update player_stats
      for (const oldUid of oldUids) {
        await this.db
          .update(playerStats)
          .set({ playerUid: uid, playerName: fullName })
          .where(eq(playerStats.playerUid, oldUid))
      }

      // Update match_events
      for (const oldUid of oldUids) {
        await this.db
          .update(matchEvents)
          .set({ playerUid: uid, playerName: fullName })
          .where(eq(matchEvents.playerUid, oldUid))
        await this.db
          .update(matchEvents)
          .set({ assistPlayerUid: uid, assistPlayerName: fullName })
          .where(eq(matchEvents.assistPlayerUid, oldUid))
      }

      // Update fines
      for (const oldUid of oldUids) {
        await this.db
          .update(fines)
          .set({ playerUid: uid, playerName: fullName })
          .where(eq(fines.playerUid, oldUid))
      }
    }

    // 3. Always ensure team_members exist for ALL registration_players linked to this uid
    const myRegistrations = await this.db
      .select({
        registrationId: registrationPlayers.registrationId,
      })
      .from(registrationPlayers)
      .where(eq(registrationPlayers.playerUid, uid))

    for (const { registrationId } of myRegistrations) {
      const [reg] = await this.db
        .select({ teamId: registrations.teamId })
        .from(registrations)
        .where(eq(registrations.id, registrationId))
      if (!reg) continue

      const [existing] = await this.db
        .select({ id: teamMembers.id })
        .from(teamMembers)
        .where(and(eq(teamMembers.teamId, reg.teamId), eq(teamMembers.playerUid, uid)))
      if (existing) continue

      await this.db.insert(teamMembers).values({
        teamId: reg.teamId,
        playerUid: uid,
        playerName: fullName,
        role: 'player',
      })
    }
  }

  /**
   * List followers of a user.
   */
  async getFollowers(uid: string) {
    const rows = await this.db
      .select({
        uid: follows.followerUid,
        fullName: playerProfiles.fullName,
        username: playerProfiles.username,
        avatarUrl: playerProfiles.avatarUrl,
      })
      .from(follows)
      .leftJoin(playerProfiles, eq(playerProfiles.uid, follows.followerUid))
      .where(eq(follows.followedUid, uid))
      .orderBy(desc(follows.createdAt))

    return rows
  }

  /**
   * List users that a user follows.
   */
  async getFollowing(uid: string) {
    const rows = await this.db
      .select({
        uid: follows.followedUid,
        fullName: playerProfiles.fullName,
        username: playerProfiles.username,
        avatarUrl: playerProfiles.avatarUrl,
      })
      .from(follows)
      .leftJoin(playerProfiles, eq(playerProfiles.uid, follows.followedUid))
      .where(eq(follows.followerUid, uid))
      .orderBy(desc(follows.createdAt))

    return rows
  }

  /**
   * Follow a player.
   */
  async follow(myUid: string, targetUid: string) {
    if (myUid === targetUid) throw new ConflictException('No puedes seguirte a ti mismo')

    // Check if already following
    const [existing] = await this.db
      .select({ id: follows.id })
      .from(follows)
      .where(and(eq(follows.followerUid, myUid), eq(follows.followedUid, targetUid)))

    if (existing) return { followed: true }

    await this.db.insert(follows).values({ followerUid: myUid, followedUid: targetUid })

    // Increment counters
    await this.db
      .update(playerProfiles)
      .set({ followingCount: sql`${playerProfiles.followingCount} + 1` })
      .where(eq(playerProfiles.uid, myUid))

    await this.db
      .update(playerProfiles)
      .set({ followersCount: sql`${playerProfiles.followersCount} + 1` })
      .where(eq(playerProfiles.uid, targetUid))

    return { followed: true }
  }

  /**
   * Unfollow a player.
   */
  async unfollow(myUid: string, targetUid: string) {
    const [deleted] = await this.db
      .delete(follows)
      .where(
        and(
          eq(follows.followerUid, myUid),
          eq(follows.followedUid, targetUid),
        ),
      )
      .returning()

    if (deleted) {
      await this.db
        .update(playerProfiles)
        .set({ followingCount: sql`GREATEST(${playerProfiles.followingCount} - 1, 0)` })
        .where(eq(playerProfiles.uid, myUid))

      await this.db
        .update(playerProfiles)
        .set({ followersCount: sql`GREATEST(${playerProfiles.followersCount} - 1, 0)` })
        .where(eq(playerProfiles.uid, targetUid))
    }

    return { followed: false }
  }

  /**
   * Delete the authenticated user's account.
   */
  async deleteAccount(uid: string) {
    // Delete profile (cascades follows via app logic)
    await this.db.delete(follows).where(
      or(eq(follows.followerUid, uid), eq(follows.followedUid, uid)),
    )
    await this.db.delete(playerProfiles).where(eq(playerProfiles.uid, uid))

    // Delete Firebase Auth user
    try {
      await admin.auth().deleteUser(uid)
    } catch {
      // User might already be deleted from Firebase
    }

    return { deleted: true }
  }
}
