-- Allow payments to reference a specific fine record.

BEGIN;

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS fine_id UUID REFERENCES fines(id) ON DELETE SET NULL;

COMMIT;
