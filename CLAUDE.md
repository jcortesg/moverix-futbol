# Moverix Futbol — plataforma (API + admin)

Monorepo pnpm 9 + Turbo 2. Gestión de torneos de fútbol amateur.
Repo: `git@github.com:jcortesg/moverix-futbol.git`. La app móvil vive aparte en `../app-movil`.

**Responder siempre en español.**

## Stack
- **API** (`apps/api`): NestJS 10 + Drizzle ORM + PostgreSQL (Cloud SQL) + Firebase Admin — port 3001, prefix `/ftb/v1`
- **Admin** (`apps/admin`): Next.js 14 (App Router) + Tailwind 3 + Firebase Auth — port 3000
- Producción en GCP proyecto `moverix`: Cloud Run `moverix-api-production` (api-ftb.moverix.co) y
  `moverix-admin-production` (admin-ftb.moverix.co / futbol.moverix.co)

## Comandos
```bash
pnpm dev                                   # admin + api
npx tsc --noEmit -p tsconfig.json          # type-check (en apps/api o apps/admin)
scripts/local-dev.sh                       # entorno local: Postgres Docker :5440 + API :3001 + admin :3100 (datos de prueba)
scripts/local-dev.sh reset                 # recrea la base local (drizzle-kit push + seed)
scripts/prod-db.sh                         # psql contra PRODUCCIÓN (cloud-sql-proxy :6543 + Secret Manager)
```

## Ojo
- Las migraciones de `apps/api/src/db/migrations` están atrasadas respecto al schema del código:
  una base creada solo con migraciones no sirve. La base local se crea con `drizzle-kit push`.
- Nunca copiar datos de producción a local (datos personales de jugadores).

## Documentos
- `apps/api/CLAUDE.md` y `apps/admin/CLAUDE.md` — estructura y convenciones de cada app.
- `docs/OPERACION.md` — **runbook**: acceso a la base y a Firebase, despliegue, modelo de datos
  que más se toca, reglas de negocio, recetas SQL e IDs de producción. Leerlo antes de tocar datos.
- `docs/PLAN-ADMIN-UX.md` — plan de mejoras del admin por fases (marcar cada punto al terminarlo).
- `docs/DEPLOY.md` — infraestructura GCP y rollback.
- `docs/API.md`, `docs/MODULES.md`, `docs/ROUTES.md` — referencia del código.

## Cómo se trabaja
- Los pedidos llegan de los organizadores por WhatsApp (nóminas, delegados, duplicados, árbitros,
  multas). Se resuelven en la base de producción: primero `select` para mirar, después el cambio en
  una transacción, y al final se verifica.
- Desplegar a producción solo con el visto bueno explícito del usuario. Desplegar por digest y
  revisar `/ftb/v1/health` y los logs después.
- Producción puede estar corriendo una rama distinta de `main` (ver `git log` de la rama actual).
