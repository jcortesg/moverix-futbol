-- editions: add bracket_state and tiebreaker_rules JSONB columns
ALTER TABLE "editions" ADD COLUMN "bracket_state" jsonb;
ALTER TABLE "editions" ADD COLUMN "tiebreaker_rules" jsonb;
ALTER TABLE "editions" ALTER COLUMN "format_config" SET DEFAULT '{}';

-- groups: add phase (groups|cup) and max_teams, extend name length
ALTER TABLE "groups" ADD COLUMN "phase" varchar(20) NOT NULL DEFAULT 'groups';
ALTER TABLE "groups" ADD COLUMN "max_teams" integer;
ALTER TABLE "groups" ALTER COLUMN "name" TYPE varchar(40);

-- registrations: replace groupCode string with proper FK to groups
ALTER TABLE "registrations" ADD COLUMN "group_id" uuid REFERENCES "groups"("id") ON DELETE SET NULL;
ALTER TABLE "registrations" DROP COLUMN IF EXISTS "group_code";
