-- Valores de multas configurables POR TORNEO.
-- Antes estaban fijos en el codigo (DEFAULT_FINE_AMOUNTS en
-- match-events.service.ts): roja 50000, acumulacion de 3 amarillas 30000.
-- Cada liga cobra distinto, asi que ahora los define el organizador.
--
-- Forma del JSON (todas las claves opcionales; lo que falte usa el default):
--   { "redCard": 50000,
--     "yellowAccumulation": 30000,
--     "yellowsForAccumulation": 3,
--     "redCardMatchesBanned": 1,
--     "yellowAccumulationMatchesBanned": 1 }

ALTER TABLE editions
  ADD COLUMN IF NOT EXISTS fine_defaults JSONB;
