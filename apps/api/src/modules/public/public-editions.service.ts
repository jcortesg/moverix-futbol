import { Injectable, NotFoundException } from '@nestjs/common'
import { and, eq, inArray, desc, sql } from 'drizzle-orm'
import { DatabaseService } from '../../db/database.service'
import { editions, leagues, organizations, registrations, teams, venues } from '../../db/schema'

@Injectable()
export class PublicEditionsService {
  constructor(private readonly database: DatabaseService) {}

  private get db() {
    return this.database.db
  }

  /** List all published editions */
  async findAll() {
    const rows = await this.db
      .select({
        id: editions.id,
        name: editions.name,
        slug: editions.slug,
        season: editions.season,
        status: editions.status,
        logoUrl: editions.logoUrl,
        bannerUrl: editions.bannerUrl,
        startDate: editions.startDate,
        maxTeams: editions.maxTeams,
        registrationFee: editions.registrationFee,
        prizePool: editions.prizePool,
        currency: editions.currency,
        league: {
          name: leagues.name,
          sportFormat: leagues.sportFormat,
          gender: leagues.gender,
        },
        organization: {
          name: organizations.name,
          city: organizations.city,
          logoUrl: organizations.logoUrl,
        },
        teamsCount: sql<number>`(SELECT count(*) FROM registrations WHERE edition_id = ${editions.id} AND status IN ('approved','pending'))::int`,
      })
      .from(editions)
      .innerJoin(leagues, eq(leagues.id, editions.leagueId))
      .innerJoin(organizations, eq(organizations.id, leagues.organizationId))
      .where(eq(editions.isPublished, true))
      .orderBy(desc(editions.createdAt))

    return rows
  }

  async findBySlug(slug: string, uid?: string) {
    const [edition] = await this.db
      .select({
        id: editions.id,
        name: editions.name,
        slug: editions.slug,
        season: editions.season,
        status: editions.status,
        isPublished: editions.isPublished,
        maxTeams: editions.maxTeams,
        registrationFee: editions.registrationFee,
        prizePool: editions.prizePool,
        currency: editions.currency,
        logoUrl: editions.logoUrl,
        bannerUrl: editions.bannerUrl,
        rulesUrl: editions.rulesUrl,
        publicDescription: editions.publicDescription,
        formatConfig: editions.formatConfig,
        startDate: editions.startDate,
        endDate: editions.endDate,
        league: {
          id: leagues.id,
          name: leagues.name,
          sportFormat: leagues.sportFormat,
          gender: leagues.gender,
          logoUrl: leagues.logoUrl,
        },
        organization: {
          id: organizations.id,
          name: organizations.name,
          city: organizations.city,
          logoUrl: organizations.logoUrl,
          ownerUid: organizations.ownerUid,
        },
      })
      .from(editions)
      .innerJoin(leagues, eq(leagues.id, editions.leagueId))
      .innerJoin(organizations, eq(organizations.id, leagues.organizationId))
      .where(eq(editions.slug, slug))

    if (!edition) throw new NotFoundException('Torneo no encontrado')

    // If not published, only the owner can see it
    if (!edition.isPublished) {
      if (!uid || uid !== edition.organization.ownerUid) {
        throw new NotFoundException('Torneo no encontrado')
      }
    }

    const registeredTeams = await this.db
      .select({
        id: teams.id,
        name: teams.name,
        shortName: teams.shortName,
        logoUrl: teams.logoUrl,
        primaryColor: teams.primaryColor,
        secondaryColor: teams.secondaryColor,
        registrationStatus: registrations.status,
      })
      .from(registrations)
      .innerJoin(teams, eq(teams.id, registrations.teamId))
      .where(
        and(
          eq(registrations.editionId, edition.id),
          inArray(registrations.status, ['approved', 'pending']),
        ),
      )

    // Fetch venues for the organization
    const orgVenues = await this.db
      .select({
        id: venues.id,
        name: venues.name,
        address: venues.address,
        city: venues.city,
        photoUrl: venues.photoUrl,
      })
      .from(venues)
      .where(eq(venues.organizationId, edition.organization.id))

    // Don't leak ownerUid to the response
    const { ownerUid, ...org } = edition.organization

    return {
      ...edition,
      organization: org,
      teams: registeredTeams,
      teamsCount: registeredTeams.length,
      venues: orgVenues,
    }
  }
}
