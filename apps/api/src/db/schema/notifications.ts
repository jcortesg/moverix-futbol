import { pgTable, uuid, varchar, timestamp, jsonb, pgEnum, uniqueIndex, index } from 'drizzle-orm/pg-core'

export const notificationTypeEnum = pgEnum('notification_type', [
  'match',   // partido programado / próximo
  'result',  // resultado final
  'team',    // te agregaron a equipo/nómina
  'edition', // inscripción / campeonato
  'social',  // nuevo seguidor
  'system',
])

export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    recipientUid: varchar('recipient_uid', { length: 128 }).notNull(),
    type: notificationTypeEnum('type').notNull(),
    title: varchar('title', { length: 140 }).notNull(),
    body: varchar('body', { length: 300 }).notNull(),
    // Datos para navegar al tocar (matchId, teamId, editionId, uid…).
    data: jsonb('data').$type<Record<string, string>>(),
    readAt: timestamp('read_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    recipientIdx: index('notifications_recipient_idx').on(t.recipientUid, t.createdAt),
  }),
)

export const pushTokens = pgTable(
  'push_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    uid: varchar('uid', { length: 128 }).notNull(),
    token: varchar('token', { length: 200 }).notNull(),
    platform: varchar('platform', { length: 10 }), // ios | android
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tokenUnique: uniqueIndex('push_tokens_token_unique').on(t.token),
    uidIdx: index('push_tokens_uid_idx').on(t.uid),
  }),
)
