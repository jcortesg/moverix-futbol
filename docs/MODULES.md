# Moverix — Documentación de Módulos

Estado del sistema al 2026-05-05. Cubre cada modulo del backoffice (`apps/admin`) y la API (`apps/api`) con su modelo de datos, endpoints, reglas de negocio y estado de implementacion.

> **Base URL dev**: `http://localhost:3001/ftb/v1` (prefix global `ftb`, version `v1`)
> **Swagger**: `http://localhost:3001/ftb/docs`

---

## Índice

1. [Stack y arquitectura](#stack)
2. [Convenciones globales](#convenciones)
3. **Módulos**
   - [Organizations](#organizations)
   - [Auth](#auth)
   - [Leagues](#leagues)
   - [Editions](#editions)
   - [Teams](#teams)
   - [Registrations](#registrations)
   - [Registration-Players (Roster)](#registration-players)
   - [Groups](#groups)
   - [Venues](#venues)
   - [Referees](#referees)
   - [Matchdays](#matchdays)
   - [Matches](#matches)
   - [Match-Events](#match-events)
   - [Standings](#standings)
   - [Payments](#payments)
   - [Fines](#fines)
   - [Brackets](#brackets)
   - [Player-Profiles](#player-profiles) *(parcial)*
   - [Player-Stats](#player-stats)
4. [Sistema de Tenant Activo](#tenant-activo)
5. [Almacenamiento de archivos](#storage)
6. [Migraciones SQL aplicadas](#migrations)

---

<a id="stack"></a>
## 1. Stack y arquitectura

```
Monorepo: pnpm 9 + Turborepo 2

apps/
  api/         NestJS 10 + Drizzle ORM + PostgreSQL + Firebase Admin
  admin/       Next.js 14 (App Router) + Tailwind CSS 3 + Firebase Auth + Axios
  mobile/      Expo 51 + React Native 0.74 (fase 2, scaffold basico)

packages/
  types/       Tipos TypeScript compartidos (@moverix/types)
  tsconfig/    Configs TS base (base, nextjs, react-native)
```

**21 modulos NestJS** registrados en `app.module.ts`. 17 con endpoints completos, 2 stubs, 2 de infraestructura.

**Patrón general por módulo:**

```
apps/api/src/modules/<name>/
  <name>.module.ts              registro NestJS
  <name>.controller.ts          endpoints HTTP
  <name>.service.ts             lógica + Drizzle queries
  dto/
    create-<name>.dto.ts        validación con class-validator
    update-<name>.dto.ts
```

```
apps/admin/src/
  lib/<name>.ts                 cliente axios + tipos
  components/torneos/<X>Manager.tsx  vistas
  app/(dashboard)/<ruta>/page.tsx    rutas Next
```

**Auth global**: `FirebaseAuthGuard` (en `app.module.ts` como `APP_GUARD`) verifica el ID token contra Firebase Admin en todos los endpoints excepto los marcados `@Public()`. El uid del usuario queda en `req.user.uid` y se inyecta via `@Request()`.

**UserAuthMiddleware**: aplicado a todas las rutas. Normaliza headers para proxy de Cloud Run — si existe `X-User-Authorization`, lo copia a `Authorization` antes de que el guard lo procese.

**Throttle global**: 100 requests / 60 segundos (`@nestjs/throttler`).

**Errores estándar Postgres**:
- `23505` — unique constraint violation. Mapeado a `ConflictException` en varios services.
- `23503` — foreign key violation. Manejo por defecto (500 si llega).

**Trigger global de `updated_at`** (migration 0003): cada UPDATE en cualquiera de las 13 tablas con `updated_at` actualiza el timestamp automáticamente vía `set_updated_at()` BEFORE UPDATE trigger.

---

<a id="convenciones"></a>
## 2. Convenciones globales

### IDs
- UUID v4 generado por Postgres (`gen_random_uuid()`). Nunca se usan IDs externos.
- FKs siempre con `ON DELETE` explícito (`cascade` o `set null`).

### Timestamps
- `created_at` y `updated_at` en `timestamptz` con `DEFAULT NOW()`.
- `updated_at` mantenido por trigger (no por código).

### Enums
- Definidos como `pgEnum` en Drizzle. PostgreSQL los crea como tipos nativos.
- Para añadir un valor: `ALTER TYPE foo ADD VALUE IF NOT EXISTS 'nuevo'` (no se pueden quitar valores).

### Soft delete
- No usamos. Todos los `delete` son hard. Para preservar histórico se usa un campo de status (`withdrawn`, `waived`, etc.).

### Naming
- Backend: `camelCase` en TS, `snake_case` en columnas SQL (Drizzle mapea automáticamente).
- Frontend: `camelCase` en TS y JSON.

### Headers en multipart
- **Nunca** setear `Content-Type: multipart/form-data` manualmente en axios — rompe el boundary. Solo pasar `FormData` y axios lo resuelve.

### Resize de imágenes
- `apps/admin/src/lib/image.ts` reduce a 512px (logos) o 1200px (banners) antes de subir. Reencoding JPEG calidad 0.9 (PNG si tiene alpha).

### Validación
- `class-validator` en DTOs con `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true` en `main.ts`.

### Multi-tenant
- Cada org es independiente. Cascada vertical: borrar org → borra leagues → editions → todo lo dependiente.

---

<a id="organizations"></a>
## Organizations

**Propósito**: tenant raíz. Dueño de leagues, teams catálogo, venues, referees.

### Tabla `organizations`

| Columna | Tipo | NOT NULL | Default | Notas |
|---|---|---|---|---|
| `id` | UUID | ✓ | `gen_random_uuid()` | PK |
| `name` | varchar(120) | ✓ | | |
| `slug` | varchar(80) | ✓ | | UNIQUE global |
| `logo_url` | text | | | URL pública (GCS o local /uploads) |
| `city` | varchar(100) | | | |
| `country` | varchar(80) | ✓ | `'CO'` | ISO-2 |
| `owner_uid` | varchar(128) | ✓ | | Firebase UID del creador |
| `active` | boolean | ✓ | true | |
| `created_at`, `updated_at` | timestamptz | ✓ | NOW() | |

### Endpoints

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/organizations` | Crea org. `ownerUid` viene del token. Genera `slug` automático |
| GET | `/organizations` | Lista las orgs del usuario autenticado (filtra por `ownerUid`) |
| GET | `/organizations/:id` | Detalle |
| PATCH | `/organizations/:id` | Actualiza |
| DELETE | `/organizations/:id` | Hard delete (cascade) |
| POST | `/organizations/:id/logo` | Upload logo (max 5MB) |

### DTOs

`CreateOrganizationDto`: `name` (3–120), `city?`, `country?` (default 'CO'), `slug?`

### Estado: ✅ completo

---

<a id="auth"></a>
## Auth

**Propósito**: validar tokens Firebase y exponer perfil del usuario.

- **Modelo**: no tiene tabla propia. Toda la auth vive en Firebase. El `uid` se referencia desde otras tablas como `varchar(128)` (no FK porque Firebase es externo).
- **Guard**: `FirebaseAuthGuard` (global) usa `admin.auth().verifyIdToken(token)`.
- **Decorator**: `@Public()` exime del guard. Solo el `HealthController` lo usa hoy.

### Flujo de creación de cuenta

1. Frontend hace `signInWithEmailAndPassword` o `signInWithPopup(GoogleProvider)` contra Firebase.
2. Firebase devuelve un ID token JWT.
3. Axios interceptor lo añade como `Authorization: Bearer <token>` en cada request.
4. Backend valida y resuelve `uid` + `email` + `name`.

### Endpoints
- `POST /auth/me` — devuelve los claims del usuario actual
- (No hay registro vía API; el registro lo hace Firebase Auth directamente desde el frontend)

### Onboarding inicial
Vista `/onboarding` (Next): asistente para crear `organization` + primera `league` + primera `edition` en 3 pasos. Se dispara cuando el usuario autenticado no tiene ninguna org.

### Estado: ✅ completo

---

<a id="leagues"></a>
## Leagues

**Propósito**: liga persistente dentro de una organización. Una liga puede tener múltiples ediciones (temporadas).

### Tabla `leagues`

| Columna | Tipo | NOT NULL | Default | Notas |
|---|---|---|---|---|
| `id` | UUID | ✓ | gen | |
| `organization_id` | UUID | ✓ | | FK → organizations.id, ON DELETE CASCADE |
| `name` | varchar(120) | ✓ | | |
| `slug` | varchar(80) | ✓ | | UNIQUE compuesto con `organization_id` |
| `sport_format` | enum `sport_format` | ✓ | | F5, F8, F11 |
| `gender` | enum `gender` | ✓ | `'M'` | M, F, Mixed |
| `logo_url` | text | | | |
| `banner_url` | text | | | |
| `description` | text | | | |
| `created_at`, `updated_at` | timestamptz | ✓ | NOW() | |

**Índices**:
- `leagues_org_slug_unique` UNIQUE on `(organization_id, slug)` — el mismo slug puede existir en orgs distintas

### Endpoints

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/leagues` | Crea liga. Pre-check + catch 23505 → 409 |
| GET | `/leagues?organizationId=...` | Lista por org |
| GET | `/leagues/:id` | Detalle |
| PATCH | `/leagues/:id` | Actualiza. Si cambia slug, valida unicidad |
| DELETE | `/leagues/:id` | Cascade |
| POST | `/leagues/:id/logo` | Upload (max 5MB, resize cliente) |
| POST | `/leagues/:id/banner` | Upload (max 5MB) |

### UI
- `TorneosView` lista ligas + sus ediciones con palette colorido
- `LeagueEditDrawer` para crear/editar (drawer lateral)

### Estado: ✅ completo

---

<a id="editions"></a>
## Editions

**Propósito**: temporada concreta de una liga (ej. "2025-I", "Copa Verano"). Contiene la configuración del formato y todos los datos del torneo.

### Tabla `editions`

| Columna | Tipo | NOT NULL | Default | Notas |
|---|---|---|---|---|
| `id` | UUID | ✓ | | |
| `league_id` | UUID | ✓ | | FK → leagues.id, CASCADE |
| `name` | varchar(120) | ✓ | | |
| `season` | varchar(20) | ✓ | | Ej. "2025-I". UNIQUE compuesto con league_id |
| `status` | enum `edition_status` | ✓ | `'draft'` | draft, registration, active, finished |
| `format_config` | jsonb | ✓ | `{}` | Ver estructura abajo |
| `bracket_state` | jsonb | | | Estado serializado del bracket (para snapshots) |
| `tiebreaker_rules` | jsonb | | | Ver estructura abajo |
| `max_teams` | integer | ✓ | 16 | |
| `registration_fee` | integer | ✓ | 0 | En `currency` |
| `prize_pool` | integer | ✓ | 0 | |
| `currency` | varchar(3) | ✓ | `'COP'` | ISO-4217 |
| `logo_url`, `banner_url`, `rules_url` | text | | | |
| `start_date`, `end_date` | timestamptz | | | |
| `created_at`, `updated_at` | timestamptz | ✓ | NOW() | |

**Índices**:
- `editions_league_season_unique` UNIQUE on `(league_id, season)`

### `format_config` JSONB

```ts
{
  type?: 'groups_knockout' | 'groups_multi_cup' | 'round_robin_playoffs' | 'knockout_only' | 'round_robin_only'
  minutesPerHalf?: number
  hasExtraTime?: boolean
  hasPenalties?: boolean
  registrationOpen?: string  // YYYY-MM-DD
  registrationClose?: string
  phase1?: PhaseGroups | PhaseRoundRobin
  phase2?: PhaseKnockout | PhaseMultiCup
}

PhaseGroups       = { kind: 'groups', groupCount, teamsPerGroup, qualifiersPerGroup, doubleLeg }
PhaseRoundRobin   = { kind: 'round_robin', doubleLeg }
PhaseKnockout     = { kind: 'knockout', bracketSize, hasThirdPlace, hasRepechage }
PhaseMultiCup     = { kind: 'multi_cup', cups: [{ name, from, to, size }] }
```

### `tiebreaker_rules` JSONB

```ts
{
  winPts: 3
  drawPts: 1
  lossPts: 0
  allowDraw: boolean
  order: TiebreakerCriterion[]   // ['points', 'goalDiff', 'goalsFor', 'headToHead', 'yellowCards']
}

TiebreakerCriterion =
  'points' | 'goalDiff' | 'goalsFor' | 'goalsAgainst'
  | 'headToHead' | 'yellowCards' | 'redCards' | 'drawLots'
```

### Endpoints

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/editions` | Crea. Valida unicidad de season en la liga |
| GET | `/editions?leagueId=...` | Lista por liga |
| GET | `/editions/:id` | Detalle |
| PATCH | `/editions/:id` | Actualiza |
| DELETE | `/editions/:id` | Cascade |
| POST | `/editions/:id/logo` | Upload |
| POST | `/editions/:id/banner` | Upload |

### Estados (workflow sugerido)

```
draft  →  registration  →  active  →  finished
```

Cambios de estado los hace el admin manualmente en la UI. No hay transiciones automáticas.

### UI
- **Wizard 4 pasos** (`/torneos/edicion/nueva?leagueId=...`): Básico → Equipos → Formato → Resumen
- **Edit por tabs** (`/torneos/edicion/:id`): General · Equipos · Formato · Finanzas · Documentos
- Página **Gestionar** (`/torneos/edicion/:id/gestionar`): tiles + ConfigSummary

### Estado: ✅ completo

---

<a id="teams"></a>
## Teams

**Propósito**: equipo creado por un jugador (DT/delegado). **No pertenece a la organización** — es global. La org solo lo inscribe a ediciones específicas vía `registrations`.

### Tabla `teams`

| Columna | Tipo | NOT NULL | Default | Notas |
|---|---|---|---|---|
| `id` | UUID | ✓ | | |
| `director_uid` | varchar(128) | ✓ | | Firebase UID del DT/owner |
| `name` | varchar(120) | ✓ | | |
| `short_name` | varchar(10) | | | Sigla |
| `logo_url` | text | | | |
| `primary_color` | varchar(7) | | | Hex `#rrggbb` |
| `secondary_color` | varchar(7) | | | |
| `city` | varchar(100) | | | |
| `created_at`, `updated_at` | timestamptz | ✓ | NOW() | |

### Endpoints

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/teams` | Crea. `directorUid` del actor. Soporta `directorEmail` para cederle ownership a otro usuario (resuelve via `admin.auth().getUserByEmail`) |
| GET | `/teams/mine` | Teams donde soy director |
| GET | `/teams/search?q=...` | Búsqueda global por name/shortName (min 2 chars, max 20 resultados) |
| GET | `/teams/:id` | Detalle |
| PATCH | `/teams/:id` | **Solo el director** puede editar |
| DELETE | `/teams/:id` | Solo director |
| POST | `/teams/:id/logo` | Upload — **cualquier admin autenticado** puede subir (regla relajada) |

### Reglas de negocio
- El admin del backoffice puede crear teams por delegación (`directorEmail` apunta a un usuario registrado).
- Si no se pasa email, el creador queda como director.

### UI
- Búsqueda + creación dentro de `EquiposManager` (al inscribir un team a una edición)
- `TeamDetailView` con hero compacto + tabs (Plantilla, Partidos, Pagos, Sanciones, Estadísticas)

### Estado: ✅ completo

---

<a id="registrations"></a>
## Registrations

**Propósito**: relación team ↔ edition. Una registration representa que un team está inscrito en una edición específica, con su estado, asignación de grupo y seeding.

### Tabla `registrations`

| Columna | Tipo | NOT NULL | Default | Notas |
|---|---|---|---|---|
| `id` | UUID | ✓ | | |
| `edition_id` | UUID | ✓ | | FK → editions, CASCADE |
| `team_id` | UUID | ✓ | | FK → teams, CASCADE |
| `group_id` | UUID | | | FK → groups, ON DELETE SET NULL |
| `status` | enum `registration_status` | ✓ | `'pending'` | pending, approved, rejected, withdrawn |
| `registered_by_uid` | varchar(128) | | | Quién creó la inscripción |
| `seed_rank` | integer | | | Para sorteo con cabezas de serie |
| `paid_at` | timestamptz | | | Pago de inscripción confirmado |
| `approved_at` | timestamptz | | | Auto-set al cambiar status a 'approved' |
| `created_at`, `updated_at` | timestamptz | ✓ | NOW() | |

**Índices**:
- `registrations_edition_team_unique` UNIQUE on `(edition_id, team_id)` — un team no puede inscribirse 2 veces a la misma edición

### Endpoints

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/registrations` | Inscribe. Setea `registeredByUid` desde el actor |
| GET | `/registrations?editionId=...` | Lista de la edición + team joineado |
| GET | `/registrations/mine` | Inscripciones de mis teams (donde soy director) |
| GET | `/registrations/:id` | Detalle con team |
| PATCH | `/registrations/:id` | Actualiza status, groupId, seedRank, paidAt |
| DELETE | `/registrations/:id` | Solo director del team o quien la creó |

### UI
- **`EquiposManager`** — tabla con filtros por status, drawer "Inscribir equipo" con 2 modos: buscar existente o crear nuevo
- **Status flow**: pending → approved (botón ✓) o rejected (✗) o withdrawn
- Asignación de grupo: select inline en cada fila

### Estado: ✅ completo

---

<a id="registration-players"></a>
## Registration-Players (Roster)

**Propósito**: plantilla de jugadores de un team **para una edición específica**. Un jugador puede estar en plantillas distintas en torneos distintos.

### Tabla `registration_players`

| Columna | Tipo | NOT NULL | Default | Notas |
|---|---|---|---|---|
| `id` | UUID | ✓ | | |
| `registration_id` | UUID | ✓ | | FK → registrations, CASCADE |
| `player_uid` | varchar(128) | ✓ | | Firebase UID del jugador o `manual:<uuid>` para jugadores no registrados |
| `player_name` | varchar(160) | ✓ | | Snapshot — si el perfil cambia, esto preserva el histórico |
| `first_name` | varchar(80) | | | |
| `last_name` | varchar(80) | | | |
| `doc_number` | varchar(40) | | | Cédula |
| `birth_date` | date | | | |
| `employer` | varchar(120) | | | Empresa donde labora |
| `phone` | varchar(40) | | | |
| `email` | varchar(160) | | | |
| `health_provider` | varchar(80) | | | EPS |
| `jersey_number` | integer | | | Dorsal |
| `position` | enum `player_position` | | | GK, CB, LB, RB, CDM, CM, CAM, LW, RW, CF, ST |
| `is_captain` | boolean | ✓ | false | |
| `added_at` | timestamptz | ✓ | NOW() | |

**Índices** (todos UNIQUE parciales, NULL no cuenta):
- `registration_players_reg_uid_unique` ON `(registration_id, player_uid)`
- `registration_players_reg_email_unique` ON `(registration_id, email)` WHERE email IS NOT NULL
- `registration_players_reg_doc_unique` ON `(registration_id, doc_number)` WHERE doc_number IS NOT NULL

### Endpoints

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/registration-players` | Agrega al roster. 409 si email/cédula duplicado |
| GET | `/registration-players?registrationId=...` | Roster ordenado por dorsal asc |
| GET | `/registration-players/:id` | Detalle |
| PATCH | `/registration-players/:id` | Editar |
| DELETE | `/registration-players/:id` | Quitar de la plantilla |

### Reglas de negocio
- **Capitán único**: la UI desmarca el capitán anterior al asignar uno nuevo. No es constraint DB (sería `UNIQUE WHERE is_captain=true` por registration; está en el roadmap).

### UI
- **`RosterTab`** dentro de `TeamDetailView`. Tabla con: # · Jugador · POS · 🟨 · 🟥 · WO · Multas · Estado · Cap · Acciones
- **`PlayerDetailDrawer`** con tabs: Datos personales / Historial (pronto) / Asistencia (pronto)
- **`RosterImportDialog`**: importa CSV o Excel con preview, auto-mapeo de headers (acentos), validación de duplicados, opción de eliminar inválidos antes de importar

### Estado: ✅ CRUD completo. Las columnas 🟨 🟥 WO Multas en `RosterTab` están hardcoded a 0 (pendiente leerlas de `match_events` y `fines`).

---

<a id="groups"></a>
## Groups

**Propósito**: agrupar equipos dentro de una edición (Grupo A, B, C...). Necesario para fase de grupos y para fase eliminatoria.

### Tabla `groups`

| Columna | Tipo | NOT NULL | Default | Notas |
|---|---|---|---|---|
| `id` | UUID | ✓ | | |
| `edition_id` | UUID | ✓ | | FK → editions, CASCADE |
| `name` | varchar(40) | ✓ | | "Grupo A" |
| `code` | varchar(5) | ✓ | | "A" |
| `phase` | varchar(20) | ✓ | `'groups'` | groups, knockout, etc. |
| `max_teams` | integer | | | Capacidad sugerida |
| `order` | integer | ✓ | 0 | Orden visual |
| `created_at` | timestamptz | ✓ | NOW() | |

### Endpoints

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/groups` | Crea grupo manual |
| POST | `/groups/generate` | Genera grupos automáticos desde `formatConfig.phase1` (Grupo A...Z hasta `groupCount`). Falla si ya hay grupos |
| POST | `/groups/draw` | Distribuye `registrations` aprobadas. `mode='all'` redistribuye todo, `'unassigned'` solo no asignados. Respeta `seedRank` (cabezas de serie van uno por grupo) |
| GET | `/groups?editionId=...` | Lista ordenada por order, code |
| GET | `/groups/:id` | Detalle |
| PATCH | `/groups/:id` | Editar |
| DELETE | `/groups/:id` | Hard delete (los teams asignados quedan con `groupId=null` por SET NULL) |

### Algoritmo `draw`
1. Trae `registrations` aprobadas de la edición
2. Filtra por mode
3. Separa **seeds** (con `seedRank`) y resto
4. Mezcla aleatoriamente el resto
5. Asigna round-robin: seeds primero (uno por grupo en orden de rank), luego el resto cíclicamente

### UI
- **`GruposManager`** — grid de cards de grupo, drawer "Asignar equipos", pool "Sin grupo"
- Botones: "Generar desde formato", "Sortear equipos", "+ Nuevo grupo"

### Estado: ✅ completo

---

<a id="venues"></a>
## Venues

**Propósito**: canchas/sedes donde se juegan partidos. Reusables entre ediciones de la org.

### Tabla `venues`

| Columna | Tipo | NOT NULL | Default | Notas |
|---|---|---|---|---|
| `id` | UUID | ✓ | | |
| `organization_id` | UUID | ✓ | | FK → organizations, CASCADE |
| `name` | varchar(120) | ✓ | | |
| `address` | text | | | |
| `city` | varchar(100) | | | |
| `lat`, `lng` | double precision | | | Para futuro mapa |
| `pitch_count` | integer | ✓ | 1 | Canchas/partidos simultáneos |
| `photo_url` | text | | | |
| `created_at`, `updated_at` | timestamptz | ✓ | NOW() | |

### Endpoints

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/venues` | |
| GET | `/venues?organizationId=...` | Ordenadas por name |
| GET | `/venues/:id` | |
| PATCH | `/venues/:id` | |
| DELETE | `/venues/:id` | Borra foto del storage también |
| POST | `/venues/:id/photo` | Upload (max 5MB) |

### UI
- `/canchas` con grid de cards (foto, nombre, dirección, badge "N canchas")
- Drawer crear/editar con foto + lat/lng colapsable

### Estado: ✅ completo

---

<a id="referees"></a>
## Referees

**Propósito**: catálogo de árbitros de la org. Se asignan a `matches`.

### Tabla `referees`

| Columna | Tipo | NOT NULL | Default | Notas |
|---|---|---|---|---|
| `id` | UUID | ✓ | | |
| `organization_id` | UUID | ✓ | | CASCADE |
| `uid` | varchar(128) | | | Firebase UID si está registrado |
| `full_name` | varchar(120) | ✓ | | |
| `phone` | varchar(20) | | | |
| `photo_url` | text | | | (UI no lo expone aún) |
| `license_number` | varchar(40) | | | |
| `created_at`, `updated_at` | timestamptz | ✓ | NOW() | |

### Endpoints
CRUD completo en `/referees`.

### UI
- `/arbitros` con tabla simple (nombre, licencia, teléfono) + drawer crear/editar

### Estado: ✅ completo. Foto opcional aún no expuesta en UI.

---

<a id="matchdays"></a>
## Matchdays

**Propósito**: jornadas (fechas) de una edición. Agrupan partidos.

### Tabla `matchdays`

| Columna | Tipo | NOT NULL | Default | Notas |
|---|---|---|---|---|
| `id` | UUID | ✓ | | |
| `edition_id` | UUID | ✓ | | CASCADE |
| `number` | integer | ✓ | | Jornada N (1, 2, 3...) |
| `name` | varchar(80) | | | "Jornada 1" auto si no se pasa |
| `phase` | varchar(30) | ✓ | `'groups'` | groups, knockout |
| `scheduled_date` | timestamptz | | | Fecha base de la jornada |
| `created_at` | timestamptz | ✓ | NOW() | |

### Endpoints
CRUD completo en `/matchdays`. `findByEdition` ordena por `number` asc.

### Estado: ✅ completo

---

<a id="matches"></a>
## Matches

**Propósito**: partido individual entre dos equipos.

### Tabla `matches`

| Columna | Tipo | NOT NULL | Default | Notas |
|---|---|---|---|---|
| `id` | UUID | ✓ | | |
| `matchday_id` | UUID | ✓ | | CASCADE |
| `group_id` | UUID | | | SET NULL |
| `home_team_id` | UUID | | | SET NULL |
| `away_team_id` | UUID | | | SET NULL |
| `venue_id` | UUID | | | SET NULL |
| `referee_id` | UUID | | | SET NULL |
| `status` | enum `match_status` | ✓ | `'scheduled'` | scheduled, live, finished, postponed, cancelled, walkover |
| `home_score`, `away_score` | integer | | | |
| `home_penalties`, `away_penalties` | integer | | | |
| `scheduled_at` | timestamptz | | | Fecha+hora exacta |
| `started_at`, `finished_at` | timestamptz | | | Auto-set en finalize |
| `is_neutral` | boolean | ✓ | false | Cancha neutral |
| `round` | varchar(40) | | | "J1", "Cuartos", etc. |
| `created_at`, `updated_at` | timestamptz | ✓ | NOW() | |

### Endpoints

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/matches` | Manual |
| GET | `/matches?editionId=...` | Todos los partidos de la edición (con `matchdayNumber` joineado) |
| GET | `/matches?matchdayId=...` | De una jornada |
| GET | `/matches/:id` | Detalle |
| PATCH | `/matches/:id` | Programar (fecha, cancha, árbitro), cambiar status |
| PATCH | `/matches/:id/finalize` | Setea marcador + status='finished' + finishedAt |
| DELETE | `/matches/:id` | |
| POST | `/matches/generate-fixture` | Genera fixture automático round-robin (Berger) para fase de grupos. `force=true` borra fixture existente |

### Algoritmo Berger (round-robin)
- N teams par: N-1 jornadas, N/2 partidos por jornada
- N impar: agrega "bye" virtual, un team descansa por jornada
- Alterna home/away
- `doubleLeg` duplica las jornadas con local/visitante invertido
- Alinea jornadas entre grupos: J1 de todos los grupos → matchday number=1

### UI
- **`PartidosManager`** — selector de jornadas + lista por grupo + cards de partido
- **`ScheduleDialog`** — drawer con fecha+hora, cancha, árbitro, status
- **`FinalizeDialog`** — modal con 2 inputs grandes para marcador
- **`MatchEventsDrawer`** — drawer de eventos del partido

### Estado: ✅ completo (fase de grupos). Bracket eliminatorio pendiente.

---

<a id="match-events"></a>
## Match-Events

**Propósito**: eventos individuales dentro de un partido (goles, tarjetas, sustituciones, MVP).

### Tabla `match_events`

| Columna | Tipo | NOT NULL | Default | Notas |
|---|---|---|---|---|
| `id` | UUID | ✓ | | |
| `match_id` | UUID | ✓ | | CASCADE |
| `team_id` | UUID | ✓ | | CASCADE |
| `event_type` | enum `event_type` | ✓ | | goal, own_goal, yellow_card, red_card, substitution, penalty_scored, penalty_missed, mvp |
| `minute` | integer | | | 0–200, null para mvp |
| `player_uid` | varchar(128) | | | Snapshot |
| `player_name` | varchar(120) | | | Snapshot — preserva si el roster cambia |
| `assist_player_uid` | varchar(128) | | | Para gol con asistencia o sub (jugador entrante) |
| `assist_player_name` | varchar(120) | | | |
| `created_at` | timestamptz | ✓ | NOW() | |

**Índices**:
- `match_events_one_mvp_per_match` UNIQUE on `(match_id)` WHERE `event_type='mvp'` — un solo MVP por partido

### Endpoints

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/match-events` | Crea evento. **Auto-fines** disparados al crear (ver abajo) |
| GET | `/match-events?matchId=...` | Lista ordenada por minute asc, createdAt asc |
| GET | `/match-events/:id` | |
| PATCH | `/match-events/:id` | |
| DELETE | `/match-events/:id` | |
| POST | `/match-events/mvp` | Upsert del MVP — borra anterior si existe |
| DELETE | `/match-events/mvp/:matchId` | Quita el MVP |

### Auto-fines (lógica en `MatchEventsService.create`)
Best-effort. Errores no rompen la creación del evento.

- **Tarjeta roja** + `playerUid`:
  - Crea fine `concept='red_card'`, `amount=50000`, `sanction='Suspensión 1 partido'`, `matchesBanned=1`
  - Idempotente: chequea (matchId, playerUid, concept) antes de insertar

- **Amarilla** + `playerUid`:
  - Cuenta amarillas del jugador en toda la edición
  - Si llega a múltiplo de 3 (3, 6, 9...) crea fine `concept='yellow_card_accumulation'`, `amount=30000`, `matchesBanned=1`
  - Idempotente

### UI
- **`MatchEventsDrawer`** — drawer con secciones: MVP / Goles / Tarjetas / Sustituciones
- Cada sección tiene form compacto + lista de eventos creados
- Selectores de jugador leen del `registration_players` de cada team

### Estado: ✅ completo. Defaults de auto-fines hardcoded en COP — pendiente leer de `editions.fineDefaults` (no implementado aún).

---

<a id="standings"></a>
## Standings

**Propósito**: tabla de posiciones calculada on-the-fly desde matches finalizados + match_events. **No tiene tabla propia** — siempre se computa.

### Cómputo
1. Trae `editions.tiebreakerRules` (o default)
2. Lee `groups`, `registrations` aprobadas, `matches` con `status='finished'`, `match_events` (yellow/red)
3. Por cada (groupId, teamId) inicializa stats en 0
4. Itera matches finalizados:
   - Suma PJ, GF, GC, DG
   - Suma puntos según `tb.winPts/drawPts/lossPts`
   - Suma yellow/red cards desde events
5. Agrupa por groupId
6. Ordena por `tb.order` aplicando cada criterio:
   - `points`: desc
   - `goalDiff`: desc
   - `goalsFor`: desc
   - `goalsAgainst`: asc
   - `yellowCards`/`redCards`: asc (menos = mejor, fair play)
   - `headToHead`: mini-tabla solo entre los empatados
   - `drawLots`: orden estable

### Endpoints

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/standings?editionId=...` | Tabla por grupo (o única si no hay grupos) |
| GET | `/standings/qualifiers?editionId=...` | Equipos clasificados a la fase eliminatoria con seed asignado |

### Lógica de qualifiers
- **`groups_knockout`**: top `qualifiersPerGroup` de cada grupo. Sembrado por capas (todos los 1° → seeds 1..N, todos los 2° → N+1..2N)
- **`groups_multi_cup`**: distribuye según `cups[].from/to`, seeds dentro de cada copa
- **`round_robin_playoffs`**: top N de la tabla general
- **otros**: vacío con razón

### UI
- **`TablaManager`** — tabs "Grupos" (si hay) y "Reclasificación"
- Tabla con anchos fijos (`table-fixed colgroup`), nombre del equipo al 30%
- Líder con trofeo dorado, clasificados con fondo verde
- Tab Reclasificación: tabla general consolidada cross-grupos + chips por destino

### Estado: ✅ completo

---

<a id="payments"></a>
## Payments

**Propósito**: registro de pagos del torneo (inscripciones, multas).

### Tabla `payments`

| Columna | Tipo | NOT NULL | Default | Notas |
|---|---|---|---|---|
| `id` | UUID | ✓ | | |
| `edition_id` | UUID | ✓ | | CASCADE |
| `team_id` | UUID | ✓ | | CASCADE |
| `registration_id` | UUID | | | SET NULL — para pagos de inscripción |
| `fine_id` | UUID | | | SET NULL — para pagos de multa (auto-creado al `paid`) |
| `type` | enum `payment_type` | ✓ | `'registration'` | registration, fine, other |
| `amount` | integer | ✓ | | En `currency` |
| `currency` | varchar(3) | ✓ | `'COP'` | |
| `status` | enum `payment_status` | ✓ | `'pending'` | pending, verified, rejected |
| `receipt_url` | text | | | URL al comprobante |
| `notes` | text | | | |
| `verified_at` | timestamptz | | | Auto-set al cambiar a 'verified' |
| `verified_by_uid` | varchar(128) | | | Quién verificó |
| `created_at`, `updated_at` | timestamptz | ✓ | NOW() | |

### Endpoints

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/payments` | Crear pago manual |
| GET | `/payments?editionId=...` | Lista con team joineado |
| GET | `/payments?editionId=...&teamId=...` | Pagos de un team |
| GET | `/payments/summary?editionId=...` | Agregados financieros (ver abajo) |
| GET | `/payments/:id` | |
| PATCH | `/payments/:id` | Actualizar status (auto-set verifiedAt+By al verificar) |
| DELETE | `/payments/:id` | |

### Summary endpoint

Devuelve:
```ts
{
  edition: { id, name, season, currency, registrationFee, maxTeams, teamsApproved }
  registrations: {
    expected,        // teamsApproved * registrationFee
    paid,            // sum verified registration payments
    pending,         // expected - paid
    teamsPaid,       // count teams whose total >= fee
    teamsPending
  }
  fines: { issued, paid, pending, waived }
  totals: { income, pending }
}
```

### Reglas de negocio
- Soporta **pagos parciales** de inscripción: el estado del team se calcula como `paid` si la suma de `verified` >= `registrationFee`, `partial` si > 0, `pending` si 0.
- Cuando una `fine` cambia a `paid`, se crea automáticamente un `payment` `type='fine'` `status='verified'` por el monto.

### UI
- **`PagosManager`** — header con balance (4 cards: recaudado / por cobrar / inscripciones / multas) + 3 tabs: Inscripciones / Multas / Movimientos
- Modal "Registrar pago" con monto preset al saldo

### Estado: ✅ completo. Pendiente: subir comprobantes (hoy solo URL).

---

<a id="fines"></a>
## Fines

**Propósito**: multas y sanciones disciplinarias.

### Tabla `fines`

| Columna | Tipo | NOT NULL | Default | Notas |
|---|---|---|---|---|
| `id` | UUID | ✓ | | |
| `edition_id` | UUID | ✓ | | CASCADE |
| `team_id` | UUID | ✓ | | CASCADE |
| `match_id` | UUID | | | SET NULL — partido relacionado (opcional) |
| `player_uid` | varchar(128) | | | Si la multa es individual |
| `player_name` | varchar(120) | | | Snapshot |
| `concept` | enum `fine_concept` | ✓ | `'other'` | yellow_card, yellow_card_accumulation, red_card, walkover, late_arrival, misconduct, team_misconduct, other |
| `reason` | text | ✓ | | Descripción libre |
| `amount` | integer | ✓ | 0 | |
| `currency` | varchar(3) | ✓ | `'COP'` | |
| `status` | enum `fine_status` | ✓ | `'pending'` | pending, paid, waived |
| `sanction` | varchar(80) | | | "Suspensión 1 partido", etc. |
| `matches_banned` | integer | ✓ | 0 | Fechas de suspensión |
| `appealed` | boolean | ✓ | false | |
| `created_at`, `updated_at` | timestamptz | ✓ | NOW() | |

### Endpoints

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/fines` | |
| GET | `/fines?editionId=...` | Con team joineado |
| GET | `/fines/:id` | |
| PATCH | `/fines/:id` | Al pasar a `paid`, se crea automáticamente un `payment` verificado |
| DELETE | `/fines/:id` | |

### UI
- Tab "Multas" en `PagosManager`
- Modal nueva/editar con:
  - Selector de team (de los aprobados)
  - Selector de jugador con toggle "De la plantilla / Manual" (lee `registration_players`)
  - Selector de partido (opcional, filtrado por team)
  - Campos de monto, sanción, fechas suspendido
- Auto-creación de fines desde `MatchEventsService` (ver Match-Events)

### Estado: ✅ completo. Pendiente: defaults configurables en `editions.fineDefaults` (JSONB) para autocompletar `amount` según `concept`.

---

<a id="brackets"></a>
## Brackets

**Propósito**: cuadro eliminatorio. Genera llaves desde los equipos clasificados (standings qualifiers) con sembrado clásico de torneo y avanza ganadores automáticamente al finalizar partidos.

### Tabla `bracket_slots`

| Columna | Tipo | NOT NULL | Default | Notas |
|---|---|---|---|---|
| `id` | UUID | ✓ | | |
| `edition_id` | UUID | ✓ | | CASCADE |
| `cup_name` | varchar(40) | ✓ | `'main'` | Para multi_cup: nombre de la copa |
| `round` | integer | ✓ | | 1=primera ronda, etc. |
| `slot` | integer | ✓ | | Posición dentro de la ronda |
| `match_id` | UUID | | | SET NULL |
| `home_team_id`, `away_team_id` | UUID | | | SET NULL |
| `winner_id` | UUID | | | SET NULL |
| `next_slot_id` | UUID | | | A dónde avanza el ganador |
| `created_at`, `updated_at` | timestamptz | ✓ | NOW() | |

### Endpoints

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/brackets/generate` | Genera bracket desde qualifiers. Body: `{ editionId, cupName? }` |
| GET | `/brackets?editionId=...&cupName=main` | Bracket completo enriquecido (team names, logos, scores) |
| GET | `/brackets/cups?editionId=...` | Lista de cups con bracket para esta edición |
| DELETE | `/brackets/reset?editionId=...&cupName=main` | Elimina bracket + matches asociados |
| POST | `/brackets/:slotId/advance` | Avance manual. Body: `{ winnerId }` |

### Algoritmo de generación (`BracketsService.generate`)
1. Obtiene qualifiers de `StandingsService.getQualifiers(editionId)` filtrados por `destination`
2. Calcula `bracketSize` = siguiente potencia de 2 ≥ qualifiers
3. Genera emparejamientos con **sembrado clásico** (1v16, 8v9, 4v13, 5v12...) — seed 1 y 2 solo se encuentran en la final
4. Crea slots para todas las rondas (vinculados via `nextSlotId`)
5. Asigna teams a primera ronda; slots sin rival = **bye** (auto-avance)
6. Crea matchday `phase='knockout'` y matches para la primera ronda

### Auto-avance (`MatchesService.finalize` hook)
- Al finalizar un partido, detecta si pertenece a un `bracket_slot`
- Determina ganador por score o penaltis
- Llama `BracketsService.advanceWinner(slotId, winnerId)`
- El ganador se coloca en el `nextSlot` (home si slot par, away si impar)
- Si el next slot tiene ambos equipos → se crea match automáticamente
- Envuelto en try/catch (best-effort, no rompe la finalización)

### Soporta multi-cup
- `cupName='main'` para el bracket principal
- Para `groups_multi_cup`, cada copa se genera con su propio `cupName`
- UI muestra tabs para navegar entre copas

### UI
- **`BracketManager`** — vista horizontal ronda por ronda con SlotCards
- Ruta: `/torneos/edicion/[id]/gestionar/bracket`
- Botón "Generar llaves" (si no hay bracket) / "Resetear" (si ya existe)
- Labels de ronda: Octavos → Cuartos → Semifinales → Final

### Estado: ✅ completo (backend + frontend + auto-avance)

---

<a id="player-profiles"></a>
## Player-Profiles

**Propósito**: perfil global del jugador (cross-tournament). Para la app móvil futura.

### Tabla `player_profiles`

| Columna | Tipo | NOT NULL | Default | Notas |
|---|---|---|---|---|
| `id` | UUID | ✓ | | |
| `uid` | varchar(128) | ✓ | | UNIQUE — Firebase UID |
| `username` | varchar(40) | ✓ | | UNIQUE |
| `full_name` | varchar(120) | ✓ | | |
| `avatar_url` | text | | | |
| `bio` | text | | | |
| `city` | varchar(100) | | | |
| `country` | varchar(80) | ✓ | `'CO'` | |
| `position` | enum `player_position` | | | |
| `preferred_foot` | varchar(5) | | | |
| `birth_year` | integer | | | |
| `followers_count`, `following_count` | integer | ✓ | 0 | |
| `created_at`, `updated_at` | timestamptz | ✓ | NOW() | |

### Tabla `follows`

| Columna | Tipo | Notas |
|---|---|---|
| `id`, `follower_uid`, `followed_uid`, `created_at` | | Sin constraint de unicidad aún |

### Estado: 🚧 schema listo, módulo backend vacío. Diseñado para fase 2 (app móvil con red social).

---

<a id="player-stats"></a>
## Player-Stats

**Propósito**: stats agregados de un jugador por edición. Caché materializada de match_events, recomputada automáticamente.

### Tabla `player_stats`

| Columna | Tipo | NOT NULL | Default | Notas |
|---|---|---|---|---|
| `id` | UUID | ✓ | | |
| `edition_id` | UUID | ✓ | | CASCADE |
| `team_id` | UUID | ✓ | | CASCADE — un jugador puede cambiar de team entre temporadas |
| `player_uid` | varchar(128) | ✓ | | |
| `player_name` | varchar(120) | ✓ | | Snapshot |
| `matches_played`, `goals`, `assists`, `yellow_cards`, `red_cards`, `minutes_played` | integer | ✓ | 0 | |
| `updated_at` | timestamptz | ✓ | NOW() | |

### Endpoints

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/player-stats?editionId=...` | Stats de todos los jugadores de la edición (ordenados por goles desc) |
| GET | `/player-stats?editionId=...&teamId=...` | Stats de un equipo específico |
| GET | `/player-stats/top-scorers?editionId=...&limit=10` | Tabla de goleadores |
| POST | `/player-stats/recompute?editionId=...` | Recomputar manualmente todas las stats de la edición |

### Lógica de recomputación

- **`recomputeMatch(matchId)`**: recalcula stats de ambos equipos del partido. Llamado desde:
  - `MatchesService.finalize()` (al finalizar un partido)
  - `MatchEventsService.create/update/remove()` (al cambiar eventos)
- **`recomputeAll(editionId)`**: recalcula toda la edición desde cero (endpoint manual)
- Agrega: goals (goal + penalty_scored), assists (assistPlayerUid), yellowCards, redCards, matchesPlayed (matches donde el jugador tuvo eventos)
- Delete + re-insert por team+edition (idempotente)
- Best-effort: errores no rompen la operación principal

### UI

- `RosterTab` ahora recibe `editionId` + `teamId` y muestra tarjetas reales desde `player_stats`
- Frontend client: `lib/player-stats.ts`

### Estado: ✅ completo

---

<a id="tenant-activo"></a>
## Sistema de Tenant Activo

**Propósito**: que el sidebar y las páginas del sidebar respeten una "edición activa" elegida por el usuario.

### Componentes
- `apps/admin/src/contexts/ActiveEditionContext.tsx` — provider con `localStorage` persistido
- Tipo `ActiveEdition`: `{ id, name, season, leagueId, leagueName, logoUrl, bannerUrl }`
- Storage key: `moverix:activeEdition`
- Sincronización entre tabs vía evento `storage`

### Cómo se setea
- Click en "Gestionar" desde `TorneosView` o desde `EditionCard`
- Auto-set al abrir `/torneos/edicion/:id/gestionar` directo
- Selector en el `Header` superior con dropdown agrupado por liga

### Cómo se usa
- Sidebar muestra sección "Torneo activo" (Dashboard, Equipos, Partidos, Grupos y Llaves, Tabla, Pagos) **solo cuando hay tenant**
- Componente `ActiveEditionRequired` envuelve las rutas del sidebar y muestra empty state si no hay tenant
- Header superior muestra "Liga + Temporada" del torneo activo

---

<a id="storage"></a>
## Storage

**Servicio**: `StorageService` (`apps/api/src/common/services/storage.service.ts`)

### Modos
- **Local (dev)**: si `NODE_ENV !== 'production'` y no hay `GOOGLE_APPLICATION_CREDENTIALS`. Guarda en `/uploads/<entityPath>/<filename>` y sirve estáticamente desde `app.useStaticAssets`.
- **GCS (prod)**: usa `@google-cloud/storage` con bucket `process.env.GCS_BUCKET ?? 'moverix-assets'`. Files públicos.

### Patrón de upload
- Multer con `memoryStorage()` (buffer en RAM)
- Límite por endpoint configurable (5MB para logos, 5MB banners)
- Cliente resize **antes** de subir (`apps/admin/src/lib/image.ts`):
  - Logos: max 512px
  - Banners: max 1200px
- `Content-Type` lo setea axios automático para `FormData` — **nunca manual**.

### Archivos manejados
- `organizations/<id>/logo.<ext>`
- `leagues/<id>/{logo|banner}.<ext>`
- `editions/<id>/{logo|banner}.<ext>`
- `teams/<id>/logo.<ext>`
- `venues/<id>/logo.<ext>`

---

<a id="migrations"></a>
## Migraciones SQL aplicadas

| # | Archivo | Resumen |
|---|---|---|
| 0000 | `0000_graceful_killer_shrike.sql` | Schema inicial (todas las tablas base) |
| 0001 | `0001_add_banner_and_edition_media.sql` | Banner/logo a leagues, editions, teams |
| 0002 | `0002_format_config_redesign.sql` | Refactor de format_config en editions |
| 0003 | `0003_updated_at_trigger.sql` | Trigger global `set_updated_at()` en 13 tablas |
| 0004 | `0004_teams_player_owned.sql` | Teams quitan `organizationId`, exigen `directorUid`. Registrations gana `registeredByUid` + `seedRank`. Nueva tabla `registration_players` |
| 0005 | `0005_registration_player_fields.sql` | Roster gana firstName, lastName, docNumber, birthDate, employer, phone, email, healthProvider |
| 0006 | `0006_roster_unique_email_doc.sql` | Unique parcial de email/doc en roster |
| 0007 | `0007_venue_pitch_count.sql` | `venues.pitchCount` |
| 0008 | `0008_payments_fine_id.sql` | `payments.fineId` |
| 0009 | `0009_match_events_mvp.sql` | `event_type` + 'mvp', unique parcial uno-por-partido |
| 0010 | `0010_fines_concept.sql` | `fine_concept` enum + columna |

### Defaults via Drizzle (sin SQL):
- `editions.tiebreakerRules` JSONB nullable
- `editions.format_config` JSONB default `{}`
- `groups.maxTeams` nullable
- `registrations.seed_rank` nullable

### Constraints únicos
- `organizations.slug` UNIQUE
- `leagues (organization_id, slug)` UNIQUE
- `editions (league_id, season)` UNIQUE
- `registrations (edition_id, team_id)` UNIQUE
- `registration_players (registration_id, player_uid)` UNIQUE
- `registration_players (registration_id, email)` UNIQUE WHERE email NOT NULL (parcial)
- `registration_players (registration_id, doc_number)` UNIQUE WHERE doc_number NOT NULL (parcial)
- `match_events (match_id)` UNIQUE WHERE event_type='mvp' (parcial)

---

## Estado global (actualizado 2026-05-05)

### ✅ Completos (17 modulos con endpoints)
- Auth (guard global), Organizations, Leagues, Editions
- Teams, Registrations, Roster (con import Excel/CSV)
- Groups (auto-generacion + sorteo con seeds)
- Venues, Referees
- Matchdays, Matches (con generacion Berger), Match-Events (con auto-fines)
- Standings (con tarjetas reales desde match_events)
- Payments (con summary), Fines (con auto-payment)
- **Brackets** (generacion con seeding clasico + auto-avance + UI visual)
- **Player-Stats** (recomputacion automatica + goleadores + RosterTab conectado)
- Tenant activo en sidebar + Header selector
- Onboarding wizard (org + liga + edicion)
- Docker multi-stage para admin y API

### 🚧 Parciales
- Player-Profiles: schema si, modulo vacio (stub)
- `editions.fineDefaults`: pendiente para configurar montos de auto-fines por edicion
- Socket.io: instalado y configurado, canales no implementados
- @Roles() decorator: definido, sin RolesGuard que lo enforce
- Dependencias frontend sin usar: zustand, react-query, tanstack-table, recharts, dnd-kit

### ⏳ Pendientes
- **Match Fees** (cuotas de cancha/arbitraje por partido) — modelo planeado, no implementado
- **Reportes `/reportes`** — vacio
- **Config `/config`** — vacio
- **Subida de comprobantes** en pagos (hoy solo URL)
- **Validacion de cancha** al programar (no mas partidos simultaneos que `pitchCount`)
- **Programador masivo** de jornada
- **RBAC real** — multi-usuario por organizacion con roles
- **App movil** — scaffold basico, sin pantallas reales
- **Tiempo real** — marcadores EN VIVO via Socket.io
- **Exportacion PDF/Excel** — fixture, llaves, reportes
