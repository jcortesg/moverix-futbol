#!/bin/zsh
# Entorno local completo: Postgres en Docker (127.0.0.1:5440) + API (3001) + admin (3100).
# Base con datos de PRUEBA (seed), nunca de producción. El 3000 lo ocupa otro proyecto.
#
#   scripts/local-dev.sh          # levanta todo (Ctrl+C para parar API y admin)
#   scripts/local-dev.sh reset    # borra la base local y la vuelve a crear con el seed
#
# Para entrar al admin usa tu cuenta real de Firebase; el seed deja como dueño de las
# organizaciones de prueba el uid de SEED_USER_UID (por defecto el de Jhon).
set -e
ROOT=${0:A:h:h}
DB_URL=postgresql://moverix:moverix_local@127.0.0.1:5440/moverix
SEED_UID=${SEED_USER_UID:-GQtCBQHVfIc3a1wzpqgIL83ILKV2}

if ! docker ps -a --format '{{.Names}}' | grep -qx moverix-db-local; then
  docker run -d --name moverix-db-local -e POSTGRES_USER=moverix -e POSTGRES_PASSWORD=moverix_local \
    -e POSTGRES_DB=moverix -p 127.0.0.1:5440:5432 -v moverix-db-local:/var/lib/postgresql/data \
    --restart unless-stopped postgres:16-alpine >/dev/null
  NEW=1
fi
docker start moverix-db-local >/dev/null
until docker exec moverix-db-local pg_isready -U moverix -q; do sleep 1; done

if [[ "$1" == reset || -n "$NEW" ]]; then
  docker exec moverix-db-local psql -U moverix -d postgres -qc "drop database if exists moverix with (force)" -c "create database moverix"
  (cd "$ROOT/apps/api" && DATABASE_URL=$DB_URL npx drizzle-kit push --force)
  # El seed hace require('dotenv'), que no está instalado: se reemplaza por un módulo vacío.
  STUB=$(mktemp -t nodotenv).js
  echo "const M=require('module'),o=M._load;M._load=function(r,...a){return r==='dotenv'?{config(){}}:o.call(this,r,...a)}" >"$STUB"
  (cd "$ROOT/apps/api" && DATABASE_URL=$DB_URL SEED_USER_UID=$SEED_UID npx ts-node -r "$STUB" -r tsconfig-paths/register src/db/seed.ts)
fi

trap 'kill 0' EXIT
(cd "$ROOT/apps/api" && DATABASE_URL=$DB_URL CORS_ORIGINS=http://localhost:3100 PORT=3001 FIREBASE_PROJECT_ID=moverix pnpm dev) &
(cd "$ROOT/apps/admin" && NEXT_PUBLIC_API_URL=http://localhost:3001/ftb/v1 npx next dev --port 3100) &
echo "API http://localhost:3001/ftb/v1  ·  admin http://localhost:3100"
wait
