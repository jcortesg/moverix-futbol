-- Opción A + C de la nómina: además del enlace general del torneo, el delegado
-- puede agregar jugadores con nombre y celular (ficha "manual:" sin cuenta) y
-- cada uno recibe un código/enlace PERSONAL. Al ingresarlo en la app, la ficha
-- se liga a su cuenta. Mismo formato de 7 caracteres que los demás códigos.

ALTER TABLE registration_players
  ADD COLUMN IF NOT EXISTS invite_code varchar(8),
  ADD COLUMN IF NOT EXISTS claimed_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS registration_players_invite_code_unique
  ON registration_players (invite_code)
  WHERE invite_code IS NOT NULL;
