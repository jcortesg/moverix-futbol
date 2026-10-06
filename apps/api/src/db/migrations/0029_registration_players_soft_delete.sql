-- Baja logica de jugadores de la plantilla.
-- Motivo: el DELETE fisico destruia los datos de inscripcion (documento, foto,
-- dorsal, EPS) y dejaba los goles del jugador colgando fuera de la plantilla.
-- Incidente 2026-08-19 INTER F.C.: el DT borro su nomina completa dos veces.

ALTER TABLE registration_players
  ADD COLUMN IF NOT EXISTS removed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS removed_by VARCHAR(128);

-- Los indices unicos parciales deben ignorar las filas dadas de baja: si un
-- jugador sale y entra otro con el mismo documento/email, no debe chocar.
DROP INDEX IF EXISTS registration_players_reg_email_unique;
CREATE UNIQUE INDEX IF NOT EXISTS registration_players_reg_email_unique
  ON registration_players (registration_id, email)
  WHERE email IS NOT NULL AND removed_at IS NULL;

DROP INDEX IF EXISTS registration_players_reg_doc_unique;
CREATE UNIQUE INDEX IF NOT EXISTS registration_players_reg_doc_unique
  ON registration_players (registration_id, doc_number)
  WHERE doc_number IS NOT NULL AND removed_at IS NULL;

-- registration_players_reg_uid_unique se mantiene TOTAL (sin filtro): la fila
-- dada de baja debe seguir bloqueando el INSERT para que re-agregar al jugador
-- reviva esa misma fila (ON CONFLICT DO UPDATE) y no cree una duplicada.

CREATE INDEX IF NOT EXISTS registration_players_active_idx
  ON registration_players (registration_id)
  WHERE removed_at IS NULL;
