-- Jugadores vetados por la organización. El veto es de la CUENTA, no de un
-- campeonato: una sanción grave debe seguir a la persona por todos los torneos
-- del organizador, no caducar al abrir la siguiente edición.
--
-- Se identifica por cédula y no por uid porque la mayoría de vetados no tienen
-- cuenta en la app, y porque crearse una cuenta nueva no debe borrar el veto.
CREATE TABLE IF NOT EXISTS player_bans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  doc_number VARCHAR(40) NOT NULL,
  full_name VARCHAR(160) NOT NULL,
  reason TEXT NOT NULL,
  /** NULL = veto indefinido. Con fecha, deja de aplicar después de ese día. */
  until DATE,
  /** Se levanta sin borrar el registro: el historial de sanciones se conserva. */
  lifted_at TIMESTAMPTZ,
  lifted_reason TEXT,
  created_by VARCHAR(128),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Una misma cédula no puede tener dos vetos vigentes en la misma organización.
CREATE UNIQUE INDEX IF NOT EXISTS player_bans_org_doc_active_unique
  ON player_bans (organization_id, doc_number)
  WHERE lifted_at IS NULL;

-- Búsqueda por cédula desde el admin.
CREATE INDEX IF NOT EXISTS player_bans_doc_idx ON player_bans (doc_number);
