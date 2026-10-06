-- Delegado de juego por partido + check-in de asistencia de jugadores.
CREATE TABLE IF NOT EXISTS match_delegates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  uid varchar(128) NOT NULL,
  assigned_by_uid varchar(128),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS match_delegates_match_uid_unique ON match_delegates (match_id, uid);
CREATE INDEX IF NOT EXISTS match_delegates_uid_idx ON match_delegates (uid);

CREATE TABLE IF NOT EXISTS match_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  player_uid varchar(128) NOT NULL,
  present boolean NOT NULL DEFAULT false,
  checked_by_uid varchar(128),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS match_attendance_match_player_unique ON match_attendance (match_id, player_uid);
CREATE INDEX IF NOT EXISTS match_attendance_match_idx ON match_attendance (match_id);
