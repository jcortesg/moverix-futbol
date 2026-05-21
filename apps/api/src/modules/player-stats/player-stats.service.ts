import { Injectable } from '@nestjs/common'
import { and, eq, sql } from 'drizzle-orm'
import { DatabaseService } from '../../db/database.service'
import { matchdays, matches, matchEvents, playerStats } from '../../db/schema'

@Injectable()
export class PlayerStatsService {
  constructor(private readonly database: DatabaseService) {}

  private get db() {
    return this.database.db
  }

  /**
   * Recompute stats for all players involved in a specific match.
   * Called after finalize or when events change.
   */
  async recomputeMatch(matchId: string) {
    // Get match + edition context
    const [matchRow] = await this.db
      .select({
        id: matches.id,
        editionId: matchdays.editionId,
        homeTeamId: matches.homeTeamId,
        awayTeamId: matches.awayTeamId,
      })
      .from(matches)
      .innerJoin(matchdays, eq(matchdays.id, matches.matchdayId))
      .where(eq(matches.id, matchId))

    if (!matchRow || !matchRow.editionId) return

    const editionId = matchRow.editionId
    const teamIds = [matchRow.homeTeamId, matchRow.awayTeamId].filter(Boolean) as string[]

    // Recompute all players from these teams in this edition
    for (const teamId of teamIds) {
      await this.recomputeTeamInEdition(editionId, teamId)
    }
  }

  /**
   * Full recompute of all player stats for an edition.
   */
  async recomputeAll(editionId: string) {
    // Delete existing stats for this edition
    await this.db.delete(playerStats).where(eq(playerStats.editionId, editionId))

    // Get all finished matches in this edition
    const finishedMatches = await this.db
      .select({
        id: matches.id,
        homeTeamId: matches.homeTeamId,
        awayTeamId: matches.awayTeamId,
      })
      .from(matches)
      .innerJoin(matchdays, eq(matchdays.id, matches.matchdayId))
      .where(and(
        eq(matchdays.editionId, editionId),
        eq(matches.status, 'finished'),
      ))

    // Collect unique teamIds
    const teamIds = new Set<string>()
    for (const m of finishedMatches) {
      if (m.homeTeamId) teamIds.add(m.homeTeamId)
      if (m.awayTeamId) teamIds.add(m.awayTeamId)
    }

    for (const teamId of teamIds) {
      await this.recomputeTeamInEdition(editionId, teamId)
    }

    return { teamsProcessed: teamIds.size, matchesProcessed: finishedMatches.length }
  }

  /**
   * Recompute stats for all players of a team within an edition.
   * Strategy: aggregate from match_events for the team in finished matches of this edition.
   */
  private async recomputeTeamInEdition(editionId: string, teamId: string) {
    // Get all events for this team in this edition (finished matches only)
    const events = await this.db
      .select({
        matchId: matchEvents.matchId,
        eventType: matchEvents.eventType,
        playerUid: matchEvents.playerUid,
        playerName: matchEvents.playerName,
        assistPlayerUid: matchEvents.assistPlayerUid,
      })
      .from(matchEvents)
      .innerJoin(matches, eq(matches.id, matchEvents.matchId))
      .innerJoin(matchdays, eq(matchdays.id, matches.matchdayId))
      .where(and(
        eq(matchdays.editionId, editionId),
        eq(matchEvents.teamId, teamId),
        eq(matches.status, 'finished'),
      ))

    // Aggregate stats per player
    const statsMap = new Map<string, {
      playerName: string
      goals: number
      assists: number
      yellowCards: number
      redCards: number
      matchIds: Set<string>
    }>()

    for (const ev of events) {
      if (!ev.playerUid) continue

      if (!statsMap.has(ev.playerUid)) {
        statsMap.set(ev.playerUid, {
          playerName: ev.playerName ?? 'Desconocido',
          goals: 0,
          assists: 0,
          yellowCards: 0,
          redCards: 0,
          matchIds: new Set(),
        })
      }

      const s = statsMap.get(ev.playerUid)!
      s.matchIds.add(ev.matchId)

      switch (ev.eventType) {
        case 'goal':
        case 'penalty_scored':
          s.goals++
          break
        case 'yellow_card':
          s.yellowCards++
          break
        case 'red_card':
          s.redCards++
          break
        case 'mvp':
          // mvp doesn't affect stats counters
          break
      }

      // Track assists (from assistPlayerUid on goal events)
      if ((ev.eventType === 'goal' || ev.eventType === 'penalty_scored') && ev.assistPlayerUid) {
        if (!statsMap.has(ev.assistPlayerUid)) {
          statsMap.set(ev.assistPlayerUid, {
            playerName: 'Desconocido',
            goals: 0,
            assists: 0,
            yellowCards: 0,
            redCards: 0,
            matchIds: new Set(),
          })
        }
        statsMap.get(ev.assistPlayerUid)!.assists++
        statsMap.get(ev.assistPlayerUid)!.matchIds.add(ev.matchId)
      }
    }

    // Delete existing stats for this team+edition and upsert
    await this.db.delete(playerStats).where(and(
      eq(playerStats.editionId, editionId),
      eq(playerStats.teamId, teamId),
    ))

    for (const [playerUid, s] of statsMap) {
      await this.db.insert(playerStats).values({
        editionId,
        teamId,
        playerUid,
        playerName: s.playerName,
        matchesPlayed: s.matchIds.size,
        goals: s.goals,
        assists: s.assists,
        yellowCards: s.yellowCards,
        redCards: s.redCards,
        minutesPlayed: 0, // We don't track per-player minutes yet
      })
    }

    // Ensure all players who played matches but had no events still get a matchesPlayed entry
    // They would be players on teams that played but didn't score/get carded
    // For now, we only track players who have at least one event.
    // matchesPlayed for all team members = matchCount (simplified)
  }

  /**
   * Get stats for all players in an edition, ordered by goals desc.
   */
  async getByEdition(editionId: string) {
    return this.db
      .select()
      .from(playerStats)
      .where(eq(playerStats.editionId, editionId))
      .orderBy(sql`${playerStats.goals} DESC, ${playerStats.assists} DESC`)
  }

  /**
   * Get stats for a specific team in an edition.
   */
  async getByTeam(editionId: string, teamId: string) {
    return this.db
      .select()
      .from(playerStats)
      .where(and(
        eq(playerStats.editionId, editionId),
        eq(playerStats.teamId, teamId),
      ))
      .orderBy(sql`${playerStats.goals} DESC, ${playerStats.assists} DESC`)
  }

  /**
   * Get top scorers for an edition.
   */
  async getTopScorers(editionId: string, limit = 10) {
    return this.db
      .select()
      .from(playerStats)
      .where(and(
        eq(playerStats.editionId, editionId),
        sql`${playerStats.goals} > 0`,
      ))
      .orderBy(sql`${playerStats.goals} DESC, ${playerStats.assists} DESC`)
      .limit(limit)
  }
}
