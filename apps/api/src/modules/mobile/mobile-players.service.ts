import { Injectable, ConflictException } from '@nestjs/common'
import { eq, sql, and, or, desc, asc, ne, like, ilike, inArray, isNull } from 'drizzle-orm'
import { teamDelegateCondition } from '../../common/utils/team-delegates'
import * as admin from 'firebase-admin'
import { DatabaseService } from '../../db/database.service'
import { StorageService } from '../../common/services/storage.service'
import { resolveRequiredFields, isFieldFilled, fieldLabel } from './roster-fields'
import { MobileNotificationsService } from './mobile-notifications.service'
import {
  playerProfiles,
  playerStats,
  registrationPlayers,
  registrations,
  teams,
  editions,
  leagues,
  matches,
  matchdays,
  matchEvents,
  venues,
  groups,
  follows,
  fines,
  teamMembers,
  matchDelegates,
} from '../../db/schema'

@Injectable()
export class MobilePlayersService {
  constructor(
    private readonly database: DatabaseService,
    private readonly storage: StorageService,
    private readonly notifications: MobileNotificationsService,
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
            // Dato sensible: la cédula solo la ve el dueño del perfil. La app la
            // lee de me/profile; antes salía en el perfil público de cualquiera.
            docNumber: viewerUid && viewerUid === uid ? profile.docNumber : null,
            instagram: profile.instagram,
            tiktok: profile.tiktok,
            facebook: profile.facebook,
            twitter: profile.twitter,
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
   * Crea el perfil sin romper por concurrencia. Al abrir la app por primera vez
   * llegan varias peticiones a la vez y todas intentaban crearlo: una ganaba y
   * el resto respondía 500 por el índice único de uid. Ahora, si ya existe, se
   * usa ese. Además el username (8 caracteres del uid en minúscula) puede chocar
   * con OTRA cuenta; en ese caso se prueba uno más largo.
   */
  private async createProfileSafely(uid: string, fullName: string) {
    const lower = uid.toLowerCase()
    const candidates = [
      `player_${lower.slice(0, 8)}`,
      `player_${lower.slice(0, 16)}`,
      `player_${lower}`.slice(0, 40),
    ]
    for (const username of candidates) {
      const [created] = await this.db
        .insert(playerProfiles)
        .values({ uid, username, fullName })
        .onConflictDoNothing()
        .returning()
      if (created) return created

      // Conflicto: o lo creó otra petición (mismo uid) o el username es de otra cuenta.
      const [existing] = await this.db.select().from(playerProfiles).where(eq(playerProfiles.uid, uid))
      if (existing) return existing
    }
    throw new ConflictException('No se pudo crear el perfil, intenta de nuevo')
  }

  /**
   * Get or create the authenticated user's profile.
   */
  async myProfile(uid: string, email?: string, name?: string) {
    const [existing] = await this.db
      .select()
      .from(playerProfiles)
      .where(eq(playerProfiles.uid, uid))

    let profile = existing
    if (!profile) {
      // Auto-create minimal profile. El token del primer acceso a veces no trae el
      // displayName (la app lo setea con updateProfile justo tras el registro), así
      // que se consulta a Firebase antes de caer en el prefijo del email.
      const displayName = name ?? (await this.firebaseDisplayName(uid)) ?? email?.split('@')[0] ?? 'Jugador'
      profile = await this.createProfileSafely(uid, displayName)
    }

    // Reclama equipos donde este email quedó como delegado pendiente. Idempotente
    // y best-effort: se corre en cada acceso (cubre el caso de que el admin cargue
    // el email después de que el usuario ya se registró).
    if (email) {
      await this.claimPendingDelegateTeams(uid, email, profile.fullName)
      await this.claimPendingPlayerRows(uid, email, profile.fullName)
      await this.claimPendingMatchDelegates(uid, email)
    }

    return profile
  }

  /**
   * Vincula al usuario con los cupos de plantilla que el director cargó bajo un
   * placeholder usando su email (registration_players.email). Re-apunta esas filas
   * a su uid real y lo agrega a la nómina del equipo. Best-effort e idempotente.
   */
  /**
   * Partidos donde al organizador lo invitó por CORREO antes de que tuviera
   * cuenta: la fila queda con pending_email y aquí se le asigna su uid real.
   * Best-effort e idempotente; corre en cada me/profile.
   */
  private async claimPendingMatchDelegates(uid: string, email: string) {
    try {
      const pending = await this.db
        .select({ id: matchDelegates.id, matchId: matchDelegates.matchId })
        .from(matchDelegates)
        .where(
          and(
            sql`lower(${matchDelegates.pendingEmail}) = ${email.toLowerCase()}`,
            isNull(matchDelegates.uid),
          ),
        )

      for (const row of pending) {
        try {
          await this.db
            .update(matchDelegates)
            .set({ uid, pendingEmail: null })
            .where(eq(matchDelegates.id, row.id))
        } catch (err) {
          // Si ya estaba asignado a este partido, el índice único lo rechaza:
          // se descarta la invitación duplicada y se sigue.
          console.error('[claimPendingMatchDelegates] (best-effort):', err)
        }
      }

      if (pending.length) {
        await this.notifications.createFor([uid], {
          type: 'match',
          title: 'Tienes partidos para dirigir',
          body: `Te asignaron como delegado en ${pending.length} partido${pending.length === 1 ? '' : 's'}.`,
          data: { kind: 'referee' },
        })
      }
    } catch (err) {
      console.error('[claimPendingMatchDelegates] error:', err)
    }
  }

  private async claimPendingPlayerRows(uid: string, email: string, playerName: string) {
    try {
      const rows = await this.db
        .select({ id: registrationPlayers.id, teamId: registrations.teamId })
        .from(registrationPlayers)
        .innerJoin(registrations, eq(registrations.id, registrationPlayers.registrationId))
        .where(
          and(
            sql`lower(${registrationPlayers.email}) = lower(${email})`,
            ne(registrationPlayers.playerUid, uid),
          ),
        )

      for (const row of rows) {
        // Re-apuntar la fila al uid real. Aislado: el índice único (registration_id,
        // player_uid) puede chocar si el usuario ya está en esa inscripción; si falla,
        // se omite esa fila sin afectar las demás.
        try {
          await this.db
            .update(registrationPlayers)
            .set({ playerUid: uid })
            .where(eq(registrationPlayers.id, row.id))
        } catch (err) {
          console.error('[claimPendingPlayerRows] re-point row (best-effort):', err)
          continue
        }

        // Asegurar que figure en la nómina del equipo.
        try {
          await this.db
            .insert(teamMembers)
            .values({ teamId: row.teamId, playerUid: uid, playerName, role: 'player', isPlayer: true })
            .onConflictDoNothing({ target: [teamMembers.teamId, teamMembers.playerUid] })
        } catch (err) {
          console.error('[claimPendingPlayerRows] add member (best-effort):', err)
        }
      }
    } catch (err) {
      console.error('[claimPendingPlayerRows] error (best-effort):', err)
    }
  }

  /** displayName real del usuario en Firebase Auth (best-effort, null si falla). */
  private async firebaseDisplayName(uid: string): Promise<string | undefined> {
    try {
      const user = await admin.auth().getUser(uid)
      const dn = user.displayName?.trim()
      return dn || undefined
    } catch {
      return undefined
    }
  }

  /**
   * Promueve al usuario a director de los equipos cuyo delegado quedó pendiente por
   * email (teams.pending_delegate_email). Best-effort: cualquier fallo se traga para
   * no romper el login/perfil.
   */
  private async claimPendingDelegateTeams(uid: string, email: string, playerName: string) {
    try {
      const pending = await this.db
        .select({ id: teams.id, directorUid: teams.directorUid })
        .from(teams)
        .where(sql`lower(${teams.pendingDelegateEmail}) = lower(${email})`)

      for (const team of pending) {
        const oldDirectorUid = team.directorUid

        // Asignación crítica en transacción: director + miembro director + limpieza placeholder.
        await this.db.transaction(async (tx) => {
          await tx
            .update(teams)
            .set({ directorUid: uid, pendingDelegateEmail: null, updatedAt: new Date() })
            .where(eq(teams.id, team.id))

          await tx
            .insert(teamMembers)
            .values({ teamId: team.id, playerUid: uid, playerName, role: 'director', isPlayer: false })
            .onConflictDoUpdate({
              target: [teamMembers.teamId, teamMembers.playerUid],
              set: { role: 'director' },
            })

          if (oldDirectorUid && oldDirectorUid !== uid) {
            await tx
              .delete(teamMembers)
              .where(and(eq(teamMembers.teamId, team.id), eq(teamMembers.playerUid, oldDirectorUid)))
          }
        })

        // Best-effort (fuera de la tx crítica): re-apunta el cupo de contacto del roster
        // al uid real. Aislado porque el índice único (registration_id, player_uid) podría
        // chocar si el usuario ya figura como jugador; si falla no revierte la asignación.
        if (oldDirectorUid && oldDirectorUid !== uid) {
          try {
            const regs = await this.db
              .select({ id: registrations.id })
              .from(registrations)
              .where(eq(registrations.teamId, team.id))
            const regIds = regs.map((r) => r.id)
            if (regIds.length > 0) {
              await this.db
                .update(registrationPlayers)
                .set({ playerUid: uid })
                .where(
                  and(
                    inArray(registrationPlayers.registrationId, regIds),
                    eq(registrationPlayers.playerUid, oldDirectorUid),
                    sql`lower(${registrationPlayers.email}) = lower(${email})`,
                  ),
                )
            }
          } catch (err) {
            console.error('[claimPendingDelegateTeams] re-point roster (best-effort):', err)
          }
        }
      }
    } catch (err) {
      console.error('[claimPendingDelegateTeams] error (best-effort):', err)
    }
  }

  /**
   * Pendientes en inscripciones en BORRADOR para la alerta del inicio:
   *  - kind 'director': eres DT de un equipo con inscripción en borrador → completar/enviar.
   *  - kind 'player': eres jugador y te faltan campos requeridos → completar tus datos.
   * Si eres DT del equipo, prima el caso 'director' para esa inscripción.
   */
  async myPendingData(uid: string) {
    type Pending = {
      kind: 'director' | 'player'
      registrationId: string
      edition: { id: string; name: string; logoUrl: string | null; bannerUrl: string | null }
      team: { id: string; name: string; logoUrl: string | null }
      missingFields: { key: string; label: string }[]
    }

    // 1) Inscripciones en borrador de equipos que dirijo
    const directorRows = await this.db
      .select({
        registrationId: registrations.id,
        edition: { id: editions.id, name: editions.name, logoUrl: editions.logoUrl, bannerUrl: editions.bannerUrl },
        team: { id: teams.id, name: teams.name, logoUrl: teams.logoUrl },
      })
      .from(registrations)
      .innerJoin(editions, eq(editions.id, registrations.editionId))
      .innerJoin(teams, eq(teams.id, registrations.teamId))
      .where(and(teamDelegateCondition(uid), eq(registrations.status, 'draft')))

    const result: Pending[] = directorRows.map((r) => ({
      kind: 'director',
      registrationId: r.registrationId,
      edition: r.edition,
      team: r.team,
      missingFields: [],
    }))

    // 2) Inscripciones en borrador donde soy jugador con campos faltantes.
    //    Se incluye AUNQUE sea DT de esa inscripción: completar mis datos como
    //    jugador es una acción distinta a completar/enviar la inscripción.
    const playerRows = await this.db
      .select({
        registrationId: registrations.id,
        player: registrationPlayers,
        edition: {
          id: editions.id,
          name: editions.name,
          logoUrl: editions.logoUrl,
          bannerUrl: editions.bannerUrl,
          requiredPlayerFields: editions.requiredPlayerFields,
        },
        team: { id: teams.id, name: teams.name, logoUrl: teams.logoUrl },
      })
      .from(registrationPlayers)
      .innerJoin(registrations, eq(registrations.id, registrationPlayers.registrationId))
      .innerJoin(editions, eq(editions.id, registrations.editionId))
      .innerJoin(teams, eq(teams.id, registrations.teamId))
      .where(and(eq(registrationPlayers.playerUid, uid), eq(registrations.status, 'draft')))

    for (const r of playerRows) {
      const required = resolveRequiredFields(r.edition.requiredPlayerFields)
      const missing = required.filter((key) => !isFieldFilled(r.player as Record<string, unknown>, key))
      if (!missing.length) continue
      result.push({
        kind: 'player',
        registrationId: r.registrationId,
        edition: { id: r.edition.id, name: r.edition.name, logoUrl: r.edition.logoUrl, bannerUrl: r.edition.bannerUrl },
        team: { id: r.team.id, name: r.team.name, logoUrl: r.team.logoUrl },
        missingFields: missing.map((key) => ({ key, label: fieldLabel(key) })),
      })
    }

    return result
  }

  /**
   * Partido relevante (en vivo o próximo) por cada equipo del usuario, para la
   * tarjeta del inicio. Prioriza 'live'; si no hay, el próximo 'scheduled' futuro.
   * Un partido por equipo.
   */
  async myUpcomingMatches(uid: string) {
    const teamRows = await this.db
      .select({ teamId: teamMembers.teamId })
      .from(teamMembers)
      .where(eq(teamMembers.playerUid, uid))
    const teamIds = [...new Set(teamRows.map((r) => r.teamId))]
    if (teamIds.length === 0) return []

    const rows = await this.db
      .select({
        matchId: matches.id,
        status: matches.status,
        homeScore: matches.homeScore,
        awayScore: matches.awayScore,
        scheduledAt: matches.scheduledAt,
        homeTeamId: matches.homeTeamId,
        awayTeamId: matches.awayTeamId,
        groupName: groups.name,
        editionName: editions.name,
        editionId: matchdays.editionId,
        homeTeam: {
          name: sql<string>`ht.name`,
          shortName: sql<string | null>`ht.short_name`,
          logoUrl: sql<string | null>`ht.logo_url`,
          primaryColor: sql<string | null>`ht.primary_color`,
        },
        awayTeam: {
          name: sql<string>`at.name`,
          shortName: sql<string | null>`at.short_name`,
          logoUrl: sql<string | null>`at.logo_url`,
        },
        venue: { name: venues.name },
      })
      .from(matches)
      .innerJoin(matchdays, eq(matchdays.id, matches.matchdayId))
      .innerJoin(editions, eq(editions.id, matchdays.editionId))
      .leftJoin(groups, eq(groups.id, matches.groupId))
      .leftJoin(sql`teams ht`, sql`ht.id = ${matches.homeTeamId}`)
      .leftJoin(sql`teams at`, sql`at.id = ${matches.awayTeamId}`)
      .leftJoin(venues, eq(venues.id, matches.venueId))
      .where(
        and(
          or(inArray(matches.homeTeamId, teamIds), inArray(matches.awayTeamId, teamIds)),
          or(
            eq(matches.status, 'live'),
            and(eq(matches.status, 'scheduled'), sql`${matches.scheduledAt} >= now() - interval '3 hours'`),
          ),
        ),
      )
      // live primero; luego el más próximo por fecha
      .orderBy(sql`case when ${matches.status} = 'live' then 0 else 1 end`, asc(matches.scheduledAt))

    // Un partido por equipo del usuario (el primero según el orden anterior).
    const teamSet = new Set(teamIds)
    const seen = new Set<string>()
    const out: typeof rows = []
    for (const m of rows) {
      const myTeamId = teamSet.has(m.homeTeamId ?? '') ? m.homeTeamId : m.awayTeamId
      if (!myTeamId || seen.has(myTeamId)) continue
      seen.add(myTeamId)
      out.push({ ...m, teamId: myTeamId } as any)
    }
    return out
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
      phone?: string
      instagram?: string
      tiktok?: string
      facebook?: string
      twitter?: string
    },
  ) {
    // Ensure profile exists
    await this.myProfile(uid)

    // Normaliza handles de redes: quita @, espacios y URL; guarda solo el usuario.
    const handle = (v?: string | null) => {
      if (v === undefined) return undefined
      // La app manda null al vaciar una red social; antes esto rompía con .trim() (500).
      if (v === null || typeof v !== 'string') return null
      const s = v.trim().replace(/^@+/, '').replace(/\s+/g, '')
      if (!s) return null
      // si pegan una URL, toma el último segmento no vacío
      const m = s.match(/[^/]+$/)
      return (m ? m[0] : s).slice(0, 40)
    }
    if ('instagram' in dto) dto.instagram = handle(dto.instagram) as any
    if ('tiktok' in dto) dto.tiktok = handle(dto.tiktok) as any
    if ('facebook' in dto) dto.facebook = handle(dto.facebook) as any
    if ('twitter' in dto) dto.twitter = handle(dto.twitter) as any

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

      // Nombre real nuevo: reemplaza el usuario del correo (sin espacios) con que
      // quedó en clubes y nóminas. No pisa nombres que ya tengan nombre y apellido.
      const newName = (rest.fullName ?? '').trim()
      if (newName.includes(' ')) {
        await this.db
          .update(teamMembers)
          .set({ playerName: newName.slice(0, 160) })
          .where(and(eq(teamMembers.playerUid, uid), sql`position(' ' in ${teamMembers.playerName}) = 0`))
        await this.db
          .update(registrationPlayers)
          .set({ playerName: newName.slice(0, 160) })
          .where(and(eq(registrationPlayers.playerUid, uid), sql`position(' ' in ${registrationPlayers.playerName}) = 0`))
      }

      // Claim records that match this docNumber
      if (docNumber) {
        await this.claimByDocNumber(uid, docNumber, updated.fullName)
      }

      return updated
    } catch (err: any) {
      // drizzle-orm envuelve el error de Postgres en DrizzleQueryError; el code/constraint
      // reales viven en err.cause. Revisamos ambos para mapear las violaciones únicas a 409.
      const pg = err?.cause ?? err
      if (pg?.code === '23505' && pg?.constraint?.includes('username')) {
        throw new ConflictException('Este username ya esta en uso')
      }
      if (pg?.code === '23505' && pg?.constraint?.includes('doc_number')) {
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

    // Notificación "nuevo seguidor" (best-effort)
    const [me] = await this.db
      .select({ fullName: playerProfiles.fullName, username: playerProfiles.username })
      .from(playerProfiles)
      .where(eq(playerProfiles.uid, myUid))
    await this.notifications.createFor([targetUid], {
      type: 'social',
      title: 'Nuevo seguidor',
      body: `${me?.fullName ?? me?.username ?? 'Alguien'} empezó a seguirte`,
      data: { kind: 'profile', uid: myUid },
    })

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
   * Deactivate the authenticated user's account (soft delete).
   * Sets deactivatedAt timestamp and disables the Firebase Auth user.
   */
  async deactivateAccount(uid: string) {
    await this.db
      .update(playerProfiles)
      .set({ deactivatedAt: new Date() })
      .where(eq(playerProfiles.uid, uid))

    // Disable Firebase Auth user (don't delete)
    try {
      await admin.auth().updateUser(uid, { disabled: true })
    } catch {
      // best-effort
    }

    return { deactivated: true }
  }

  /**
   * Permanently and completely delete the authenticated user's account.
   * Deletes the Firebase Auth user (so the account no longer exists and the user
   * can never sign in again) and removes the user's data: profile, social graph,
   * team memberships and avatar file. This is irreversible.
   */
  async deleteAccount(uid: string) {
    // Delete the Firebase Auth user first — this is what blocks any future sign-in.
    // Surface real failures (only ignore "already gone") so we never report a
    // successful deletion while the account still exists.
    try {
      await admin.auth().deleteUser(uid)
    } catch (e: any) {
      if (e?.code !== 'auth/user-not-found') throw e
    }

    // Remove avatar file from storage (best-effort)
    const [profile] = await this.db
      .select({ avatarUrl: playerProfiles.avatarUrl })
      .from(playerProfiles)
      .where(eq(playerProfiles.uid, uid))

    if (profile?.avatarUrl) {
      try {
        await this.storage.deleteFile(profile.avatarUrl)
      } catch {
        // best-effort
      }
    }

    // Keep follower/following counts consistent on other users before removing edges
    const followed = await this.db
      .select({ uid: follows.followedUid })
      .from(follows)
      .where(eq(follows.followerUid, uid))
    const followers = await this.db
      .select({ uid: follows.followerUid })
      .from(follows)
      .where(eq(follows.followedUid, uid))

    const followedUids = followed.map((r) => r.uid)
    const followerUids = followers.map((r) => r.uid)

    if (followedUids.length) {
      await this.db
        .update(playerProfiles)
        .set({ followersCount: sql`GREATEST(${playerProfiles.followersCount} - 1, 0)` })
        .where(inArray(playerProfiles.uid, followedUids))
    }
    if (followerUids.length) {
      await this.db
        .update(playerProfiles)
        .set({ followingCount: sql`GREATEST(${playerProfiles.followingCount} - 1, 0)` })
        .where(inArray(playerProfiles.uid, followerUids))
    }

    // Remove the user's data
    await this.db
      .delete(follows)
      .where(or(eq(follows.followerUid, uid), eq(follows.followedUid, uid)))
    await this.db.delete(teamMembers).where(eq(teamMembers.playerUid, uid))
    await this.db.delete(playerProfiles).where(eq(playerProfiles.uid, uid))

    return { deleted: true }
  }
}
