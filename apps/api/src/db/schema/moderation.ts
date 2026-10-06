import { pgTable, uuid, varchar, text, timestamp, uniqueIndex, index, pgEnum } from 'drizzle-orm/pg-core'

/** Bloqueo entre usuarios: el bloqueador deja de ver contenido del bloqueado. */
export const userBlocks = pgTable(
  'user_blocks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    blockerUid: varchar('blocker_uid', { length: 128 }).notNull(),
    blockedUid: varchar('blocked_uid', { length: 128 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pairUnique: uniqueIndex('user_blocks_pair_unique').on(t.blockerUid, t.blockedUid),
    blockerIdx: index('user_blocks_blocker_idx').on(t.blockerUid),
  }),
)

export const reportStatusEnum = pgEnum('report_status', ['pending', 'resolved', 'dismissed'])

/** Bandeja de reportes que revisa el organizador. */
export const contentReports = pgTable(
  'content_reports',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // El comentario vive en Firestore; aqui se guarda su referencia.
    postId: varchar('post_id', { length: 128 }).notNull(),
    commentId: varchar('comment_id', { length: 128 }).notNull(),
    // Copia del texto por si el comentario se borra antes de la revision.
    commentText: text('comment_text'),
    authorUid: varchar('author_uid', { length: 128 }),
    reporterUid: varchar('reporter_uid', { length: 128 }).notNull(),
    reason: varchar('reason', { length: 80 }),
    status: reportStatusEnum('status').notNull().default('pending'),
    resolvedBy: varchar('resolved_by', { length: 128 }),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    reportUnique: uniqueIndex('content_reports_unique').on(t.commentId, t.reporterUid),
    pendingIdx: index('content_reports_pending_idx').on(t.status, t.createdAt),
  }),
)
