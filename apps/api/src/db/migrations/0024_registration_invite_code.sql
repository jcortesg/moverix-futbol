-- Código de invitación por campeonato (inscripción).
-- El delegado comparte este código; el invitado lo ingresa al unirse y entra
-- directo a la nómina de ESTA inscripción (además de al club).
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS invite_code varchar(16);

CREATE UNIQUE INDEX IF NOT EXISTS registrations_invite_code_unique
  ON registrations (invite_code)
  WHERE invite_code IS NOT NULL;
