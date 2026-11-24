#!/bin/zsh
# Consola psql contra la base de PRODUCCIÓN (Cloud SQL moverix-db) vía cloud-sql-proxy.
#
#   scripts/prod-db.sh                      # abre psql interactivo
#   scripts/prod-db.sh -c "select 1"        # una consulta
#   scripts/prod-db.sh -1 -f arreglo.sql    # archivo en UNA transacción
#   scripts/prod-db.sh <<'SQL' ... SQL      # heredoc
#
# La contraseña sale de Secret Manager (moverix-db-url); nunca se guarda en disco.
# Si gcloud dice que la sesión expiró: `gcloud auth login` y volver a correr.
set -e
# Puerto propio: el 5433 lo usa un Postgres de Docker de otro proyecto.
PORT=${MOVERIX_DB_PORT:-6543}

if ! pgrep -f "cloud-sql-proxy moverix:us-central1:moverix-db --port $PORT" >/dev/null; then
  if nc -z 127.0.0.1 "$PORT" 2>/dev/null; then echo "El puerto $PORT está ocupado por otro proceso" >&2; exit 1; fi
  LOG=${TMPDIR:-/tmp}/moverix-sql-proxy.log
  cloud-sql-proxy moverix:us-central1:moverix-db --port "$PORT" --gcloud-auth >"$LOG" 2>&1 &
  for _ in {1..30}; do
    grep -q "ready for new connections" "$LOG" 2>/dev/null && break
    sleep 1
  done
  grep -q "ready for new connections" "$LOG" || { echo "El proxy no arrancó, ver $LOG" >&2; exit 1; }
fi

U=$(gcloud secrets versions access latest --secret=moverix-db-url --project moverix)
P=$(echo "$U" | sed -E 's#^postgresql://[^:]+:([^@]+)@.*#\1#')
PGPASSWORD="$P" exec psql -h 127.0.0.1 -p "$PORT" -U moverix_user -d moverix -v ON_ERROR_STOP=1 "$@"
