-- "Arbitros" pasa a ser el directorio de PERSONAL del torneo: arbitros y
-- delegados de partido. El organizador los crea una vez (con correo) y luego
-- solo los selecciona en cada partido, sin volver a escribir nada.
--
-- El correo es la llave para vincular la cuenta: cuando esa persona se registre
-- en la app con ese mismo correo, su uid se resuelve y puede entrar a dirigir.

ALTER TABLE referees
  ADD COLUMN IF NOT EXISTS email VARCHAR(160),
  -- referee | delegate | both  (por defecto arbitro, que es lo que habia)
  ADD COLUMN IF NOT EXISTS role VARCHAR(16) NOT NULL DEFAULT 'referee';

CREATE INDEX IF NOT EXISTS referees_email_idx
  ON referees (lower(email)) WHERE email IS NOT NULL;
