-- Add hidden_on_ios flag to editions: tournaments flagged here are hidden from
-- iOS clients (platform restriction). Controlled manually from the DB.
ALTER TABLE editions ADD COLUMN hidden_on_ios BOOLEAN NOT NULL DEFAULT FALSE;
