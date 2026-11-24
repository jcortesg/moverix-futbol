# Admin — Next.js (panel de organizadores)

Next.js 14 (App Router) + Tailwind 3 + Firebase Auth. Puerto 3000.
Producción: Cloud Run **`moverix-admin-production`** → `admin-ftb.moverix.co` / `futbol.moverix.co`
(el servicio `admin-ftb` no se usa). Habla con la API vía `NEXT_PUBLIC_API_URL` (build arg).
Despliegue: `../../docs/OPERACION.md`. **Responder siempre en español.**

## Estructura
- `src/app/(dashboard)/` — panel con login: `torneos`, `equipos`, `jugadores`, `partidos`, `pagos`,
  `tabla`, `grupos-llaves`, `arbitros`, `canchas`, `reportes`, `config`.
  - Gestión de una edición: `torneos/edicion/[id]/gestionar/` → `equipos` (y `equipos/[regId]` =
    nómina/planilla del equipo), `partidos`, `grupos`, `bracket`, `tabla`, `pagos`.
  - `torneos/edicion/[id]` = configuración de la edición (incluye la tabla de multas `fine_defaults`).
- `src/app/(public)/` — páginas públicas sin login: `campeonatos`, `t`, `i` (invitaciones),
  `dirigir` (planilla del árbitro en web), `privacidad`, `terminos`.
- `src/app/(auth)/`, `src/app/onboarding/` — login y alta de organización.
- `src/lib/` — **un cliente por recurso de la API** (`teams.ts`, `registrations.ts`,
  `registration-players.ts`, `matches.ts`, `fines.ts`, …) sobre `api.ts` (axios con token).
  Exportaciones: `roster-pdf.ts`, `roster-excel.ts`, `fines-excel.ts`, `standings-excel.ts`, `csv.ts`.
- `src/components/` — por sección (`torneos/`, `jugadores/`, `arbitros/`, …) y `ui/` genéricos.

## Pantallas que más se tocan
- `components/torneos/RosterTab.tsx` — nómina del equipo: marca delegados (principal / "no juega"),
  descarga PDF y Excel.
- `components/torneos/PagosManager.tsx` — pagos y multas: tabla de multas y sanciones con enlace a
  editar valores, e "Informe de tarjetas y multas" (Excel con estado de pago por tarjeta).

## Comandos
```bash
pnpm dev                              # next dev (puerto 3000)
npx tsc --noEmit -p tsconfig.json     # type-check
```

## Convenciones
- Si se agrega un endpoint en la API, agregar su función en el `src/lib/<recurso>.ts` correspondiente
  y tipar la respuesta ahí.
- Textos de la interfaz en español, con el lenguaje de los organizadores (nómina, planilla,
  delegado, CdC…).
