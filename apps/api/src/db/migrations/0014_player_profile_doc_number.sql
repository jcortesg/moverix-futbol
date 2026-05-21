-- Add document number (CC) to player_profiles for player identity linking
ALTER TABLE "player_profiles" ADD COLUMN "doc_number" varchar(40);

-- Unique index so no two profiles can claim the same CC
CREATE UNIQUE INDEX "player_profiles_doc_number_unique" ON "player_profiles" ("doc_number") WHERE "doc_number" IS NOT NULL;
