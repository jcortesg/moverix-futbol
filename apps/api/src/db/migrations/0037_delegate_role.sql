-- Terna arbitral: varias personas por partido, cada una con su puesto.
--   referee_1  arbitro central
--   referee_2  asistente 1
--   referee_3  asistente 2
--   fourth     cuarto arbitro
--   delegate   delegado de partido (valor por defecto: es lo que habia antes)
-- Todos los asignados pueden registrar la planilla; el puesto es informativo
-- y sirve para la planilla impresa y para saber quien dirigio.

ALTER TABLE match_delegates
  ADD COLUMN IF NOT EXISTS role VARCHAR(16) NOT NULL DEFAULT 'delegate';

-- Un mismo puesto no se asigna dos veces en el mismo partido.
CREATE UNIQUE INDEX IF NOT EXISTS match_delegates_match_role_unique
  ON match_delegates (match_id, role) WHERE role <> 'delegate';
