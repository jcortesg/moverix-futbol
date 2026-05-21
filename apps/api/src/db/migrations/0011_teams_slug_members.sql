-- Teams: add slug and access_code columns
ALTER TABLE "teams" ADD COLUMN "slug" varchar(30);
ALTER TABLE "teams" ADD COLUMN "access_code" varchar(8);

-- Backfill existing teams with generated slugs and codes
UPDATE "teams" SET
  "slug" = lower(regexp_replace(left("name", 18), '[^a-z0-9]+', '_', 'gi')) || '_' || substr(md5(random()::text), 1, 6),
  "access_code" = upper(substr(md5(random()::text), 1, 6));

-- Now enforce NOT NULL and unique
ALTER TABLE "teams" ALTER COLUMN "slug" SET NOT NULL;
ALTER TABLE "teams" ALTER COLUMN "access_code" SET NOT NULL;
CREATE UNIQUE INDEX "teams_slug_unique" ON "teams" ("slug");

-- Team members table
CREATE TYPE "team_role" AS ENUM ('director', 'player');

CREATE TABLE "team_members" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "team_id" uuid NOT NULL REFERENCES "teams"("id") ON DELETE CASCADE,
  "player_uid" varchar(128) NOT NULL,
  "player_name" varchar(160) NOT NULL,
  "role" "team_role" NOT NULL DEFAULT 'player',
  "joined_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX "team_members_team_player_unique" ON "team_members" ("team_id", "player_uid");

-- Auto-add existing directors as members
INSERT INTO "team_members" ("team_id", "player_uid", "player_name", "role")
SELECT t."id", t."director_uid", COALESCE(pp."full_name", 'Director'), 'director'
FROM "teams" t
LEFT JOIN "player_profiles" pp ON pp."uid" = t."director_uid"
ON CONFLICT DO NOTHING;
