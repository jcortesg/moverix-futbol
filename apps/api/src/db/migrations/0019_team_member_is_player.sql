-- Rol dual: el delegado (director) puede ser también jugador.
-- Cambio aditivo para no romper el enum `team_role` ni el índice único
-- (team_id, player_uid) que consume la app móvil.
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS is_player boolean NOT NULL DEFAULT false;

-- Backfill: los miembros con rol 'player' ya juegan.
UPDATE team_members SET is_player = true WHERE role = 'player';
