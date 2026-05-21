-- Add pitch_count to venues for venues with multiple courts/fields.

BEGIN;

ALTER TABLE venues
  ADD COLUMN IF NOT EXISTS pitch_count INTEGER NOT NULL DEFAULT 1;

COMMIT;
