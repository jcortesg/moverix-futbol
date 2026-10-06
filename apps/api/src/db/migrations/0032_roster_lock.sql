-- Cierre de NOMINAS (plantillas), en dos niveles:
--   editions.rosters_locked      -> cierre GENERAL: bloquea todos los equipos
--   registrations.roster_locked  -> cierre por EQUIPO
-- Efectivo = general OR por-equipo. Si el general esta cerrado, ningun equipo
-- puede editar aunque su flag propio este abierto.
--
-- OJO: es distinto de editions.registrations_open, que controla si se pueden
-- INSCRIBIR EQUIPOS NUEVOS. Un torneo puede tener inscripciones cerradas y
-- nominas abiertas (los equipos ya inscritos siguen completando jugadores).

ALTER TABLE editions
  ADD COLUMN IF NOT EXISTS rosters_locked BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE registrations
  ADD COLUMN IF NOT EXISTS roster_locked BOOLEAN NOT NULL DEFAULT false;
