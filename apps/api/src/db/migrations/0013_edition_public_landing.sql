-- Add public landing page columns to editions
ALTER TABLE "editions" ADD COLUMN "slug" varchar(100);
ALTER TABLE "editions" ADD COLUMN "is_published" boolean NOT NULL DEFAULT false;
ALTER TABLE "editions" ADD COLUMN "public_description" text;

-- Backfill existing editions with generated slugs
UPDATE "editions" SET
  "slug" = lower(regexp_replace(
    regexp_replace(left("name", 60), '[^a-zA-Z0-9]+', '-', 'gi'),
    '^-|-$', '', 'g'
  )) || '-' || left("id"::text, 8);

-- Enforce NOT NULL and unique
ALTER TABLE "editions" ALTER COLUMN "slug" SET NOT NULL;
CREATE UNIQUE INDEX "editions_slug_unique" ON "editions" ("slug");
