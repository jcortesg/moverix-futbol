import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { FieldValue } from 'firebase-admin/firestore'
import { eq } from 'drizzle-orm'
import { FirestoreService } from '../../common/services/firestore.service'
import { DatabaseService } from '../../db/database.service'
import { playerProfiles } from '../../db/schema'
import { MobileNotificationsService } from './mobile-notifications.service'

/**
 * Reacciones permitidas. Lista CERRADA: el cliente no inventa tipos.
 * OJO: cambiar estos nombres despues obliga a migrar las reacciones ya
 * guardadas en Firestore (posts/{id}/reactions) y los contadores byType.
 */
export const REACTION_TYPES = ['megusta', 'golazo', 'crack', 'aplauso', 'uy', 'jaja'] as const
export type ReactionType = (typeof REACTION_TYPES)[number]

/**
 * Emoji SOLO para el texto del push: una notificacion del SO no renderiza
 * iconos vectoriales. Dentro de la app se usan iconos (ver `icon`).
 */
const REACTION_EMOJI: Record<ReactionType, string> = {
  megusta: '❤️',
  golazo: '⚽',
  crack: '🔥',
  aplauso: '👏',
  uy: '😮',
  jaja: '😂',
}

/** Etiqueta visible, por si el cliente quiere mostrarla sin traducir nada. */
export const REACTION_LABEL: Record<ReactionType, string> = {
  megusta: 'Me gusta',
  golazo: 'Golazo',
  crack: 'Crack',
  aplauso: 'Aplauso',
  uy: 'Uy',
  jaja: 'Jaja',
}

/**
 * Icono de MaterialCommunityIcons por tipo (el set que ya usa la app).
 * Se sirve desde la API para poder cambiar el catalogo sin recompilar.
 */
const REACTION_ICON: Record<ReactionType, string> = {
  megusta: 'heart',
  golazo: 'soccer',
  crack: 'fire',
  aplauso: 'hand-clap',
  uy: 'emoticon-frown',
  jaja: 'emoticon-happy',
}

/** Target 'post' = la tarjeta completa; cualquier otro valor = id de un evento. */
const POST_TARGET = 'post'

@Injectable()
export class MobileReactionsService {
  private readonly logger = new Logger(MobileReactionsService.name)

  constructor(
    private readonly firestoreService: FirestoreService,
    private readonly database: DatabaseService,
    private readonly notifications: MobileNotificationsService,
  ) {}

  private get firestore() {
    return this.firestoreService.db
  }

  /**
   * Reacciona a un post o a un evento concreto dentro de el (un gol).
   *
   * Un usuario tiene UNA reaccion por target: si ya habia reaccionado, se
   * cambia el tipo (y los contadores se ajustan). Enviar el mismo tipo dos
   * veces la quita, como en cualquier red social.
   */
  async react(uid: string, postId: string, type: string, targetId?: string) {
    if (!REACTION_TYPES.includes(type as ReactionType)) {
      throw new BadRequestException(`Reacción inválida: ${type}`)
    }
    const target = targetId || POST_TARGET
    const postRef = this.firestore.collection('posts').doc(postId)
    const snap = await postRef.get()
    if (!snap.exists) throw new NotFoundException('Publicación no encontrada')

    const post = snap.data()!
    // Un doc por (usuario, target): asi el mismo usuario puede reaccionar a
    // varios goles de la misma tarjeta, pero solo una vez a cada uno.
    const reactionRef = postRef.collection('reactions').doc(`${uid}_${target}`)

    const result = await this.firestore.runTransaction(async (tx) => {
      const prev = await tx.get(reactionRef)
      const prevType = prev.exists ? (prev.data()?.type as string) : null

      // Mismo tipo otra vez = quitar la reaccion.
      if (prevType === type) {
        tx.delete(reactionRef)
        tx.update(postRef, {
          'counts.reactions': FieldValue.increment(-1),
          [`counts.byType.${type}`]: FieldValue.increment(-1),
        })
        return { action: 'removed' as const, type: null }
      }

      tx.set(reactionRef, {
        uid,
        type,
        targetId: target,
        createdAt: prev.exists ? prev.data()?.createdAt ?? new Date() : new Date(),
        updatedAt: new Date(),
      })

      if (prevType) {
        // Cambio de tipo: el total no se mueve, solo el desglose.
        tx.update(postRef, {
          [`counts.byType.${prevType}`]: FieldValue.increment(-1),
          [`counts.byType.${type}`]: FieldValue.increment(1),
        })
        return { action: 'changed' as const, type }
      }

      tx.update(postRef, {
        'counts.reactions': FieldValue.increment(1),
        [`counts.byType.${type}`]: FieldValue.increment(1),
      })
      return { action: 'added' as const, type }
    })

    // Notificar al etiquetado solo cuando la reaccion es NUEVA (no al cambiar
    // de tipo ni al quitarla), para no convertirlo en spam.
    if (result.action === 'added') {
      this.notifyTagged(uid, postId, post, target, type as ReactionType).catch((err) =>
        this.logger.warn(`notify reaction: ${err}`),
      )
    }

    return { ok: true, ...result }
  }

  /**
   * Avisa al jugador etiquetado (el autor del gol, o los mencionados en la
   * tarjeta) que alguien reacciono. Nunca se notifica a si mismo.
   */
  private async notifyTagged(
    reactorUid: string,
    postId: string,
    post: FirebaseFirestore.DocumentData,
    target: string,
    type: ReactionType,
  ) {
    const ctx = post.context ?? {}
    let taggedUids: string[] = []

    if (target !== POST_TARGET) {
      // Reaccion a un evento concreto: solo su protagonista.
      const ev = (ctx.events ?? []).find((e: any) => e.id === target)
      if (ev?.playerUid) taggedUids = [ev.playerUid]
    } else if (ctx.playerId) {
      taggedUids = [ctx.playerId]
    } else {
      // Tarjeta resumen sin protagonista unico: se avisa a los que aparecen.
      taggedUids = Array.from(
        new Set((ctx.events ?? []).map((e: any) => e.playerUid).filter(Boolean)),
      ) as string[]
    }

    const recipients = taggedUids.filter((u) => u && u !== reactorUid)
    if (!recipients.length) return

    const reactorName = await this.getDisplayName(reactorUid)

    // "tu gol" solo si el evento es suyo de verdad; una roja no se celebra.
    let what = 'tu partido'
    if (target !== POST_TARGET) {
      const ev = (ctx.events ?? []).find((e: any) => e.id === target)
      what = ev?.eventType === 'red_card' ? 'tu jugada' : 'tu gol'
    } else if (ctx.playerId) {
      what = 'tu publicación'
    }

    await this.notifications.createFor(recipients, {
      type: 'social',
      title: `${REACTION_EMOJI[type]} ${reactorName} reaccionó a ${what}`,
      body: post.text?.split('\n')[0] ?? '',
      data: { kind: 'post', postId, targetId: target },
    })
  }

  private async getDisplayName(uid: string): Promise<string> {
    const [row] = await this.database.db
      .select({ fullName: playerProfiles.fullName })
      .from(playerProfiles)
      .where(eq(playerProfiles.uid, uid))
    const name = (row?.fullName ?? '').trim()
    if (!name) return 'Alguien'
    // Nunca exponer un correo como nombre (player_profiles arrastra casos asi).
    if (name.includes('@')) return name.split('@')[0] || 'Alguien'
    // Solo el primer nombre, para que el titulo del push no se corte.
    return name.split(/\s+/)[0]
  }

  /**
   * Catalogo para la app: nombre, etiqueta y emoji de cada reaccion, en orden.
   * Sirve para que el cliente pinte la fila sin hardcodear la lista.
   */
  catalog() {
    return REACTION_TYPES.map((type) => ({
      type,
      label: REACTION_LABEL[type],
      icon: REACTION_ICON[type],
      emoji: REACTION_EMOJI[type],
    }))
  }

  /** Reacciones del usuario en un post (para pintar el estado en la UI). */
  async myReactions(uid: string, postId: string) {
    const snap = await this.firestore
      .collection('posts')
      .doc(postId)
      .collection('reactions')
      .where('uid', '==', uid)
      .get()
    return snap.docs.map((d) => ({
      targetId: d.data().targetId ?? POST_TARGET,
      type: d.data().type,
    }))
  }
}
