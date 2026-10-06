-- Copa de consolacion: el que PIERDE no queda eliminado, baja a otro cuadro.
--
-- Formato del Desafio Mundial 2026: se juegan 16avos (16 llaves, 32 equipos);
-- el que gana sigue en Copa Oro y el que pierde arranca la Copa Plata. Los 16
-- perdedores forman un cuadro exacto de 16, asi que la Plata empieza en octavos
-- y no necesita byes.
--
-- Hasta ahora bracket_slots solo sabia a donde va el GANADOR (next_slot_id);
-- del perdedor no quedaba rastro. Esta columna es su gemela: dice en que llave
-- de la otra copa entra el que cae. NULL = el perdedor queda eliminado, que es
-- el comportamiento de siempre y el de todas las llaves ya existentes.

ALTER TABLE bracket_slots
  ADD COLUMN IF NOT EXISTS loser_next_slot_id uuid;

-- Sin FK a si misma por la misma razon que next_slot_id: los slots se crean de
-- la final hacia atras y se enlazan sobre la marcha.
CREATE INDEX IF NOT EXISTS bracket_slots_loser_next_slot_idx
  ON bracket_slots (loser_next_slot_id)
  WHERE loser_next_slot_id IS NOT NULL;
