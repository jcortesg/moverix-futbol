import { Injectable, Logger } from '@nestjs/common'
import { eq, sql, inArray, asc, isNull, and, or } from 'drizzle-orm'
import { FirestoreService } from '../../common/services/firestore.service'
import { DatabaseService } from '../../db/database.service'
import { matches, matchdays, editions, registrations, registrationPlayers, teams, playerProfiles, matchEvents } from '../../db/schema'

interface MatchContext {
  matchId: string
  editionId: string
  editionName: string | null
  homeTeam: { id: string; name: string; logoUrl: string | null }
  awayTeam: { id: string; name: string; logoUrl: string | null }
  homeScore: number | null
  awayScore: number | null
  scheduledAt: Date | null
}

/** Una linea del resumen: gol, tarjeta, etc. con quien y a que minuto. */
interface SummaryEvent {
  /** id del match_event: permite reaccionar a UN gol concreto. */
  id: string
  eventType: string
  teamId: string
  playerUid: string | null
  playerName: string | null
  minute: number | null
}

interface PostData {
  sourceId: string
  type: string
  text: string
  /**
   * Cuando OCURRIO de verdad (fecha del partido), distinto de createdAt, que
   * es cuando el delegado cargo la planilla. Los datos no se cargan en vivo:
   * un partido del sabado puede subirse el miercoles, y la tarjeta debe decir
   * la fecha del partido, no "hace 2 minutos".
   */
  occurredAt?: Date | null
  /** Si ya existe un post con este sourceId, actualizarlo en vez de ignorarlo. */
  updatable?: boolean
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
    /** Detalle del partido para la tarjeta resumen. */
    events?: SummaryEvent[]
  }
}

/**
 * Interruptor: publicar un post por CADA evento del partido.
 * Apagado a proposito — los goles se muestran en la tarjeta resumen que se
 * publica al finalizar. Se deja como flag por si se quiere volver atras.
 */
const POST_INDIVIDUAL_EVENTS = false

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
    // Los eventos ya NO generan un post cada uno: el delegado carga la planilla
    // completa de golpe (a veces dias despues del partido) y eso llenaba el
    // feed con 5-6 tarjetas seguidas del mismo partido, todas fechadas al
    // momento de la carga. Ahora el gol vive dentro del resumen que se publica
    // al finalizar el partido (onMatchFinalized).
    if (!POST_INDIVIDUAL_EVENTS) {
      // Si el partido YA estaba finalizado, este evento es una correccion
      // posterior: hay que refrescar la tarjeta resumen ya publicada.
      await this.refreshSummaryIfPublished(event.matchId)
      return
    }
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

    // Todos los eventos del partido, para armar UNA tarjeta resumen en vez de
    // un post suelto por gol. Los datos se cargan en diferido (a veces dias
    // despues), asi que publicar por evento llenaba el feed de golpe.
    const events = await this.db
      .select({
        id: matchEvents.id,
        eventType: matchEvents.eventType,
        teamId: matchEvents.teamId,
        playerUid: matchEvents.playerUid,
        playerName: matchEvents.playerName,
        minute: matchEvents.minute,
      })
      .from(matchEvents)
      .where(eq(matchEvents.matchId, match.id))
      .orderBy(asc(matchEvents.minute), asc(matchEvents.createdAt))

    const text = this.buildMatchSummaryText(ctx, match, events)

    await this.createAndDistribute({
      sourceId: `finalize_${match.id}`,
      type: 'match_result',
      text,
      // Fecha del partido, no la de carga de la planilla.
      occurredAt: ctx.scheduledAt,
      // El delegado corrige goleadores y marcador despues de cerrar: la
      // tarjeta se reescribe conservando reacciones y comentarios.
      updatable: true,
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
        events,
      },
    })
  }

  /** Se borro un evento: refresca la tarjeta resumen si ya estaba publicada. */
  async onMatchEventRemoved(matchId: string) {
    await this.refreshSummaryIfPublished(matchId)
  }

  /**
   * Vuelve a generar el resumen de un partido SOLO si ya estaba finalizado
   * (es decir, si la tarjeta ya se publico). Sirve para que las correcciones
   * de planilla posteriores al cierre se reflejen en el feed.
   */
  private async refreshSummaryIfPublished(matchId: string) {
    const [row] = await this.db
      .select({
        id: matches.id,
        status: matches.status,
        homeTeamId: matches.homeTeamId,
        awayTeamId: matches.awayTeamId,
        homeScore: matches.homeScore,
        awayScore: matches.awayScore,
      })
      .from(matches)
      .where(eq(matches.id, matchId))

    if (!row || row.status !== 'finished') return
    await this.onMatchFinalized(row)
  }

  /**
   * Nunca publicar un correo en el feed.
   *
   * player_name es un SNAPSHOT y en varios casos quedo con el email o con el
   * prefijo del email como nombre (ver backfill de nombres). Un post se ve por
   * ~120 personas, asi que si el nombre parece un correo se recorta a la parte
   * local; si aun asi queda vacio, se muestra un generico.
   */
  private safePlayerName(name: string | null): string {
    const raw = (name ?? '').trim()
    if (!raw) return 'Sin registrar'
    if (!raw.includes('@')) return raw
    const local = raw.split('@')[0].trim()
    return local || 'Jugador'
  }

  /**
   * Texto de la tarjeta resumen: marcador + goleadores de cada lado.
   * Agrupa los goles del mismo jugador ("Perez x2") en vez de repetirlo.
   */
  private buildMatchSummaryText(
    ctx: MatchContext,
    match: { homeScore: number | null; awayScore: number | null },
    events: SummaryEvent[],
  ): string {
    const head = `${ctx.homeTeam.name} ${match.homeScore ?? 0} - ${match.awayScore ?? 0} ${ctx.awayTeam.name}`

    const scorersOf = (teamId: string) => {
      const byPlayer = new Map<string, number>()
      for (const e of events) {
        const isGoal = e.eventType === 'goal' || e.eventType === 'penalty_scored'
        // El autogol suma al rival, por eso se cuenta en el otro equipo.
        const credited = e.eventType === 'own_goal'
          ? (e.teamId === ctx.homeTeam.id ? ctx.awayTeam.id : ctx.homeTeam.id)
          : e.teamId
        if (!isGoal && e.eventType !== 'own_goal') continue
        if (credited !== teamId) continue
        const name = this.safePlayerName(e.playerName)
        const label = e.eventType === 'own_goal' ? `${name} (ag)` : name
        byPlayer.set(label, (byPlayer.get(label) ?? 0) + 1)
      }
      return Array.from(byPlayer.entries())
        .map(([name, n]) => (n > 1 ? `${name} x${n}` : name))
        .join(', ')
    }

    const home = scorersOf(ctx.homeTeam.id)
    const away = scorersOf(ctx.awayTeam.id)
    const lines = [head]
    if (home) lines.push(`⚽ ${ctx.homeTeam.name}: ${home}`)
    if (away) lines.push(`⚽ ${ctx.awayTeam.name}: ${away}`)

    const reds = events.filter((e) => e.eventType === 'red_card')
    if (reds.length) {
      lines.push(`🟥 ${reds.map((e) => this.safePlayerName(e.playerName)).join(', ')}`)
    }
    return lines.join('\n')
  }

  /**
   * Evento personal: a un jugador lo inscribieron en una plantilla de torneo.
   * Se publica SOLO en el feed del jugador afectado (no en el del torneo).
   */
  async onPlayerAddedToRegistration(params: {
    registrationId: string
    playerUid: string
    team: { id: string; name: string; logoUrl: string | null }
    edition: { id: string; name: string | null }
  }) {
    const { registrationId, playerUid, team, edition } = params
    if (!playerUid) return

    const text = `Te inscribieron con ${team.name} al campeonato ${edition.name ?? ''}`.trim()
    const sourceId = `roster_added_${registrationId}_${playerUid}`

    const existing = await this.firestore
      .collection('posts')
      .where('sourceId', '==', sourceId)
      .limit(1)
      .get()
    if (!existing.empty) return

    const context = {
      registrationId,
      matchId: '',
      teamId: team.id,
      tournamentId: edition.id,
      tournamentName: edition.name,
      playerId: null,
      playerName: null,
      playerAvatarUrl: null,
      teamName: team.name,
      homeTeam: { id: team.id, name: team.name, logoUrl: team.logoUrl },
      awayTeam: { id: '', name: '', logoUrl: null },
      homeScore: null,
      awayScore: null,
      minute: null,
    }

    const postRef = this.firestore.collection('posts').doc()
    const createdAt = new Date()
    const postDoc = {
      id: postRef.id,
      source: 'system',
      sourceId,
      type: 'roster_added',
      text,
      authorType: 'system',
      authorId: null,
      context,
      media: [],
      counts: { reactions: 0, comments: 0, shares: 0 },
      createdAt,
    }
    const feedItem = { postId: postRef.id, type: 'roster_added', text, context, createdAt }

    const batch = this.firestore.batch()
    batch.set(postRef, postDoc)
    batch.set(
      this.firestore.collection('feeds').doc(`user_${playerUid}`).collection('items').doc(postRef.id),
      feedItem,
    )
    await batch.commit()
    this.logger.log(`Roster-added post -> user_${playerUid} (${edition.name})`)
  }

  /**
   * Escribe en tandas de 450 (el limite duro de Firestore es 500 por batch).
   * Con `merge` los documentos que no existan se crean.
   */
  private async commitInChunks(
    ops: { ref: FirebaseFirestore.DocumentReference; data: unknown }[],
    merge = false,
  ) {
    const SIZE = 450
    for (let i = 0; i < ops.length; i += SIZE) {
      const batch = this.firestore.batch()
      for (const op of ops.slice(i, i + SIZE)) {
        batch.set(op.ref, op.data as FirebaseFirestore.DocumentData, { merge })
      }
      await batch.commit()
    }
  }

  /**
   * Reescribe el contenido de un post ya publicado y el de sus copias en los
   * feeds. Conserva id, createdAt y counts (reacciones/comentarios), de modo
   * que corregir un goleador no borra la interaccion que ya tenia la tarjeta.
   */
  private async updateExistingPost(
    doc: FirebaseFirestore.QueryDocumentSnapshot,
    post: PostData,
  ) {
    const prev = doc.data()
    const patch = {
      text: post.text,
      context: post.context,
      ...(post.occurredAt ? { occurredAt: post.occurredAt } : {}),
      updatedAt: new Date(),
    }

    // Si nada cambio, no se escribe (evita ruido y escrituras inutiles).
    if (prev.text === post.text && JSON.stringify(prev.context) === JSON.stringify(post.context)) {
      this.logger.debug(`Post ${post.sourceId} sin cambios`)
      return
    }

    const staticTargets = this.resolveStaticFeedTargets(post.context)
    const userUids = await this.resolveAudience(post.context)
    const allTargets = [...staticTargets, ...userUids.map((uid) => `user_${uid}`)]

    const ops: { ref: FirebaseFirestore.DocumentReference; data: unknown }[] = [
      { ref: doc.ref, data: patch },
      ...allTargets.map((feedId) => ({
        ref: this.firestore
          .collection('feeds')
          .doc(feedId)
          .collection('items')
          .doc(doc.id) as FirebaseFirestore.DocumentReference,
        data: { postId: doc.id, type: post.type, ...patch },
      })),
    ]
    await this.commitInChunks(ops, true)
    this.logger.log(`Post actualizado ${post.sourceId} -> ${allTargets.length} feeds`)
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
        scheduledAt: matches.scheduledAt,
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
      scheduledAt: row.scheduledAt,
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
      // Los datos se cargan en diferido y se CORRIGEN (el delegado se equivoca
      // de goleador, ajusta el marcador). Si el post es actualizable, se
      // reescribe el contenido conservando el mismo id, reacciones y
      // comentarios; si no, se ignora como antes.
      if (!post.updatable) {
        this.logger.debug(`Post already exists for sourceId ${post.sourceId}`)
        return
      }
      await this.updateExistingPost(existing.docs[0], post)
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
      // Fecha real del hecho; si no se conoce, cae en createdAt.
      occurredAt: post.occurredAt ?? new Date(),
    }

    // Feed item (denormalized copy)
    const feedItem = {
      postId: postRef.id,
      type: post.type,
      text: post.text,
      context: post.context,
      createdAt: postDoc.createdAt,
      occurredAt: postDoc.occurredAt,
    }

    // Resolve all feed targets (tournament, teams, match + user feeds)
    const staticTargets = this.resolveStaticFeedTargets(post.context)
    const userUids = await this.resolveAudience(post.context)

    const allTargets = [
      ...staticTargets,
      ...userUids.map((uid) => `user_${uid}`),
    ]

    // Un solo batch (atomico): o llega a todos los feeds o no llega a ninguno.
    // Verificado en produccion con 962 destinos.
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
   * A quien le llega el post.
   *
   * Si es de un partido, NO se manda a todo el torneo: solo a los jugadores de
   * los dos equipos en disputa y a los del mismo grupo, que son los unicos a
   * quienes el resultado les cambia algo (la tabla de SU grupo). En el Mundial
   * eso baja el alcance de ~958 a ~150 personas, y el feed deja de llenarse de
   * partidos ajenos.
   */
  private async resolveAudience(context: PostData['context']): Promise<string[]> {
    if (context.matchId) {
      return this.resolveMatchAudience(context)
    }
    return this.resolveUserFeeds(context.tournamentId)
  }

  private async resolveMatchAudience(context: PostData['context']): Promise<string[]> {
    const teamIds = [context.homeTeam?.id, context.awayTeam?.id].filter(Boolean) as string[]

    const [match] = await this.db
      .select({ groupId: matches.groupId })
      .from(matches)
      .where(eq(matches.id, context.matchId))

    // Inscripciones que entran en la audiencia: las de los dos equipos y, si el
    // partido pertenece a un grupo, las del resto del grupo.
    const scope = match?.groupId
      ? or(
          inArray(registrations.teamId, teamIds),
          eq(registrations.groupId, match.groupId),
        )
      : inArray(registrations.teamId, teamIds)

    const regs = await this.db
      .select({ id: registrations.id, teamId: registrations.teamId })
      .from(registrations)
      .where(and(eq(registrations.editionId, context.tournamentId), scope))

    if (regs.length === 0) return []

    const uids = new Set<string>()

    const players = await this.db
      .select({ playerUid: registrationPlayers.playerUid })
      .from(registrationPlayers)
      .where(
        and(
          inArray(registrationPlayers.registrationId, regs.map((r) => r.id)),
          isNull(registrationPlayers.removedAt),
        ),
      )
    for (const p of players) if (p.playerUid) uids.add(p.playerUid)

    const directors = await this.db
      .select({ directorUid: teams.directorUid })
      .from(teams)
      .where(inArray(teams.id, regs.map((r) => r.teamId)))
    for (const d of directors) if (d.directorUid) uids.add(d.directorUid)

    return Array.from(uids)
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
      .where(
        and(
          inArray(registrationPlayers.registrationId, regIds),
          // Un jugador dado de baja ya no recibe el feed del torneo.
          isNull(registrationPlayers.removedAt),
        ),
      )

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
