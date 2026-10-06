import { pgTable, uuid, varchar, text, timestamp, integer, jsonb, pgEnum, uniqueIndex, boolean } from 'drizzle-orm/pg-core'
import { leagues } from './leagues'

export const editionStatusEnum = pgEnum('edition_status', [
  'draft',
  'registration',
  'active',
  'finished',
])

export const editions = pgTable(
  'editions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    leagueId: uuid('league_id')
      .notNull()
      .references(() => leagues.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 120 }).notNull(),
    season: varchar('season', { length: 20 }).notNull(),
    status: editionStatusEnum('status').notNull().default('draft'),
    formatConfig: jsonb('format_config').notNull().default({}),
    bracketState: jsonb('bracket_state'),
    tiebreakerRules: jsonb('tiebreaker_rules'),
    maxTeams: integer('max_teams').notNull().default(16),
    // Config de inscripción de jugadores (la define el organizador por edición).
    minPlayersPerTeam: integer('min_players_per_team'),
    maxPlayersPerTeam: integer('max_players_per_team'),
    // Lista de campos obligatorios del jugador. Vacío => defaults en el backend.
    requiredPlayerFields: jsonb('required_player_fields').notNull().default([]),
    registrationFee: integer('registration_fee').notNull().default(0),
    prizePool: integer('prize_pool').notNull().default(0),
    currency: varchar('currency', { length: 3 }).notNull().default('COP'),
    logoUrl: text('logo_url'),
    bannerUrl: text('banner_url'),
    slug: varchar('slug', { length: 100 }).notNull().unique(),
    isPublished: boolean('is_published').notNull().default(false),
    hiddenOnIos: boolean('hidden_on_ios').notNull().default(false),
    // Inscripciones abiertas/cerradas, independiente de status (deportivo).
    registrationsOpen: boolean('registrations_open').notNull().default(true),
    /**
     * Valores de multas de esta edición. Claves opcionales; lo que falte cae en
     * los valores por defecto del servicio. Ver 0031_edition_fine_defaults.sql
     */
    fineDefaults: jsonb('fine_defaults'),
    /** Cierre GENERAL de nóminas: bloquea la edición de todas las plantillas. */
    rostersLocked: boolean('rosters_locked').notNull().default(false),
    /** Clave pública y revocable para el widget embebible de estadísticas. */
    embedKey: varchar('embed_key', { length: 32 }),
    publicDescription: text('public_description'),
    rulesUrl: text('rules_url'),
    startDate: timestamp('start_date', { withTimezone: true }),
    endDate: timestamp('end_date', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    leagueSeasonUnique: uniqueIndex('editions_league_season_unique').on(t.leagueId, t.season),
  }),
)
