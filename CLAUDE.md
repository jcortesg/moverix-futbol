# Moverix — Comunidad de Fútbol Amateur

## Descripción del Proyecto
Plataforma para la gestión de comunidades de fútbol amateur: torneos, equipos, partidos, grupos/llaves, tablas de posiciones y pagos. Se compone de dos aplicaciones:
1. **Admin (Backoffice)** — web app para organizadores
2. **App móvil** — para jugadores y delegados (fase 2)

## Stack Tecnológico (definir con el usuario)
- Frontend Admin: Next.js 14 (App Router) + TypeScript + Tailwind CSS
- Backend: por definir (Supabase / NestJS / Firebase)
- Base de datos: PostgreSQL (via Supabase) o similar

## Estructura del Proyecto
```
moverix-admin/   → Next.js backoffice
moverix-app/     → App móvil (fase 2)
moverix-api/     → Backend API (si aplica)
```

## Módulos del Admin
1. Dashboard
2. Equipos
3. Partidos (fixture)
4. Grupos y Llaves (bracket)
5. Tabla y Reclasificación
6. Pagos
7. Torneos y Ligas
8. Reportes
9. Configuración

## Diseño
- Sidebar oscuro (#1B2535 aprox) con texto blanco
- Contenido principal blanco
- Verde primario para acciones y estados positivos
- Naranja/ámbar para pendientes/parcial
- Rojo para crítico/sin pago
- Tipografía: Inter (o similar sans-serif)
