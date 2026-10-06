import { pgTable, varchar, text, timestamp } from 'drizzle-orm/pg-core'

/** Páginas legales editables (privacidad, términos). Fuente única para app y web. */
export const legalPages = pgTable('legal_pages', {
  key: varchar('key', { length: 40 }).primaryKey(), // 'privacy' | 'terms'
  title: varchar('title', { length: 120 }).notNull(),
  content: text('content').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})
