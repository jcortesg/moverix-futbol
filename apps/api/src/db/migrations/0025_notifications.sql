-- Notificaciones in-app + tokens de push (Expo).
DO $$ BEGIN
  CREATE TYPE notification_type AS ENUM ('match','result','team','edition','social','system');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_uid varchar(128) NOT NULL,
  type notification_type NOT NULL,
  title varchar(140) NOT NULL,
  body varchar(300) NOT NULL,
  data jsonb,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notifications_recipient_idx ON notifications (recipient_uid, created_at);

CREATE TABLE IF NOT EXISTS push_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  uid varchar(128) NOT NULL,
  token varchar(200) NOT NULL,
  platform varchar(10),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS push_tokens_token_unique ON push_tokens (token);
CREATE INDEX IF NOT EXISTS push_tokens_uid_idx ON push_tokens (uid);
