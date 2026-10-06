-- Moderacion de contenido de usuarios (comentarios).
-- Los comentarios viven en Firestore (posts/{postId}/comments) para lectura en
-- vivo; en Postgres queda lo que el ORGANIZADOR necesita administrar: bloqueos
-- entre usuarios y la bandeja de reportes.
-- Requisito de App Store 1.2 (UGC): reportar, bloquear y actuar en 24h.

CREATE TABLE IF NOT EXISTS user_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_uid VARCHAR(128) NOT NULL,
  blocked_uid VARCHAR(128) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS user_blocks_pair_unique
  ON user_blocks (blocker_uid, blocked_uid);
CREATE INDEX IF NOT EXISTS user_blocks_blocker_idx ON user_blocks (blocker_uid);

DO $$ BEGIN
  CREATE TYPE report_status AS ENUM ('pending', 'resolved', 'dismissed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS content_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Referencia al comentario en Firestore (no hay FK posible entre motores).
  post_id VARCHAR(128) NOT NULL,
  comment_id VARCHAR(128) NOT NULL,
  -- Copia del texto: si el comentario se borra, el organizador debe poder ver
  -- QUE se reporto para decidir sanciones.
  comment_text TEXT,
  author_uid VARCHAR(128),
  reporter_uid VARCHAR(128) NOT NULL,
  reason VARCHAR(80),
  status report_status NOT NULL DEFAULT 'pending',
  resolved_by VARCHAR(128),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Un usuario no puede reportar dos veces el mismo comentario.
CREATE UNIQUE INDEX IF NOT EXISTS content_reports_unique
  ON content_reports (comment_id, reporter_uid);
CREATE INDEX IF NOT EXISTS content_reports_pending_idx
  ON content_reports (status, created_at DESC);
