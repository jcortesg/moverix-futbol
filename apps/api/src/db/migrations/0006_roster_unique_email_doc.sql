-- Within a team roster (registration), email and doc_number must be unique.
-- NULLs are allowed to repeat (partial indexes).

BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS registration_players_reg_email_unique
  ON registration_players (registration_id, email)
  WHERE email IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS registration_players_reg_doc_unique
  ON registration_players (registration_id, doc_number)
  WHERE doc_number IS NOT NULL;

COMMIT;
