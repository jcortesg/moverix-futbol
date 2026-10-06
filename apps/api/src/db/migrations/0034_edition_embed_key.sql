-- Clave publica para incrustar las estadisticas del torneo en webs de terceros
-- (widget <script>). Se genera bajo demanda desde el admin y es REVOCABLE:
-- regenerarla invalida los widgets publicados con la clave anterior.
-- No se usa el slug ni el id para poder revocar sin romper la pagina publica.

ALTER TABLE editions
  ADD COLUMN IF NOT EXISTS embed_key VARCHAR(32);

CREATE UNIQUE INDEX IF NOT EXISTS editions_embed_key_unique
  ON editions (embed_key) WHERE embed_key IS NOT NULL;
