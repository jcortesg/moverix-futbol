import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common'
import { FieldValue } from 'firebase-admin/firestore'
import { and, eq, inArray, or } from 'drizzle-orm'
import { FirestoreService } from '../../common/services/firestore.service'
import { DatabaseService } from '../../db/database.service'
import {
  contentReports,
  editions,
  leagues,
  organizations,
  playerProfiles,
  registrations,
  registrationPlayers,
  teams,
  userBlocks,
} from '../../db/schema'
import { MobileNotificationsService } from './mobile-notifications.service'

const MAX_LEN = 300

/**
 * A los N reportes el comentario se oculta SOLO hasta que el organizador
 * revise. Evita que algo ofensivo siga visible mientras tanto (App Store 1.2
 * exige actuar en 24h).
 */
const AUTO_HIDE_REPORTS = 3

/**
 * Filtro basico de groserias. No pretende ser exhaustivo: corta lo obvio y
 * deja el resto al flujo de reportes. Se compara sobre el texto normalizado
 * (sin tildes, sin repeticiones) para que "put00" o "pütá" no lo esquiven.
 */
const BANNED = [
  'hijueputa', 'gonorrea', 'malparido', 'marica', 'maricon', 'puta', 'puto',
  'verga', 'mierda', 'coño', 'pendejo', 'imbecil', 'estupido', 'idiota',
  'perra', 'zorra', 'culero', 'cabron', 'joder', 'follar', 'polla',
]

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // tildes
    .replace(/0/g, 'o')
    .replace(/1/g, 'i')
    .replace(/3/g, 'e')
    .replace(/4/g, 'a')
    .replace(/5/g, 's')
    .replace(/@/g, 'a')
    .replace(/(.)\1{2,}/g, '$1') // "putaaaa" -> "puta"
    .replace(/[^a-z\s]/g, ' ')
}

@Injectable()
export class MobileCommentsService {
  private readonly logger = new Logger(MobileCommentsService.name)

  constructor(
    private readonly firestoreService: FirestoreService,
    private readonly database: DatabaseService,
    private readonly notifications: MobileNotificationsService,
  ) {}

  private get firestore() {
    return this.firestoreService.db
  }
  private get db() {
    return this.database.db
  }

  /** Publica un comentario. Solo pueden los jugadores de los equipos del partido. */
  async create(uid: string, postId: string, rawText: string) {
    const text = (rawText ?? '').trim()
    if (!text) throw new BadRequestException('El comentario está vacío')
    if (text.length > MAX_LEN) {
      throw new BadRequestException(`Máximo ${MAX_LEN} caracteres`)
    }

    const words = new Set(normalize(text).split(/\s+/))
    const hit = BANNED.find((w) => words.has(w))
    if (hit) {
      throw new BadRequestException(
        'Tu comentario tiene lenguaje no permitido. Respeta a los demás jugadores.',
      )
    }

    const postRef = this.firestore.collection('posts').doc(postId)
    const snap = await postRef.get()
    if (!snap.exists) throw new NotFoundException('Publicación no encontrada')
    const post = snap.data()!

    await this.assertCanComment(uid, post)

    const profile = await this.profileOf(uid)
    const commentRef = postRef.collection('comments').doc()

    await this.firestore.runTransaction(async (tx) => {
      tx.set(commentRef, {
        id: commentRef.id,
        uid,
        authorName: profile.name,
        authorAvatarUrl: profile.avatarUrl,
        text,
        reportCount: 0,
        createdAt: new Date(),
      })
      tx.update(postRef, { 'counts.comments': FieldValue.increment(1) })
    })

    this.notifyMentioned(uid, postId, post, profile.name, text).catch((e) =>
      this.logger.warn(`notify comment: ${e}`),
    )

    return { id: commentRef.id, text }
  }

  /**
   * Lista los comentarios visibles para `uid`: oculta los borrados, los
   * auto-ocultados por reportes y los de usuarios que tenga bloqueados.
   */
  async list(uid: string, postId: string, limit = 50) {
    const snap = await this.firestore
      .collection('posts')
      .doc(postId)
      .collection('comments')
      .orderBy('createdAt', 'asc')
      .limit(limit)
      .get()

    const blocked = await this.blockedBy(uid)

    return snap.docs
      .map((d) => d.data())
      .filter((c) => !c.deletedAt && !c.hiddenAt && !blocked.has(c.uid))
      .map((c) => ({
        id: c.id,
        uid: c.uid,
        authorName: c.authorName,
        authorAvatarUrl: c.authorAvatarUrl ?? null,
        text: c.text,
        createdAt: c.createdAt?.toDate?.() ?? c.createdAt,
      }))
  }

  /** Borra un comentario: solo el autor o el organizador del torneo. */
  async remove(uid: string, postId: string, commentId: string) {
    const postRef = this.firestore.collection('posts').doc(postId)
    const ref = postRef.collection('comments').doc(commentId)
    const snap = await ref.get()
    if (!snap.exists) throw new NotFoundException('Comentario no encontrado')

    const c = snap.data()!
    if (c.uid !== uid) {
      const post = (await postRef.get()).data()
      const isOrganizer = await this.isOrganizer(uid, post?.context?.tournamentId)
      if (!isOrganizer) {
        throw new ForbiddenException('Solo el autor o el organizador pueden eliminarlo')
      }
    }

    await this.firestore.runTransaction(async (tx) => {
      // Borrado LOGICO: el organizador debe poder ver que se dijo si hay
      // reportes abiertos sobre este comentario.
      tx.update(ref, { deletedAt: new Date(), deletedBy: uid })
      tx.update(postRef, { 'counts.comments': FieldValue.increment(-1) })
    })

    return { id: commentId }
  }

  /**
   * Me gusta a un comentario (estilo Instagram). Un doc por usuario bajo el
   * comentario; el contador se mantiene con increment en la misma transaccion.
   */
  async toggleLike(uid: string, postId: string, commentId: string) {
    const postRef = this.firestore.collection('posts').doc(postId)
    const ref = postRef.collection('comments').doc(commentId)
    // Un unico doc por usuario y post con el mapa de comentarios que le
    // gustaron: leer "mis likes" del hilo cuesta 1 lectura, no N.
    const myLikesRef = postRef.collection('commentLikes').doc(uid)

    return this.firestore.runTransaction(async (tx) => {
      const [c, mine] = await Promise.all([tx.get(ref), tx.get(myLikesRef)])
      if (!c.exists) throw new NotFoundException('Comentario no encontrado')

      const liked = !!mine.data()?.[commentId]
      if (liked) {
        tx.set(myLikesRef, { [commentId]: FieldValue.delete() }, { merge: true })
        tx.update(ref, { likes: FieldValue.increment(-1) })
        return { liked: false }
      }
      tx.set(myLikesRef, { [commentId]: true }, { merge: true })
      tx.update(ref, { likes: FieldValue.increment(1) })
      return { liked: true }
    })
  }

  /** Ids de los comentarios de este post a los que `uid` dio me gusta. */
  async myLikes(uid: string, postId: string): Promise<string[]> {
    const snap = await this.firestore
      .collection('posts')
      .doc(postId)
      .collection('commentLikes')
      .doc(uid)
      .get()
    return Object.keys(snap.data() ?? {})
  }

  /** Reporta un comentario. Al llegar a AUTO_HIDE_REPORTS se oculta. */
  async report(uid: string, postId: string, commentId: string, reason?: string) {
    const ref = this.firestore
      .collection('posts')
      .doc(postId)
      .collection('comments')
      .doc(commentId)
    const snap = await ref.get()
    if (!snap.exists) throw new NotFoundException('Comentario no encontrado')
    const c = snap.data()!

    if (c.uid === uid) throw new BadRequestException('No puedes reportar tu propio comentario')

    try {
      await this.db.insert(contentReports).values({
        postId,
        commentId,
        commentText: c.text,
        authorUid: c.uid,
        reporterUid: uid,
        reason: reason?.slice(0, 80) ?? 'inapropiado',
      })
    } catch (err) {
      // Indice unico (comment_id, reporter_uid): ya lo habia reportado.
      const pg = (err as any)?.cause ?? err
      if (pg?.code === '23505') return { ok: true, already: true }
      throw err
    }

    const count = (c.reportCount ?? 0) + 1
    const patch: Record<string, unknown> = { reportCount: count }
    if (count >= AUTO_HIDE_REPORTS && !c.hiddenAt) patch.hiddenAt = new Date()
    await ref.update(patch)

    return { ok: true, reportCount: count, hidden: count >= AUTO_HIDE_REPORTS }
  }

  /** Bloquear / desbloquear a otro usuario. */
  async block(uid: string, targetUid: string) {
    if (uid === targetUid) throw new BadRequestException('No puedes bloquearte a ti mismo')
    await this.db
      .insert(userBlocks)
      .values({ blockerUid: uid, blockedUid: targetUid })
      .onConflictDoNothing()
    return { ok: true }
  }

  async unblock(uid: string, targetUid: string) {
    await this.db
      .delete(userBlocks)
      .where(and(eq(userBlocks.blockerUid, uid), eq(userBlocks.blockedUid, targetUid)))
    return { ok: true }
  }

  async listBlocked(uid: string) {
    const rows = await this.db
      .select({ uid: userBlocks.blockedUid, createdAt: userBlocks.createdAt })
      .from(userBlocks)
      .where(eq(userBlocks.blockerUid, uid))
    if (!rows.length) return []
    const profiles = await this.db
      .select({ uid: playerProfiles.uid, fullName: playerProfiles.fullName, avatarUrl: playerProfiles.avatarUrl })
      .from(playerProfiles)
      .where(inArray(playerProfiles.uid, rows.map((r) => r.uid)))
    const byUid = new Map(profiles.map((p) => [p.uid, p]))
    return rows.map((r) => ({
      uid: r.uid,
      name: byUid.get(r.uid)?.fullName ?? 'Jugador',
      avatarUrl: byUid.get(r.uid)?.avatarUrl ?? null,
      createdAt: r.createdAt,
    }))
  }

  // ── Internos ────────────────────────────────────────────

  /** uids que `uid` bloqueó, mas los que lo bloquearon a el (corte simetrico). */
  private async blockedBy(uid: string): Promise<Set<string>> {
    const rows = await this.db
      .select({ a: userBlocks.blockerUid, b: userBlocks.blockedUid })
      .from(userBlocks)
      .where(or(eq(userBlocks.blockerUid, uid), eq(userBlocks.blockedUid, uid)))
    const set = new Set<string>()
    for (const r of rows) set.add(r.a === uid ? r.b : r.a)
    return set
  }

  /**
   * Solo comentan los jugadores y DT de los DOS equipos del partido: se
   * conocen entre si, asi que se autorregulan, y baja la superficie de
   * conflicto frente a abrirlo a todo el torneo.
   */
  private async assertCanComment(uid: string, post: FirebaseFirestore.DocumentData) {
    const ctx = post.context ?? {}
    const teamIds = [ctx.homeTeam?.id, ctx.awayTeam?.id].filter(Boolean) as string[]
    if (!teamIds.length) return // posts sin partido (roster_added): sin restriccion

    const [director] = await this.db
      .select({ id: teams.id })
      .from(teams)
      .where(and(inArray(teams.id, teamIds), eq(teams.directorUid, uid)))
    if (director) return

    const [player] = await this.db
      .select({ id: registrationPlayers.id })
      .from(registrationPlayers)
      .innerJoin(registrations, eq(registrations.id, registrationPlayers.registrationId))
      .where(
        and(
          inArray(registrations.teamId, teamIds),
          eq(registrationPlayers.playerUid, uid),
        ),
      )
    if (!player) {
      throw new ForbiddenException('Solo los equipos que jugaron pueden comentar este partido')
    }
  }

  /** Dueño del torneo: edition -> league -> organization.owner_uid. */
  private async isOrganizer(uid: string, editionId?: string): Promise<boolean> {
    if (!editionId) return false
    const [row] = await this.db
      .select({ id: editions.id })
      .from(editions)
      .innerJoin(leagues, eq(leagues.id, editions.leagueId))
      .innerJoin(organizations, eq(organizations.id, leagues.organizationId))
      .where(and(eq(editions.id, editionId), eq(organizations.ownerUid, uid)))
    return !!row
  }

  private async profileOf(uid: string) {
    const [row] = await this.db
      .select({ fullName: playerProfiles.fullName, avatarUrl: playerProfiles.avatarUrl })
      .from(playerProfiles)
      .where(eq(playerProfiles.uid, uid))
    const raw = (row?.fullName ?? '').trim()
    const name = !raw ? 'Jugador' : raw.includes('@') ? raw.split('@')[0] || 'Jugador' : raw
    return { name, avatarUrl: row?.avatarUrl ?? null }
  }

  /** Avisa a los jugadores de la tarjeta y a quienes ya comentaron el hilo. */
  private async notifyMentioned(
    authorUid: string,
    postId: string,
    post: FirebaseFirestore.DocumentData,
    authorName: string,
    text: string,
  ) {
    const ctx = post.context ?? {}
    const uids = new Set<string>()

    if (ctx.playerId) uids.add(ctx.playerId)
    for (const e of ctx.events ?? []) if (e.playerUid) uids.add(e.playerUid)

    // Quienes ya participaron en el hilo.
    const prev = await this.firestore
      .collection('posts')
      .doc(postId)
      .collection('comments')
      .limit(100)
      .get()
    for (const d of prev.docs) {
      const c = d.data()
      if (c.uid && !c.deletedAt) uids.add(c.uid)
    }

    uids.delete(authorUid)
    if (!uids.size) return

    // No notificar a quien bloqueó al autor.
    const blocked = await this.db
      .select({ blocker: userBlocks.blockerUid })
      .from(userBlocks)
      .where(and(eq(userBlocks.blockedUid, authorUid), inArray(userBlocks.blockerUid, [...uids])))
    for (const b of blocked) uids.delete(b.blocker)
    if (!uids.size) return

    await this.notifications.createFor([...uids], {
      type: 'social',
      title: `${authorName} comentó`,
      body: text.length > 90 ? `${text.slice(0, 90)}…` : text,
      data: { kind: 'post', postId },
    })
  }
}
