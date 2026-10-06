-- El candado por equipo pasa de booleano a TRES estados, para que el
-- organizador pueda abrirle la nomina a UN equipo con el cierre general activo
-- (caso tipico: todo cerrado, pero a un equipo se le autoriza corregir algo).
--
--   NULL  -> hereda el cierre general de la edicion  (por defecto)
--   true  -> cerrado SIEMPRE, aunque el general este abierto
--   false -> ABIERTO SIEMPRE, aunque el general este cerrado (excepcion)
--
-- Efectivo = COALESCE(registrations.roster_locked, editions.rosters_locked)

ALTER TABLE registrations
  ALTER COLUMN roster_locked DROP DEFAULT;

ALTER TABLE registrations
  ALTER COLUMN roster_locked DROP NOT NULL;

-- Las filas existentes son todas `false` por el default anterior, que en el
-- modelo viejo significaba "sin candado propio" = heredar. Se pasan a NULL
-- para no convertirlas por error en excepciones abiertas.
UPDATE registrations SET roster_locked = NULL WHERE roster_locked = false;
