import { pgTable, uuid, varchar, integer, text, timestamp, pgEnum } from 'drizzle-orm/pg-core'
import { editions } from './editions'
import { teams } from './teams'
import { registrations } from './registrations'
import { fines } from './fines'

export const paymentStatusEnum = pgEnum('payment_status', [
  'pending',
  'verified',
  'rejected',
])

export const paymentTypeEnum = pgEnum('payment_type', [
  'registration',
  'fine',
  'other',
])

export const payments = pgTable('payments', {
  id: uuid('id').primaryKey().defaultRandom(),
  editionId: uuid('edition_id')
    .notNull()
    .references(() => editions.id, { onDelete: 'cascade' }),
  teamId: uuid('team_id')
    .notNull()
    .references(() => teams.id, { onDelete: 'cascade' }),
  registrationId: uuid('registration_id').references(() => registrations.id, { onDelete: 'set null' }),
  fineId: uuid('fine_id').references(() => fines.id, { onDelete: 'set null' }),
  type: paymentTypeEnum('type').notNull().default('registration'),
  amount: integer('amount').notNull(),
  currency: varchar('currency', { length: 3 }).notNull().default('COP'),
  status: paymentStatusEnum('status').notNull().default('pending'),
  receiptUrl: text('receipt_url'),
  notes: text('notes'),
  verifiedAt: timestamp('verified_at', { withTimezone: true }),
  verifiedByUid: varchar('verified_by_uid', { length: 128 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})
