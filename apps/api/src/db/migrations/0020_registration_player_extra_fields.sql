-- Campos adicionales del formulario de jugador:
-- foto (archivo privado, como la cédula) y contacto de emergencia.
ALTER TABLE registration_players ADD COLUMN IF NOT EXISTS photo_file_url text;
ALTER TABLE registration_players ADD COLUMN IF NOT EXISTS emergency_contact_name varchar(120);
ALTER TABLE registration_players ADD COLUMN IF NOT EXISTS emergency_contact_phone varchar(40);
