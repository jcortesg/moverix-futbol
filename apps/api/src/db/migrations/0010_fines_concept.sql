-- Add fine_concept enum + concept column on fines for typed reasons.
-- Defaults to 'other' for existing rows.

BEGIN;

DO $$ BEGIN
  CREATE TYPE fine_concept AS ENUM (
    'yellow_card',
    'yellow_card_accumulation',
    'red_card',
    'walkover',
    'late_arrival',
    'misconduct',
    'team_misconduct',
    'other'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE fines
  ADD COLUMN IF NOT EXISTS concept fine_concept NOT NULL DEFAULT 'other';

COMMIT;
