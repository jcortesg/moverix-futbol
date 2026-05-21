-- Expand registration_players with personal info fields.

BEGIN;

ALTER TABLE registration_players
  ALTER COLUMN player_name TYPE VARCHAR(160),
  ADD COLUMN IF NOT EXISTS first_name       VARCHAR(80),
  ADD COLUMN IF NOT EXISTS last_name        VARCHAR(80),
  ADD COLUMN IF NOT EXISTS doc_number       VARCHAR(40),
  ADD COLUMN IF NOT EXISTS birth_date       DATE,
  ADD COLUMN IF NOT EXISTS employer         VARCHAR(120),
  ADD COLUMN IF NOT EXISTS phone            VARCHAR(40),
  ADD COLUMN IF NOT EXISTS email            VARCHAR(160),
  ADD COLUMN IF NOT EXISTS health_provider  VARCHAR(80);

COMMIT;
