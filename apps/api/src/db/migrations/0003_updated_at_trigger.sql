-- Universal updated_at trigger
-- Sets NEW.updated_at = now() on any UPDATE, so services don't have to remember.

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Helper: attach trigger to a table (drops first to be idempotent)
DO $$
DECLARE
  t TEXT;
  targets TEXT[] := ARRAY[
    'bracket_slots',
    'editions',
    'fines',
    'leagues',
    'matches',
    'organizations',
    'payments',
    'player_profiles',
    'player_stats',
    'referees',
    'registrations',
    'teams',
    'venues'
  ];
BEGIN
  FOREACH t IN ARRAY targets LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_updated_at ON %I', t, t);
    EXECUTE format(
      'CREATE TRIGGER trg_%I_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_updated_at()',
      t, t
    );
  END LOOP;
END $$;
