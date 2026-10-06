-- Flag independiente "inscripciones abiertas/cerradas" a nivel torneo, separado del
-- estado deportivo (edition.status). Controla si NUEVOS equipos pueden inscribirse.
ALTER TABLE editions ADD COLUMN registrations_open BOOLEAN NOT NULL DEFAULT true;

-- Backfill preservando el comportamiento actual: hoy se acepta inscripción cuando el
-- torneo está en registration o active; el resto (draft/finished) cerrado.
UPDATE editions SET registrations_open = (status IN ('registration', 'active'));
