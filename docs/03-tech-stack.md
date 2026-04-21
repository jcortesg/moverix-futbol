# Moverix — Stack Tecnológico y Arquitectura

## Decisión de Stack

### Frontend Admin (Backoffice)
- **Framework**: Next.js 14 (App Router)
- **Lenguaje**: TypeScript
- **Estilos**: Tailwind CSS + shadcn/ui (componentes base)
- **Estado**: Zustand (estado global ligero) + React Query (server state)
- **Formularios**: React Hook Form + Zod (validación)
- **Tablas**: TanStack Table v8
- **Drag & Drop** (grupos): dnd-kit
- **Gráficas**: Recharts o Chart.js
- **Iconos**: Lucide React

### Backend / BaaS
**Opción A — Supabase (recomendado para velocidad)**
- PostgreSQL como base de datos
- Auth con roles (super admin, organizador, delegado)
- Row Level Security (RLS) para multi-tenancy
- Realtime para partidos en vivo
- Storage para logos e imágenes
- Edge Functions para lógica de negocio compleja

**Opción B — NestJS + PostgreSQL**
- Mayor control y flexibilidad
- Más tiempo de desarrollo
- Mejor para escalar y customizar

### Despliegue
- Frontend: Vercel
- Backend (si NestJS): Railway / Render
- Base de datos (si propio): Neon o Supabase

---

## Arquitectura de Datos (PostgreSQL)

### Tablas Principales

```sql
-- Organizaciones / Federaciones
organizations
  id, name, slug, logo_url, created_at

-- Usuarios
users (auth.users de Supabase)
  id, email, full_name, role (super_admin|admin|delegado), org_id

-- Ligas
leagues
  id, org_id, name, sport_format (F5|F8|F11), gender (M|F|Mixed)
  description, logo_url, created_at

-- Ediciones (temporadas de una liga)
editions
  id, league_id, name, season (2025-I), start_date, end_date
  status (draft|registration|active|finished)
  format (groups_only|groups_brackets|brackets_only)
  group_count, teams_per_group, inscription_fee

-- Equipos
teams
  id, org_id, name, logo_url, home_venue_id, created_at

-- Inscripciones (equipo en edición)
registrations
  id, team_id, edition_id, group_id, status (pending|approved|rejected)
  delegate_name, delegate_phone, created_at

-- Grupos
groups
  id, edition_id, name (A|B|C...), order

-- Canchas / Sedes
venues
  id, org_id, name, address, fields_count

-- Árbitros
referees
  id, org_id, full_name, phone

-- Fechas / Jornadas
matchdays
  id, edition_id, number, date, status (scheduled|in_progress|completed)

-- Partidos
matches
  id, edition_id, matchday_id, group_id
  home_team_id, away_team_id
  home_score, away_score
  venue_id, field_number, referee_id
  scheduled_time, status (scheduled|in_progress|finished)
  is_bracket_match, bracket_round (octavos|cuartos|semis|final)
  cup (A|B|C)

-- Pagos
payments
  id, registration_id, concept (inscription|deposit|fine|wo)
  total_amount, paid_amount
  payment_date, status (paid|partial|unpaid)
  notes

-- Multas
fines
  id, team_id, edition_id, match_id
  concept (yellow_card|red_card|no_show|wo)
  amount, status (pending|paid)
```

---

## Estructura del Proyecto Next.js

```
moverix-admin/
├── app/
│   ├── (auth)/
│   │   └── login/
│   ├── (dashboard)/
│   │   ├── layout.tsx          → sidebar + header layout
│   │   ├── page.tsx            → dashboard
│   │   ├── equipos/
│   │   ├── partidos/
│   │   ├── grupos-llaves/
│   │   ├── tabla/
│   │   ├── pagos/
│   │   ├── torneos/
│   │   ├── reportes/
│   │   └── config/
├── components/
│   ├── layout/
│   │   ├── Sidebar.tsx
│   │   ├── Header.tsx
│   │   └── TournamentSelector.tsx
│   ├── ui/                     → shadcn base components
│   ├── dashboard/
│   ├── equipos/
│   ├── partidos/
│   ├── grupos/
│   ├── pagos/
│   └── torneos/
├── lib/
│   ├── supabase/
│   │   ├── client.ts
│   │   └── server.ts
│   ├── utils.ts
│   └── types.ts
├── hooks/
├── store/                      → Zustand stores
└── public/
```

---

## Plan de Desarrollo — Fases

### Fase 1: Fundación (Semana 1-2)
- [ ] Setup Next.js + Tailwind + shadcn/ui
- [ ] Setup Supabase (auth, tablas base)
- [ ] Layout: sidebar + header + auth
- [ ] Módulo Torneos y Ligas (CRUD básico)

### Fase 2: Core del Torneo (Semana 3-4)
- [ ] Módulo Equipos (lista, agregar, estados de pago)
- [ ] Módulo Grupos y Llaves (asignación, drag&drop)
- [ ] Módulo Partidos (fixture, generación automática)

### Fase 3: Operación en Vivo (Semana 5-6)
- [ ] Registro de resultados
- [ ] Tabla de posiciones y reclasificación automática
- [ ] Dashboard con KPIs y alertas
- [ ] Módulo Pagos (registro y seguimiento)

### Fase 4: Reportes y Pulido (Semana 7-8)
- [ ] Módulo Reportes (estadísticas, exportaciones)
- [ ] Módulo Configuración (canchas, árbitros, usuarios)
- [ ] Notificaciones y alertas
- [ ] Optimización y QA

---

## Consideraciones Técnicas

### Multi-torneo
El header tiene un selector de torneo activo. El contexto de "TORNEO ACTIVO" en el sidebar aplica al torneo seleccionado. Esto se implementa con un `TournamentContext` o store global.

### Generación de Fixture
Algoritmo round-robin para fase de grupos. Respetar canchas disponibles y árbitros.

### Reclasificación
Automática al completar todas las fechas de grupos. Ordenamiento por puntos → diferencia de goles → goles a favor → enfrentamiento directo.

### Tiempo Real
Usar Supabase Realtime para actualizar marcadores EN VIVO sin recargar la página.

### Exportación
PDF del fixture y llaves, Excel de pagos. Usar `@react-pdf/renderer` y `xlsx`.
