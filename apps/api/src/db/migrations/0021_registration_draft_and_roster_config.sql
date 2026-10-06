-- Estado de inscripción "draft": el equipo se inscribe pero aún no tiene
-- una plantilla válida (jugadores + campos requeridos). Pasa a "pending"
-- solo cuando el director envía la inscripción y supera la validación.
ALTER TYPE registration_status ADD VALUE IF NOT EXISTS 'draft' BEFORE 'pending';
--> statement-breakpoint

-- Config de inscripción por edición: el organizador define cuántos jugadores
-- (mín/máx) y qué campos del jugador son obligatorios. Si required_player_fields
-- está vacío, el backend aplica los default (firstName, lastName, docNumber, birthDate).
ALTER TABLE editions ADD COLUMN IF NOT EXISTS min_players_per_team integer;
--> statement-breakpoint
ALTER TABLE editions ADD COLUMN IF NOT EXISTS max_players_per_team integer;
--> statement-breakpoint
ALTER TABLE editions ADD COLUMN IF NOT EXISTS required_player_fields jsonb NOT NULL DEFAULT '[]'::jsonb;
--> statement-breakpoint

-- El código de acceso pasa a ser único en toda la plataforma: con solo ese
-- código se resuelve el equipo al unirse (ya no se pide el ID/slug del equipo).
ALTER TABLE teams ADD CONSTRAINT teams_access_code_unique UNIQUE (access_code);
