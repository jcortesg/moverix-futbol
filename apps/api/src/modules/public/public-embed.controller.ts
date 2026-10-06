import { Controller, Get, Header, NotFoundException, Param, Query } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { eq, inArray } from 'drizzle-orm'
import { Public } from '../../common/decorators/public.decorator'
import { DatabaseService } from '../../db/database.service'
import { editions, leagues, organizations, teams } from '../../db/schema'
import { StandingsService } from '../standings/standings.service'
import { PlayerStatsService } from '../player-stats/player-stats.service'

/**
 * Datos para el widget embebible que los organizadores ponen en su propia web.
 *
 * Se accede con la `embedKey` de la edición, no con su id ni su slug: así la
 * clave se puede REVOCAR (regenerándola) sin romper la página pública del
 * torneo. Solo expone información que ya es pública: tabla y goleadores.
 */
@ApiTags('public')
@Controller('public/embed')
export class PublicEmbedController {
  constructor(
    private readonly database: DatabaseService,
    private readonly standings: StandingsService,
    private readonly playerStats: PlayerStatsService,
  ) {}

  @Public()
  @Get(':key')
  @ApiOperation({ summary: 'Estadísticas del torneo para incrustar en una web externa' })
  // El widget lo carga cualquier dominio del organizador: CORS abierto solo
  // aquí (lectura pública, sin cookies ni credenciales).
  @Header('Access-Control-Allow-Origin', '*')
  // Cache corto: la tabla no cambia cada segundo y así una web con tráfico no
  // golpea la API en cada visita.
  @Header('Cache-Control', 'public, max-age=120, s-maxage=120')
  async getEmbed(@Param('key') key: string, @Query('scorers') scorers?: string) {
    const clean = (key ?? '').trim()
    if (!clean) throw new NotFoundException('Clave no válida')

    const [edition] = await this.database.db
      .select({
        id: editions.id,
        name: editions.name,
        season: editions.season,
        status: editions.status,
        logoUrl: editions.logoUrl,
        leagueName: leagues.name,
        organizationName: organizations.name,
      })
      .from(editions)
      .innerJoin(leagues, eq(leagues.id, editions.leagueId))
      .innerJoin(organizations, eq(organizations.id, leagues.organizationId))
      .where(eq(editions.embedKey, clean))

    if (!edition) throw new NotFoundException('Clave no válida o revocada')

    const limit = Math.min(Math.max(parseInt(scorers ?? '10', 10) || 10, 1), 50)
    const [groups, topScorers, conceded] = await Promise.all([
      this.standings.getForEdition(edition.id),
      this.playerStats.getTopScorers(edition.id, limit),
      this.standings.getLeastConceded(edition.id),
    ])

    // getTopScorers devuelve filas de player_stats, que traen teamId pero no el
    // nombre del equipo. El widget lo necesita, así que se resuelve aquí.
    const teamIds = [...new Set(topScorers.map((s) => s.teamId).filter(Boolean))] as string[]
    const teamNames = teamIds.length
      ? new Map(
          (
            await this.database.db
              .select({ id: teams.id, name: teams.name })
              .from(teams)
              .where(inArray(teams.id, teamIds))
          ).map((t) => [t.id, t.name]),
        )
      : new Map<string, string>()

    // Reclasificación: todos los equipos en una sola tabla, sin importar el
    // grupo, con el mismo criterio de desempate (pts > dif > goles a favor).
    const allRows = groups.flatMap((g) => g.rows)
    const reclassification = [...allRows]
      .sort(
        (a, b) =>
          b.points - a.points ||
          b.goalDiff - a.goalDiff ||
          b.goalsFor - a.goalsFor ||
          a.teamName.localeCompare(b.teamName),
      )
      .map((r, i) => ({ ...r, position: i + 1 }))

    // Valla menos vencida de todo el torneo (grupos + eliminatoria), no de la
    // tabla de grupos: esa excluye la eliminatoria a propósito.
    const leastConceded = conceded.slice(0, 10).map((r) => ({
      position: r.position,
      teamName: r.teamName,
      teamLogoUrl: r.teamLogoUrl,
      played: r.played,
      goalsAgainst: r.goalsAgainst,
    }))

    return {
      edition: {
        name: edition.name,
        season: edition.season,
        status: edition.status,
        logoUrl: edition.logoUrl,
        league: edition.leagueName,
        organization: edition.organizationName,
      },
      standings: groups,
      reclassification,
      leastConceded,
      topScorers: topScorers.map((s) => ({
        playerUid: s.playerUid,
        playerName: s.playerName,
        teamName: teamNames.get(s.teamId ?? '') ?? null,
        goals: s.goals,
        assists: s.assists,
        matchesPlayed: s.matchesPlayed,
      })),
      updatedAt: new Date().toISOString(),
    }
  }
}
