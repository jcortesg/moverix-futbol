import { pgTable, uuid, varchar, text, timestamp, integer, doublePrecision } from 'drizzle-orm/pg-core'
import { organizations } from './organizations'

export const venues = pgTable('venues', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 120 }).notNull(),
  address: text('address'),
  city: varchar('city', { length: 100 }),
  lat: doublePrecision('lat'),
  lng: doublePrecision('lng'),
  pitchCount: integer('pitch_count').notNull().default(1),
  photoUrl: text('photo_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})
