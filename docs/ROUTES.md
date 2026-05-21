# Moverix — Mapa de rutas (Admin)

Todas las rutas Next.js del backoffice (`apps/admin/src/app/`). Actualizado 2026-05-05.

## Convenciones

- 🔓 **Pública** — accesible sin login
- 🔐 **Requiere auth** (Firebase) — la mayoría
- 🎯 **Requiere tenant activo** — usa `<ActiveEditionRequired>`. Si no hay edición activa, muestra empty state con CTA a `/torneos`

Estructura del directorio:
```
apps/admin/src/app/
  (auth)/             rutas sin sidebar/header
  (dashboard)/        rutas con sidebar + header
  onboarding/         wizard de setup inicial
```

---

## Auth (sin layout dashboard)

| Ruta | Descripción | Notas |
|---|---|---|
| 🔓 `/login` | Login con email + Google | Redirige a `/` tras login |
| 🔓 `/registro` | Registro de nueva cuenta (react-hook-form + zod) | Tras registrar se redirige a `/onboarding` |
| 🔐 `/onboarding` | Wizard 3 pasos: organizacion → liga → primera edicion | Solo si no hay org existente |

---

## Dashboard (con sidebar + header)

### Home

| Ruta | Descripción | Estado |
|---|---|---|
| 🔐 `/` | Dashboard principal | ✅ KPIs + partidos hoy + mini tabla + acciones rápidas |

### Torneos (catálogo + edición)

| Ruta | Descripción |
|---|---|
| 🔐 `/torneos` | Lista de ligas con sus ediciones (`TorneosView`) |
| 🔐 `/torneos/edicion/nueva?leagueId=X` | Wizard 4 pasos para crear edición |
| 🔐 `/torneos/edicion/[id]` | Edit de edición con tabs (General / Equipos / Formato / Finanzas / Documentos) |
| 🔐 `/torneos/edicion/[id]/gestionar` | Hub de gestión: ConfigSummary + 6 tiles de módulos |

### Gestión de una edición

| Ruta | Descripción |
|---|---|
| 🔐 `/torneos/edicion/[id]/gestionar/equipos` | Inscripciones, aprobaciones, asignación de grupo |
| 🔐 `/torneos/edicion/[id]/gestionar/equipos/[regId]` | Detalle del team inscrito + plantilla |
| 🔐 `/torneos/edicion/[id]/gestionar/grupos` | CRUD + sorteo de grupos |
| 🔐 `/torneos/edicion/[id]/gestionar/partidos` | Fixture, programación, cargar resultado, eventos |
| 🔐 `/torneos/edicion/[id]/gestionar/tabla` | Tabla de posiciones + reclasificación |
| 🔐 `/torneos/edicion/[id]/gestionar/pagos` | Inscripciones, multas, balance |
| 🔐 `/torneos/edicion/[id]/gestionar/bracket` | Cuadro eliminatorio visual + generar/resetear |

### Sidebar "Torneo activo" (requieren tenant)

Estas rutas usan `<ActiveEditionRequired>` y leen `editionId` del `ActiveEditionContext`. Internamente reutilizan los mismos `*Manager` componentes.

| Ruta | Componente reutilizado |
|---|---|
| 🎯 `/equipos` | `EquiposManager` |
| 🎯 `/partidos` | `PartidosManager` |
| 🎯 `/grupos-llaves` | `GruposManager` |
| 🎯 `/tabla` | `TablaManager` |
| 🎯 `/pagos` | `PagosManager` |

### General (sin tenant)

| Ruta | Descripción | Estado |
|---|---|---|
| 🔐 `/canchas` | CRUD de venues de la organización | ✅ |
| 🔐 `/arbitros` | CRUD de referees | ✅ |
| 🔐 `/reportes` | Reportes (boleta de partido, listado de inscritos, etc.) | ⏳ Vacío |
| 🔐 `/config` | Configuración general | ⏳ Vacío |

---

## Layout

### `(auth)/layout.tsx`
- Centrado vertical
- Sin sidebar/header
- Logo Moverix arriba

### `(dashboard)/layout.tsx`
```tsx
<AuthGuard>
  <ActiveEditionProvider>
    <Sidebar />
    <Header />
    <main>{children}</main>
  </ActiveEditionProvider>
</AuthGuard>
```

- `AuthGuard` redirige a `/login` si no hay sesión
- `ActiveEditionProvider` lee/escribe `localStorage['moverix:activeEdition']`
- `Sidebar` muestra sección "Torneo activo" condicional
- `Header` selector de torneo activo (dropdown) + búsqueda + notificaciones (placeholder)

---

## Middleware

`apps/admin/src/middleware.ts` — chequea cookie `moverix-auth` (seteada por AuthContext). Redirige a `/login` si no hay sesion. Redirige usuarios autenticados fuera de `/login` y `/registro`. Excluye archivos estaticos del matcher.

---

## Patrón de breadcrumbs

Cada `*Manager` usa este patrón:
```tsx
<Link href={backHref ?? defaultBackHref}>
  <ChevronLeft /> {backLabel ?? 'Default'}
</Link>
<span>/</span>
<span>{title}</span>
```

Cuando se entra desde `/gestionar`: backHref apunta a `/torneos/edicion/[id]/gestionar`, label "Gestionar"
Cuando se entra desde sidebar: backHref `/`, label "Torneo activo"

---

## Estado de rutas

### ✅ Implementadas (20 rutas)
- Auth: login, registro, onboarding (wizard 3 pasos)
- Torneos: lista + create wizard 4 pasos + edit por tabs + gestionar hub
- Equipos: manager + detalle por inscripcion (hero + roster + import)
- Grupos: generacion + sorteo + asignacion
- Partidos: fixture + programacion + resultado + eventos
- Tabla: posiciones por grupo + reclasificacion
- **Bracket**: vista visual del cuadro eliminatorio + generar/resetear
- Pagos: inscripciones + multas + movimientos + balance
- Canchas: CRUD con foto
- Arbitros: CRUD

### ⏳ Pendientes
- `/reportes` — vacio
- `/config` — vacio
- Vista publica de torneo (sin auth, para compartir link)
- Vistas del DT/jugador (fase 2 — app movil)
- Vista del arbitro (cargar resultados desde movil)
