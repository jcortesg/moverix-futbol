import { pgTable, uuid, varchar, text, timestamp } from 'drizzle-orm/pg-core'
import { organizations } from './organizations'

export const referees = pgTable('referees', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  uid: varchar('uid', { length: 128 }),
  fullName: varchar('full_name', { length: 120 }).notNull(),
  phone: varchar('phone', { length: 20 }),
  photoUrl: text('photo_url'),
  licenseNumber: varchar('license_number', { length: 40 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})
