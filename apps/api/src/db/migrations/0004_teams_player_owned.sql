-- Teams now belong to a player (directorUid), not to an organization.
-- Registrations gain registeredByUid + seedRank + unique(edition, team).
-- New table: registration_players (roster per edition).

BEGIN;

-- teams: drop organization_id, enforce director_uid, add city
ALTER TABLE teams DROP CONSTRAINT IF EXISTS teams_organization_id_organizations_id_fk;
ALTER TABLE teams DROP COLUMN IF EXISTS organization_id;
ALTER TABLE teams ALTER COLUMN director_uid SET NOT NULL;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS city VARCHAR(100);

-- registrations: audit + seeding
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS registered_by_uid VARCHAR(128);
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS seed_rank INTEGER;

-- registrations: unique (edition, team) to prevent double-inscription
CREATE UNIQUE INDEX IF NOT EXISTS registrations_edition_team_unique
  ON registrations (edition_id, team_id);

-- roster per edition
CREATE TABLE IF NOT EXISTS registration_players (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id UUID NOT NULL REFERENCES registrations(id) ON DELETE CASCADE,
  player_uid      VARCHAR(128) NOT NULL,
  player_name     VARCHAR(120) NOT NULL,
  jersey_number   INTEGER,
  position        player_position,
  is_captain      BOOLEAN NOT NULL DEFAULT FALSE,
  added_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS registration_players_reg_uid_unique
  ON registration_players (registration_id, player_uid);

COMMIT;
