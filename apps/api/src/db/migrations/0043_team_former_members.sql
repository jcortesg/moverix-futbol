-- Exjugadores del equipo: quién estuvo en team_members y ya no está.
--
-- Tabla aparte en vez de un "status" en team_members: hay muchas consultas que
-- leen team_members como "miembros actuales" y cambiarle el significado es
-- arriesgado. El API escribe aquí en la misma transacción en que borra la fila
-- de team_members (el delegado lo saca → 'removed', se va él → 'left') y borra
-- la fila cuando la persona vuelve a entrar al equipo.
--
-- Una fila por (equipo, jugador): si se va otra vez se actualizan left_at/reason.

CREATE TABLE IF NOT EXISTS team_former_members (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id     uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  player_uid  varchar(128) NOT NULL,
  player_name varchar(160) NOT NULL,
  role        team_role NOT NULL DEFAULT 'player',
  joined_at   timestamptz,
  left_at     timestamptz NOT NULL DEFAULT now(),
  reason      varchar(10) NOT NULL CHECK (reason IN ('removed', 'left')),
  removed_by  varchar(128)
);

CREATE UNIQUE INDEX IF NOT EXISTS team_former_members_team_player_unique
  ON team_former_members (team_id, player_uid);
CREATE INDEX IF NOT EXISTS team_former_members_player_idx
  ON team_former_members (player_uid);

-- ── Backfill conservador ─────────────────────────────────────────────────────
-- Antes de esta tabla las bajas no dejaban rastro. Se infieren las seguras:
-- cuentas REALES (con player_profiles) que tienen goles/tarjetas, estadísticas
-- o ficha de nómina con el equipo, pero hoy no están en team_members.
--
-- Se excluye a propósito:
--   · uids sin perfil ('manual:', 'manual-', placeholders del panel, cuentas
--     borradas): las fichas manuales nunca entran a team_members, así que todas
--     saldrían como "exjugador" sin serlo.
--   · quien sigue vivo en una nómina del equipo (ficha sin baja en una edición
--     que no ha terminado): está jugando, solo le falta la fila del club.
--   · el delegado principal del equipo.
--
-- left_at = la evidencia más reciente (fin del partido, actualización de la
-- estadística, baja o alta en la nómina); joined_at = la más antigua; nombre =
-- el de la fila más reciente. Idempotente: ON CONFLICT DO NOTHING.
WITH evidence AS (
  SELECT me.team_id, me.player_uid, me.player_name AS name,
         COALESCE(m.finished_at, m.scheduled_at, me.created_at) AS ts
  FROM match_events me
  JOIN matches m ON m.id = me.match_id
  WHERE me.player_uid IS NOT NULL
  UNION ALL
  SELECT ps.team_id, ps.player_uid, ps.player_name, ps.updated_at
  FROM player_stats ps
  UNION ALL
  SELECT r.team_id, rp.player_uid, rp.player_name, COALESCE(rp.removed_at, rp.added_at)
  FROM registration_players rp
  JOIN registrations r ON r.id = rp.registration_id
),
candidates AS (
  SELECT e.team_id, e.player_uid, min(e.ts) AS joined_at, max(e.ts) AS left_at
  FROM evidence e
  JOIN player_profiles pp ON pp.uid = e.player_uid
  JOIN teams t ON t.id = e.team_id
  WHERE e.player_uid IS DISTINCT FROM t.director_uid
    AND NOT EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.team_id = e.team_id AND tm.player_uid = e.player_uid
    )
    AND NOT EXISTS (
      SELECT 1
      FROM registration_players rp2
      JOIN registrations r2 ON r2.id = rp2.registration_id
      JOIN editions ed ON ed.id = r2.edition_id
      WHERE r2.team_id = e.team_id
        AND rp2.player_uid = e.player_uid
        AND rp2.removed_at IS NULL
        AND ed.status <> 'finished'
        AND r2.status NOT IN ('rejected', 'withdrawn')
    )
  GROUP BY e.team_id, e.player_uid
),
names AS (
  SELECT DISTINCT ON (team_id, player_uid) team_id, player_uid, name
  FROM evidence
  WHERE name IS NOT NULL AND btrim(name) <> ''
  ORDER BY team_id, player_uid, ts DESC NULLS LAST
)
INSERT INTO team_former_members (team_id, player_uid, player_name, role, joined_at, left_at, reason)
SELECT c.team_id,
       c.player_uid,
       left(COALESCE(n.name, pp.full_name, 'Jugador'), 160),
       'player',
       c.joined_at,
       COALESCE(c.left_at, now()),
       'removed'
FROM candidates c
JOIN player_profiles pp ON pp.uid = c.player_uid
LEFT JOIN names n ON n.team_id = c.team_id AND n.player_uid = c.player_uid
ON CONFLICT (team_id, player_uid) DO NOTHING;
