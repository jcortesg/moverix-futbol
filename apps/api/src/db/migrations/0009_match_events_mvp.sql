-- Add 'mvp' to event_type enum and ensure only one MVP per match.

BEGIN;

ALTER TYPE event_type ADD VALUE IF NOT EXISTS 'mvp';

COMMIT;

-- Note: ADD VALUE cannot be inside a transaction with subsequent uses on some
-- Postgres versions; the unique index runs in its own statement.
CREATE UNIQUE INDEX IF NOT EXISTS match_events_one_mvp_per_match
  ON match_events (match_id) WHERE event_type = 'mvp';
