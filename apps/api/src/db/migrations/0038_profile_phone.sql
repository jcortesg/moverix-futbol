-- Telefono en el perfil del jugador. Se pide en el registro para no tener que
-- perseguirlo despues: hoy es uno de los campos que mas falta en las nominas
-- (los required_player_fields de cada torneo lo exigen).
ALTER TABLE player_profiles
  ADD COLUMN IF NOT EXISTS phone VARCHAR(40);
