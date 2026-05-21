# Moverix — Stack Tecnologico y Arquitectura

## Monorepo

- **Package manager**: pnpm 9.0.0
- **Build system**: Turborepo 2
- **Workspaces**: `apps/*` + `packages/*`

```
moverix futbol/
├── apps/
│   ├── admin/       Next.js 14 (App Router) — port 3000
│   ├── api/         NestJS 10 — port 3001
│   └── mobile/      Expo 51 + React Native 0.74
├── packages/
│   ├── types/       Tipos TypeScript compartidos (@moverix/types)
│   └── tsconfig/    Configs TS compartidas (base, nextjs, react-native)
├── turbo.json
├── pnpm-workspace.yaml
└── package.json
```

---

## Frontend Admin (Backoffice)

### Framework y core
- **Next.js 14** (App Router) + TypeScript
- **Tailwind CSS 3** + `clsx` + `tailwind-merge`
- **Lucide React** — iconos

### Datos y formularios
- **Axios** — HTTP client con interceptor de Firebase ID token
- **React Hook Form** + **Zod** — formularios con validacion
- **date-fns** — utilidades de fecha
- **xlsx** — importacion de plantillas Excel/CSV

### Auth
- **Firebase Auth** (client SDK) — email + Google provider
- Token JWT inyectado automaticamente via axios interceptor
- Cookie `moverix-auth` para middleware Next.js

### Estado
- **React Context** (2 providers):
  - `AuthContext` — usuario Firebase + token
  - `ActiveEditionContext` — edicion activa (localStorage + sync entre tabs)
- **Estado local** (`useState`) en componentes
- Sin store global (Zustand instalado pero no usado)

### Dependencias instaladas pero NO usadas aun
Reservadas para fases futuras:
- `zustand` — estado global (cuando crezca la complejidad)
- `@tanstack/react-query` — cache de server state
- `@tanstack/react-table` — tablas avanzadas con sorting/filtros
- `recharts` — graficas para Dashboard y Reportes
- `@dnd-kit/core` + `@dnd-kit/sortable` — drag & drop para grupos

---

## Backend API

### Framework
- **NestJS 10** + TypeScript
- Patron modular: cada dominio tiene `module.ts`, `controller.ts`, `service.ts`, `dto/`

### Base de datos
- **PostgreSQL** via **Drizzle ORM** (`drizzle-orm` + `pg`)
- Schema definido en `apps/api/src/db/schema/` (18 archivos)
- Migraciones SQL en `apps/api/src/db/migrations/` (11 migraciones aplicadas)
- UUIDs generados por Postgres (`gen_random_uuid()`)
- Trigger global `set_updated_at()` en 13 tablas

### Auth y seguridad
- **Firebase Admin SDK** — verifica ID tokens
- `FirebaseAuthGuard` registrado como `APP_GUARD` global
- Decorator `@Public()` para endpoints sin auth (health, uploads)
- Decorator `@Roles()` definido pero sin enforcement aun (RBAC pendiente)
- `UserAuthMiddleware` — normaliza headers para proxy de Cloud Run
- **Throttler**: 100 requests / 60 segundos

### API config
- Prefix global: `ftb`
- Versionado URI: v1
- Base URL: `http://localhost:3001/ftb/v1`
- Swagger: `http://localhost:3001/ftb/docs`
- CORS: configurable via `CORS_ORIGINS`

### Storage
- **Dev**: archivos locales en `/uploads/`, servidos como static assets
- **Prod**: Google Cloud Storage (bucket `moverix-assets`)
- Logos resize a 512px, banners a 1200px (cliente antes de subir)
- `UploadsController` sirve archivos GCS como proxy con cache headers

### Otras dependencias
- `@nestjs/swagger` — documentacion OpenAPI
- `@nestjs/terminus` — health checks
- `@nestjs/throttler` — rate limiting
- `socket.io` + `@nestjs/websockets` — real-time (instalado, por implementar)
- `multer` — file uploads (memory storage)

### Validacion
- `class-validator` + `class-transformer`
- `whitelist: true` — descarta props desconocidas
- `forbidNonWhitelisted: true` — error si llegan props invalidas
- `transform: true` — auto-cast de tipos

---

## App Movil (Fase 2)

- **Expo 51** + **React Native 0.74**
- **Expo Router** — navegacion file-based (tabs)
- Firebase Auth (misma config que admin)
- Axios + React Query + Zustand (instalados, scaffold basico)
- Pendiente de desarrollo real

---

## Modulos del API (20)

### Completos (con controller + service + dto)
Organizations, Leagues, Editions, Teams, Registrations, Registration-Players, Groups, Matchdays, Matches, Match-Events, Standings, Payments, Fines, Venues, Referees

### Stubs (solo module.ts)
Auth (auth vive en el guard global), Brackets, Players

### Infraestructura
Health (check publico), Uploads (proxy GCS)

---

## Arquitectura de Datos (PostgreSQL)

### Tablas (18)

```sql
-- Tenant raiz
organizations (id, name, slug, logo_url, owner_uid, city, country, active)

-- Estructura deportiva
leagues (id, organization_id, name, slug, sport_format, gender, logo_url, banner_url)
editions (id, league_id, name, season, status, format_config, bracket_state, tiebreaker_rules,
          max_teams, registration_fee, prize_pool, currency, logo_url, banner_url, rules_url)

-- Equipos y jugadores
teams (id, director_uid, name, short_name, logo_url, primary_color, secondary_color, city)
registrations (id, edition_id, team_id, group_id, status, registered_by_uid, seed_rank, paid_at, approved_at)
registration_players (id, registration_id, player_uid, player_name, first_name, last_name,
                      doc_number, birth_date, employer, phone, email, health_provider,
                      jersey_number, position, is_captain)

-- Grupos
groups (id, edition_id, name, code, phase, max_teams, order)

-- Partidos
matchdays (id, edition_id, number, name, phase, scheduled_date)
matches (id, matchday_id, group_id, home_team_id, away_team_id, venue_id, referee_id,
         status, home_score, away_score, home_penalties, away_penalties,
         scheduled_at, started_at, finished_at, is_neutral, round)
match_events (id, match_id, team_id, event_type, minute, player_uid, player_name,
              assist_player_uid, assist_player_name)
bracket_slots (id, edition_id, cup_name, round, slot, match_id,
               home_team_id, away_team_id, winner_id, next_slot_id)

-- Sedes y arbitros
venues (id, organization_id, name, address, city, lat, lng, pitch_count, photo_url)
referees (id, organization_id, uid, full_name, phone, photo_url, license_number)

-- Finanzas
payments (id, edition_id, team_id, registration_id, fine_id, type, amount, currency,
          status, receipt_url, notes, verified_at, verified_by_uid)
fines (id, edition_id, team_id, match_id, player_uid, player_name, concept, reason,
       amount, currency, status, sanction, matches_banned, appealed)

-- Jugadores (fase 2)
player_profiles (id, uid, username, full_name, avatar_url, bio, city, country,
                 position, preferred_foot, birth_year, followers_count, following_count)
follows (id, follower_uid, followed_uid)
player_stats (id, edition_id, team_id, player_uid, player_name,
              matches_played, goals, assists, yellow_cards, red_cards, minutes_played)
```

### Enums PostgreSQL
- `sport_format`: F5, F8, F11
- `gender`: M, F, Mixed
- `edition_status`: draft, registration, active, finished
- `registration_status`: pending, approved, rejected, withdrawn
- `match_status`: scheduled, live, finished, postponed, cancelled, walkover
- `event_type`: goal, own_goal, yellow_card, red_card, substitution, penalty_scored, penalty_missed, mvp
- `payment_type`: registration, fine, other
- `payment_status`: pending, verified, rejected
- `fine_status`: pending, paid, waived
- `fine_concept`: yellow_card, yellow_card_accumulation, red_card, walkover, late_arrival, misconduct, team_misconduct, other
- `player_position`: GK, CB, LB, RB, CDM, CM, CAM, LW, RW, CF, ST

### Constraints unicos
- `organizations.slug` UNIQUE
- `leagues (organization_id, slug)` UNIQUE
- `editions (league_id, season)` UNIQUE
- `registrations (edition_id, team_id)` UNIQUE
- `registration_players (registration_id, player_uid)` UNIQUE
- `registration_players (registration_id, email)` UNIQUE parcial (WHERE email NOT NULL)
- `registration_players (registration_id, doc_number)` UNIQUE parcial (WHERE doc_number NOT NULL)
- `match_events (match_id)` UNIQUE parcial (WHERE event_type='mvp')

### Trigger global
`set_updated_at()` — BEFORE UPDATE en 13 tablas actualiza `updated_at = NOW()` automaticamente.

---

## Estructura del Proyecto Admin (Next.js)

```
apps/admin/src/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   ├── registro/page.tsx
│   │   └── layout.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx              → sidebar + header + auth guard
│   │   ├── page.tsx                → dashboard (vacio)
│   │   ├── equipos/page.tsx
│   │   ├── partidos/page.tsx
│   │   ├── grupos-llaves/page.tsx
│   │   ├── tabla/page.tsx
│   │   ├── pagos/page.tsx
│   │   ├── canchas/page.tsx
│   │   ├── arbitros/page.tsx
│   │   ├── reportes/page.tsx       → vacio
│   │   ├── config/page.tsx         → vacio
│   │   └── torneos/
│   │       ├── page.tsx
│   │       └── edicion/
│   │           ├── nueva/page.tsx
│   │           └── [id]/
│   │               ├── page.tsx
│   │               └── gestionar/
│   │                   ├── page.tsx
│   │                   ├── equipos/
│   │                   │   ├── page.tsx
│   │                   │   └── [regId]/page.tsx
│   │                   ├── grupos/page.tsx
│   │                   ├── partidos/page.tsx
│   │                   ├── tabla/page.tsx
│   │                   └── pagos/page.tsx
│   ├── onboarding/
│   │   ├── page.tsx
│   │   └── layout.tsx
│   ├── layout.tsx
│   └── globals.css
├── components/
│   ├── ui/form.tsx                 → Field, SectionCard, Toggle, inputCls
│   ├── auth/                       → AuthGuard, LoginForm, RegisterForm
│   ├── layout/                     → Sidebar, Header
│   ├── torneos/                    → 17 componentes de gestion deportiva
│   ├── arbitros/RefereesManager.tsx
│   └── canchas/VenuesManager.tsx
├── contexts/
│   ├── AuthContext.tsx
│   └── ActiveEditionContext.tsx
├── lib/                            → 20 archivos (API clients + utilidades)
│   ├── api.ts                      → Axios instance + Firebase interceptor
│   ├── firebase.ts                 → Firebase init
│   ├── auth.ts                     → Auth helpers
│   ├── leagues.ts                  → Leagues/Editions API + tipos
│   ├── teams.ts, matches.ts, ...   → API clients por dominio
│   ├── image.ts                    → Resize antes de upload
│   ├── csv.ts                      → Parser CSV RFC 4180
│   └── slug.ts                     → Generador de slugs
└── middleware.ts                    → Auth redirect (cookie-based)
```

## Estructura del Proyecto API (NestJS)

```
apps/api/src/
├── main.ts                          → Bootstrap, Firebase init, Swagger, CORS
├── app.module.ts                    → 20 modules, global guard + throttle
├── health.controller.ts
├── common/
│   ├── guards/firebase-auth.guard.ts
│   ├── middleware/user-auth.middleware.ts
│   ├── decorators/public.decorator.ts
│   ├── decorators/roles.decorator.ts
│   ├── services/storage.service.ts
│   └── controllers/uploads.controller.ts
├── db/
│   ├── database.module.ts
│   ├── database.service.ts
│   ├── migrate.ts
│   ├── schema/                      → 18 archivos de schema Drizzle
│   └── migrations/                  → 11 migraciones SQL
└── modules/
    ├── auth/module.ts               → stub
    ├── organizations/               → CRUD completo
    ├── leagues/                     → CRUD + logo/banner
    ├── editions/                    → CRUD + logo/banner + format config
    ├── teams/                       → CRUD + search + logo
    ├── registrations/               → CRUD + mine
    ├── registration-players/        → CRUD (roster)
    ├── groups/                      → CRUD + generate + draw
    ├── matchdays/                   → CRUD
    ├── matches/                     → CRUD + generate-fixture + finalize
    ├── match-events/                → CRUD + mvp + auto-fines
    ├── brackets/module.ts           → stub
    ├── standings/                   → tabla computada + qualifiers
    ├── payments/                    → CRUD + summary
    ├── fines/                       → CRUD + auto-payment
    ├── players/module.ts            → stub
    ├── venues/                      → CRUD + photo
    └── referees/                    → CRUD
```

---

## Despliegue

### Docker
Ambas apps tienen Dockerfile multi-stage (Node 20 Alpine):
- **Admin**: standalone Next.js build → port 3000
- **API**: NestJS build + migraciones copiadas → port 3001

### Variables de entorno

**Admin** (`apps/admin/.env.example`):
```
NEXT_PUBLIC_API_URL=http://localhost:3001/ftb/v1
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=moverix.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=moverix
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=moverix.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
```

**API** (`apps/api/.env.example`):
```
DATABASE_URL=postgresql://moverix:password@localhost:5432/moverix
CORS_ORIGINS=http://localhost:3000
PORT=3001
FIREBASE_PROJECT_ID=moverix
# Prod: GOOGLE_APPLICATION_CREDENTIALS, GCS_BUCKET
```

---

## Comandos de desarrollo

```bash
# Raiz del monorepo
pnpm install              # Instalar dependencias
pnpm dev                  # Levantar admin + api en paralelo (Turbo)
pnpm build                # Build de produccion
pnpm clean                # Limpiar node_modules y outputs

# Desde apps/api/
pnpm db:generate          # Genera migracion Drizzle desde schema
pnpm db:migrate           # Aplica migraciones pendientes
pnpm db:push              # Push directo al DB (sin migracion)
pnpm db:studio            # Abre Drizzle Studio (UI visual)
pnpm db:migrate:run       # Ejecuta migrate.ts custom
pnpm test                 # Jest (API)
```

---

## Consideraciones tecnicas

### Multi-torneo
El header tiene un selector de edicion activa. Las rutas del sidebar (Equipos, Partidos, etc.) son contextuales a esa edicion. Se implementa con `ActiveEditionContext` persistido en `localStorage`.

### Generacion de fixture
Algoritmo round-robin Berger. Soporta `doubleLeg`. Alinea jornadas entre grupos. Respeta `pitchCount` de venues (pendiente validacion al programar).

### Reclasificacion
Automatica al consultar standings. Ordenamiento configurable por `tiebreakerRules`: puntos → diferencia de goles → goles a favor → head-to-head → tarjetas → sorteo.

### Tiempo real
Socket.io instalado y configurado en el backend. Pendiente implementar canales para marcadores EN VIVO.

### Exportacion
xlsx para importar rosters. Exportacion PDF/Excel pendiente.
