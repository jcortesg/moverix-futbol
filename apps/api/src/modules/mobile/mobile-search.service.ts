import { Injectable } from '@nestjs/common'
import { and, eq, ne, ilike, or, sql } from 'drizzle-orm'
import { DatabaseService } from '../../db/database.service'
import { playerProfiles, teams, editions, leagues } from '../../db/schema'

@Injectable()
export class MobileSearchService {
  constructor(private readonly database: DatabaseService) {}

  private get db() {
    return this.database.db
  }

  async search(query: string, isIos = false) {
    const q = query.trim()
    if (q.length < 2) return { players: [], teams: [], editions: [] }

    const pattern = `%${q}%`

    const [playersRes, teamsRes, editionsRes] = await Promise.all([
      this.db
        .select({
          uid: playerProfiles.uid,
          fullName: playerProfiles.fullName,
          username: playerProfiles.username,
          avatarUrl: playerProfiles.avatarUrl,
          position: playerProfiles.position,
          city: playerProfiles.city,
        })
        .from(playerProfiles)
        .where(
          or(
            ilike(playerProfiles.fullName, pattern),
            ilike(playerProfiles.username, pattern),
          ),
        )
        .limit(15),

      this.db
        .select({
          id: teams.id,
          name: teams.name,
          shortName: teams.shortName,
          logoUrl: teams.logoUrl,
          primaryColor: teams.primaryColor,
          city: teams.city,
        })
        .from(teams)
        .where(
          or(
            ilike(teams.name, pattern),
            ilike(teams.shortName, pattern),
          ),
        )
        .limit(15),

      this.db
        .select({
          id: editions.id,
          name: editions.name,
          season: editions.season,
          status: editions.status,
          logoUrl: editions.logoUrl,
          leagueName: leagues.name,
          sportFormat: leagues.sportFormat,
        })
        .from(editions)
        .innerJoin(leagues, sql`${leagues.id} = ${editions.leagueId}`)
        .where(
          and(
            or(ilike(editions.name, pattern), ilike(leagues.name, pattern)),
            // Nunca mostrar torneos en borrador en la búsqueda.
            ne(editions.status, 'draft'),
            // Restricción de plataforma: ocultar torneos marcados en iOS.
            isIos ? eq(editions.hiddenOnIos, false) : undefined,
          ),
        )
        .limit(15),
    ])

    return {
      players: playersRes,
      teams: teamsRes,
      editions: editionsRes,
    }
  }
}
