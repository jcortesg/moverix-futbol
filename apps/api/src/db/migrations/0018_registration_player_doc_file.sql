-- Documento de identidad adjunto por jugador (cédula u otro).
-- Se guarda la CLAVE de almacenamiento privada (no una URL pública):
-- el archivo solo se sirve por el endpoint autenticado GET /registration-players/:id/document.
ALTER TABLE registration_players ADD COLUMN IF NOT EXISTS doc_file_url text;
