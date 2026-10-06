import { pgTable, uuid, varchar, text, timestamp } from 'drizzle-orm/pg-core'

export const teams = pgTable('teams', {
  id: uuid('id').primaryKey().defaultRandom(),
  directorUid: varchar('director_uid', { length: 128 }).notNull(),
  name: varchar('name', { length: 120 }).notNull(),
  shortName: varchar('short_name', { length: 10 }),
  slug: varchar('slug', { length: 30 }).notNull().unique(),
  accessCode: varchar('access_code', { length: 8 }).notNull().unique(),
  logoUrl: text('logo_url'),
  primaryColor: varchar('primary_color', { length: 7 }),
  secondaryColor: varchar('secondary_color', { length: 7 }),
  city: varchar('city', { length: 100 }),
  // Email del delegado cuando aún no tiene cuenta en la app. Al registrarse con
  // este email, el equipo se le asigna como director (ver claimPendingDelegateTeams).
  pendingDelegateEmail: varchar('pending_delegate_email', { length: 160 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})
