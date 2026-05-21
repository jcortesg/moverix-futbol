import { pgTable, uuid, varchar, text, timestamp, pgEnum, uniqueIndex } from 'drizzle-orm/pg-core'
import { organizations } from './organizations'

export const sportFormatEnum = pgEnum('sport_format', ['F5', 'F8', 'F11'])
export const genderEnum = pgEnum('gender', ['M', 'F', 'Mixed'])

export const leagues = pgTable(
  'leagues',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 120 }).notNull(),
    slug: varchar('slug', { length: 80 }).notNull(),
    sportFormat: sportFormatEnum('sport_format').notNull(),
    gender: genderEnum('gender').notNull().default('M'),
    logoUrl: text('logo_url'),
    bannerUrl: text('banner_url'),
    description: text('description'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    orgSlugUnique: uniqueIndex('leagues_org_slug_unique').on(t.organizationId, t.slug),
  }),
)
