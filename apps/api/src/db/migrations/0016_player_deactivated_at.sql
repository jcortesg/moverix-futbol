-- Add deactivated_at column to player_profiles for soft account deactivation
ALTER TABLE player_profiles ADD COLUMN deactivated_at TIMESTAMPTZ DEFAULT NULL;
