-- Log de cambios: quién cambió qué y cuándo en equipos, miembros e inscripciones.
--
-- Lo llenan triggers, así que queda registro aunque el cambio venga del panel,
-- de la app o de un arreglo manual en la BD. El API identifica al usuario con
-- set_config('app.actor_uid' / 'app.actor_email') en la conexión; si no hay
-- usuario (script, consola SQL) el cambio queda con source = 'manual'.

CREATE TABLE IF NOT EXISTS change_log (
  id          bigserial PRIMARY KEY,
  at          timestamptz NOT NULL DEFAULT now(),
  entity      varchar(30) NOT NULL,          -- team | team_member | registration
  entity_id   uuid NOT NULL,
  team_id     uuid,                          -- para filtrar todo lo de un equipo
  action      varchar(10) NOT NULL,          -- insert | update | delete
  field       varchar(40),                   -- columna cambiada (en update)
  old_value   text,
  new_value   text,
  actor_uid   varchar(128),
  actor_email varchar(160),
  source      varchar(20) NOT NULL           -- api | manual
);

CREATE INDEX IF NOT EXISTS change_log_team_idx ON change_log (team_id, at DESC);
CREATE INDEX IF NOT EXISTS change_log_entity_idx ON change_log (entity, entity_id, at DESC);

CREATE OR REPLACE FUNCTION change_log_write(
  p_entity text, p_entity_id uuid, p_team_id uuid, p_action text,
  p_field text, p_old text, p_new text
) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_uid   text := nullif(current_setting('app.actor_uid', true), '');
  v_email text := nullif(current_setting('app.actor_email', true), '');
BEGIN
  INSERT INTO change_log (entity, entity_id, team_id, action, field, old_value, new_value, actor_uid, actor_email, source)
  VALUES (p_entity, p_entity_id, p_team_id, p_action, p_field, p_old, p_new,
          v_uid, v_email, CASE WHEN v_uid IS NULL THEN 'manual' ELSE 'api' END);
END $$;

-- ── teams: nombre, escudo, delegado, delegado pendiente ──────────────────────
CREATE OR REPLACE FUNCTION change_log_teams() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM change_log_write('team', NEW.id, NEW.id, 'insert', 'name', NULL, NEW.name);
    PERFORM change_log_write('team', NEW.id, NEW.id, 'insert', 'director_uid', NULL, NEW.director_uid);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM change_log_write('team', OLD.id, OLD.id, 'delete', 'name', OLD.name, NULL);
    RETURN OLD;
  END IF;

  IF NEW.name IS DISTINCT FROM OLD.name THEN
    PERFORM change_log_write('team', NEW.id, NEW.id, 'update', 'name', OLD.name, NEW.name);
  END IF;
  IF NEW.short_name IS DISTINCT FROM OLD.short_name THEN
    PERFORM change_log_write('team', NEW.id, NEW.id, 'update', 'short_name', OLD.short_name, NEW.short_name);
  END IF;
  IF NEW.logo_url IS DISTINCT FROM OLD.logo_url THEN
    PERFORM change_log_write('team', NEW.id, NEW.id, 'update', 'logo_url', OLD.logo_url, NEW.logo_url);
  END IF;
  IF NEW.director_uid IS DISTINCT FROM OLD.director_uid THEN
    PERFORM change_log_write('team', NEW.id, NEW.id, 'update', 'director_uid', OLD.director_uid, NEW.director_uid);
  END IF;
  IF NEW.pending_delegate_email IS DISTINCT FROM OLD.pending_delegate_email THEN
    PERFORM change_log_write('team', NEW.id, NEW.id, 'update', 'pending_delegate_email', OLD.pending_delegate_email, NEW.pending_delegate_email);
  END IF;
  IF NEW.access_code IS DISTINCT FROM OLD.access_code THEN
    PERFORM change_log_write('team', NEW.id, NEW.id, 'update', 'access_code', OLD.access_code, NEW.access_code);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_change_log_teams ON teams;
CREATE TRIGGER trg_change_log_teams
  AFTER INSERT OR UPDATE OR DELETE ON teams
  FOR EACH ROW EXECUTE FUNCTION change_log_teams();

-- ── team_members: altas, bajas y cambios de rol (delegados) ─────────────────
CREATE OR REPLACE FUNCTION change_log_team_members() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM change_log_write('team_member', NEW.id, NEW.team_id, 'insert', 'member',
      NULL, NEW.player_uid || ' (' || NEW.player_name || ') ' || NEW.role);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM change_log_write('team_member', OLD.id, OLD.team_id, 'delete', 'member',
      OLD.player_uid || ' (' || OLD.player_name || ') ' || OLD.role, NULL);
    RETURN OLD;
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role THEN
    PERFORM change_log_write('team_member', NEW.id, NEW.team_id, 'update', 'role',
      OLD.player_uid || ' (' || OLD.player_name || ') ' || OLD.role, NEW.role::text);
  END IF;
  IF NEW.team_id IS DISTINCT FROM OLD.team_id THEN
    PERFORM change_log_write('team_member', NEW.id, OLD.team_id, 'update', 'team_id', OLD.team_id::text, NEW.team_id::text);
    PERFORM change_log_write('team_member', NEW.id, NEW.team_id, 'update', 'team_id', OLD.team_id::text, NEW.team_id::text);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_change_log_team_members ON team_members;
CREATE TRIGGER trg_change_log_team_members
  AFTER INSERT OR UPDATE OR DELETE ON team_members
  FOR EACH ROW EXECUTE FUNCTION change_log_team_members();

-- ── registrations: inscripción, grupo, estado, cambio de equipo ─────────────
CREATE OR REPLACE FUNCTION change_log_registrations() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM change_log_write('registration', NEW.id, NEW.team_id, 'insert', 'edition_id', NULL, NEW.edition_id::text);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM change_log_write('registration', OLD.id, OLD.team_id, 'delete', 'edition_id', OLD.edition_id::text, NULL);
    RETURN OLD;
  END IF;

  IF NEW.team_id IS DISTINCT FROM OLD.team_id THEN
    -- Se registra en ambos equipos para que aparezca en el historial de los dos.
    PERFORM change_log_write('registration', NEW.id, OLD.team_id, 'update', 'team_id', OLD.team_id::text, NEW.team_id::text);
    PERFORM change_log_write('registration', NEW.id, NEW.team_id, 'update', 'team_id', OLD.team_id::text, NEW.team_id::text);
  END IF;
  IF NEW.group_id IS DISTINCT FROM OLD.group_id THEN
    PERFORM change_log_write('registration', NEW.id, NEW.team_id, 'update', 'group_id', OLD.group_id::text, NEW.group_id::text);
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM change_log_write('registration', NEW.id, NEW.team_id, 'update', 'status', OLD.status::text, NEW.status::text);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_change_log_registrations ON registrations;
CREATE TRIGGER trg_change_log_registrations
  AFTER INSERT OR UPDATE OR DELETE ON registrations
  FOR EACH ROW EXECUTE FUNCTION change_log_registrations();
