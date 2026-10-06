-- Delegado de partido asignado por CORREO antes de que tenga cuenta.
-- Al registrarse (o al abrir su perfil) se hace el match por email y la fila
-- pasa a tener su uid real. Mismo patron que teams.pending_delegate_email.
--
-- uid pasa a ser NULLABLE: mientras no exista la cuenta, la fila vive solo con
-- el correo. El indice unico (match_id, uid) ya ignora los NULL en Postgres,
-- asi que pueden convivir varias invitaciones pendientes en un mismo partido.

ALTER TABLE match_delegates
  ALTER COLUMN uid DROP NOT NULL;

ALTER TABLE match_delegates
  ADD COLUMN IF NOT EXISTS pending_email VARCHAR(160),
  ADD COLUMN IF NOT EXISTS invited_name VARCHAR(120);

CREATE INDEX IF NOT EXISTS match_delegates_pending_email_idx
  ON match_delegates (lower(pending_email)) WHERE pending_email IS NOT NULL;

-- Una misma invitacion no se duplica en el mismo partido.
CREATE UNIQUE INDEX IF NOT EXISTS match_delegates_match_email_unique
  ON match_delegates (match_id, lower(pending_email)) WHERE pending_email IS NOT NULL;
