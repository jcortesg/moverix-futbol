# API — NestJS (`@moverix/api`)

NestJS 10 + Drizzle ORM + PostgreSQL + Firebase Admin. Puerto 3001, prefijo `/ftb/v1`.
Producción: Cloud Run `moverix-api-production` → `https://api-ftb.moverix.co/ftb/v1`.
Operación y despliegue: `../../docs/OPERACION.md`. **Responder siempre en español.**

## Estructura
- `src/modules/<dominio>/` — un módulo por dominio: editions, registrations, registration-players,
  teams, matches, matchdays, match-events, match-delegates, referees, fines, payments, standings,
  groups, brackets, player-stats, players, players-admin, venues, leagues, organizations, social, auth.
- `src/modules/mobile/` — endpoints de la **app** (`/mobile/...`): equipos del usuario, nóminas,
  árbitro, partidos, feed, notificaciones, búsqueda, tablas.
- `src/modules/public/` — endpoints **sin login**: páginas públicas de torneos y equipos, unirse con
  código, embeds, legales.
- `src/common/`
  - `guards/firebase-auth.guard.ts` — valida el token de Firebase; `@Public()` lo salta.
  - `services/ownership.service.ts` — **permisos**: verifica que el usuario sea dueño del recurso
    subiendo por la cadena (registro → edición → organización). Usarlo en todo endpoint del admin
    (`verifyRegistration`, `verifyRegistrationReadAccess`, `verifyMatch`, …).
  - `utils/roster-capacity.ts` — tope de jugadores por nómina (`assertRosterCapacity`, `rosterIsFull`).
    Toda alta de jugadores a una nómina debe pasar por aquí.
  - `utils/team-delegates.ts`, `team-former-members.ts`, `cup-logic.ts`, `format-config.ts`.
  - `services/firestore.service.ts` (feed social), `storage.service.ts` (GCS).
- `src/db/schema/` — schema Drizzle (`index.ts` exporta todo). Perfil del jugador = `player_profiles`.

## Base de datos y migraciones
- Las migraciones son SQL en `src/db/migrations/` (numeradas, `0043_…` es la última a nov-2026)
  generadas con `pnpm db:generate`.
- **No corren solas al arrancar** el contenedor: se aplican a mano contra producción
  (`pnpm db:migrate:run` con el `DATABASE_URL` de producción, vía `../../scripts/prod-db.sh` / proxy).
  Aplicar la migración **antes** de desplegar el código que la usa.
- **Ojo:** la carpeta de migraciones está atrasada respecto al schema (`src/db/schema/`): hay
  columnas que existen en el código y en producción pero no en ninguna migración (ej. varias de
  `editions`). Antes de crear una migración nueva, comparar contra producción
  (`\d tabla` con `scripts/prod-db.sh`). La base local se crea con `drizzle-kit push`, no con migraciones.

## Comandos
```bash
pnpm dev                              # nest start --watch
npx tsc --noEmit -p tsconfig.json     # type-check
pnpm test                             # jest (specs junto al código, *.spec.ts)
```

## Reglas de negocio que no hay que romper
- Tope `editions.max_players_per_team` en cada alta (crear, restaurar, lote, delegado, código).
- Multas de tarjetas: crear/editar/borrar una tarjeta en `match-events` mantiene sincronizadas las
  multas pendientes (`handleCardFine` / `dropOrphanCardFines`). Tarifas en `editions.fine_defaults`.
- Rutas fijas antes que `:id` en los controllers (ej. `@Get('delegates')` antes de `@Get(':id')`).
- Mensajes de error al usuario en español claro (salen tal cual en la app y el admin).
