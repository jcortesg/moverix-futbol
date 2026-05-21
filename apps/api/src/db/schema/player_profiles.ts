import { pgTable, uuid, varchar, text, timestamp, integer, pgEnum } from 'drizzle-orm/pg-core'

export const playerPositionEnum = pgEnum('player_position', [
  'GK',
  'CB',
  'LB',
  'RB',
  'CDM',
  'CM',
  'CAM',
  'LW',
  'RW',
  'CF',
  'ST',
])

export const playerProfiles = pgTable('player_profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  uid: varchar('uid', { length: 128 }).notNull().unique(),
  username: varchar('username', { length: 40 }).notNull().unique(),
  fullName: varchar('full_name', { length: 120 }).notNull(),
  docNumber: varchar('doc_number', { length: 40 }),
  avatarUrl: text('avatar_url'),
  bio: text('bio'),
  city: varchar('city', { length: 100 }),
  country: varchar('country', { length: 80 }).notNull().default('CO'),
  position: playerPositionEnum('position'),
  preferredFoot: varchar('preferred_foot', { length: 5 }),
  birthYear: integer('birth_year'),
  followersCount: integer('followers_count').notNull().default(0),
  followingCount: integer('following_count').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const follows = pgTable('follows', {
  id: uuid('id').primaryKey().defaultRandom(),
  followerUid: varchar('follower_uid', { length: 128 }).notNull(),
  followedUid: varchar('followed_uid', { length: 128 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
