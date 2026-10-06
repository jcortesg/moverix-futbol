-- Redes sociales en el perfil del jugador (solo handle/usuario).
ALTER TABLE player_profiles ADD COLUMN IF NOT EXISTS instagram varchar(40);
ALTER TABLE player_profiles ADD COLUMN IF NOT EXISTS tiktok varchar(40);
ALTER TABLE player_profiles ADD COLUMN IF NOT EXISTS facebook varchar(80);
ALTER TABLE player_profiles ADD COLUMN IF NOT EXISTS twitter varchar(40);
