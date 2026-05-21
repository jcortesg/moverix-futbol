# Moverix — Catalogo de componentes

Componentes del backoffice (`apps/admin/src/components/`). Actualizado 2026-05-05.

**Total**: ~24 componentes en 6 directorios.

## Estructura

```
components/
  ui/                        primitivos genericos
    form.tsx                 Field, SectionCard, Toggle, inputCls
  layout/                    layout chrome
    Sidebar.tsx              navegacion lateral con tenant activo
    Header.tsx               header con selector de torneo + buscador
  auth/                      3 componentes
    AuthGuard.tsx            wrapper de ruta protegida
    LoginForm.tsx            formulario login (react-hook-form + zod)
    RegisterForm.tsx         formulario registro (react-hook-form + zod)
  torneos/                   19 componentes de gestion deportiva
  canchas/                   VenuesManager
  arbitros/                  RefereesManager
```

---

## UI primitives

### `<Field>`
**Archivo**: `components/ui/form.tsx`

```tsx
<Field label="Nombre" hint="Texto de ayuda">
  <input className={inputCls} />
</Field>
```

Wrapper con label en negrita + hint opcional debajo. Todos los formularios lo usan.

### `<SectionCard>`
**Archivo**: `components/ui/form.tsx`

```tsx
<SectionCard
  icon={Settings2}
  color="bg-blue-500"
  title="Información general"
  description="Subtítulo opcional"
>
  {children}
</SectionCard>
```

Card con header coloreado (icono + título) + cuerpo. Usado en `EditionEditPage`, wizard, etc.

### `<Toggle>`
**Archivo**: `components/ui/form.tsx`

```tsx
<Toggle
  checked={value}
  onChange={setValue}
  label="Permitir empates"
  description="Si se desactiva..."
/>
```

Switch grande con label + descripción. Click en cualquier parte del row activa/desactiva.

### `inputCls`
Constante con clases Tailwind para inputs estándar:
```
'w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5
 text-sm text-slate-900 outline-none transition focus:border-green-500
 focus:bg-white focus:ring-2 focus:ring-green-500/20 placeholder:text-slate-400'
```

---

## Layout

### `<Sidebar>`
**Archivo**: `components/layout/Sidebar.tsx`

Sidebar oscuro (`#1B2535`) con dos secciones:

1. **"Torneo activo"** (condicional, solo si `activeEdition` existe):
   - Header con logo/nombre del torneo + botón cerrar (X)
   - Links: Dashboard, Equipos, Partidos, Grupos y Llaves, Tabla, Pagos
2. **"General"** (siempre visible):
   - Torneos, Canchas, Árbitros, Reportes, Config

Footer: avatar del user + email + logout.

Usa `useActiveEdition()` para leer/limpiar el tenant.

### `<Header>`
**Archivo**: `components/layout/Header.tsx`

Header superior blanco con:
- Etiqueta "GESTIONANDO" + dropdown del torneo activo (`Liga + Temporada`)
- Buscador (placeholder, sin función aún)
- Notificaciones (placeholder)

El dropdown agrupa torneos por liga. Solo lista ediciones manageable (`active` o `registration`). Persiste selección en localStorage.

---

## Torneos — Lista y edición

### `<TorneosView>`
**Archivo**: `components/torneos/TorneosView.tsx`
**Ruta**: `/torneos`

Lista de ligas con sus ediciones. Cada liga es una card colapsable con:
- Header: logo, nombre, formato (F8 · Masculino), badge "Activa" si hay edición activa
- Stats: ediciones, activas, equipos
- Botón "Editar liga" (abre `LeagueEditDrawer`)
- Botón "Nueva edición" (link a wizard)
- Grid de `EditionCard` con sus ediciones

### `<EditionCard>`
**Archivo**: `components/torneos/TorneosView.tsx` (interno)

Card de una edición individual. Botones:
- "Editar" → `/torneos/edicion/:id`
- "Gestionar" (si status manageable) → `/torneos/edicion/:id/gestionar` + activa el tenant

### `<LeagueEditDrawer>`
**Archivo**: `components/torneos/LeagueEditDrawer.tsx`

Drawer lateral para crear/editar liga. Campos: nombre, formato deportivo, género, descripción, logo, banner.

### `<EditionCreateWizard>`
**Archivo**: `components/torneos/EditionCreateWizard.tsx`
**Ruta**: `/torneos/edicion/nueva?leagueId=X`

Wizard 4 pasos:
1. **Básico** — nombre, fechas (auto-genera season "YYYY-I" o "YYYY-II")
2. **Equipos** — max teams (input + presets 8/16/24/32)
3. **Formato** — selector de tipo + sub-forms por fase
4. **Resumen** — review + crear

Usa stepper visual con estados activo/done/pendiente. Validación por paso.

Tras crear → redirige a `/torneos/edicion/:id` (donde puede subir banner/logo).

### `<EditionEditPage>`
**Archivo**: `components/torneos/EditionEditPage.tsx`
**Ruta**: `/torneos/edicion/[id]`

Edit con 5 tabs:
- **General**: nombre, season, status, fechas
- **Equipos**: capacidad
- **Formato**: tipo + fases + reglas + Puntuación/Desempates (`<TiebreakerEditor>`)
- **Finanzas**: moneda, inscripción, premio
- **Documentos**: URL de reglamento

Hero arriba con banner/logo subibles. Sidebar derecho con resumen de status, formato, números clave.

Al guardar redirige a `/torneos/edicion/:id/gestionar`.

### `<TiebreakerEditor>` (interno en `EditionEditPage`)
Editor de criterios de desempate. Permite:
- Inputs de winPts/drawPts/lossPts
- Toggle "Permitir empates"
- Lista reordenable (↑/↓) de criterios secundarios
- Chips para agregar criterios faltantes

### Sub-componentes de formato (en `edition-form.tsx`)
- `<PhaseGroupsForm>` — grupos, equipos por grupo, qualifiers, doubleLeg
- `<PhaseRoundRobinForm>` — toggle doubleLeg
- `<PhaseKnockoutForm>` — bracket size (4/8/16/32/64), 3er lugar, repechaje
- `<PhaseMultiCupForm>` — lista editable de copas con from/to/size

Constantes exportadas:
- `STATUSES` — los 4 status de edición con labels y colores
- `FORMAT_TYPES` — los 5 tipos de formato con icon, desc, phase1/phase2

---

## Torneos — Página Gestionar

### `<GestionarEdicionPage>` (page)
**Archivo**: `app/(dashboard)/torneos/edicion/[id]/gestionar/page.tsx`

Página hub con:
- **Hero mini**: banner + logo + nombre + season
- **`<ConfigSummary>`** (interno): card con 4 columnas (Formato, Fechas, Equipos+Reglas, Finanzas+Docs) + fila inferior con Puntuación y Desempates
- **6 tiles**: Equipos, Grupos, Fixture, Bracket, Posiciones, Pagos

Tiles habilitadas tienen `href`. Las pendientes muestran badge "Próximamente".

Auto-activa el tenant al cargar la edición.

---

## Equipos (Inscripciones)

### `<EquiposManager>`
**Archivo**: `components/torneos/EquiposManager.tsx`
**Rutas**: `/equipos`, `/torneos/edicion/[id]/gestionar/equipos`

Tabla de inscripciones con:
- Header con barra de capacidad (aprobados / max)
- Chips de filtro por status
- Tabla: Equipo (clickeable a detalle) · Status · Pago · Grupo (select inline) · Acciones
- Botones por fila: ✓ aprobar / ✗ rechazar / menú contextual con todas las transiciones
- Drawer "Inscribir equipo" con 2 tabs: Buscar existente / Crear nuevo

Props:
- `editionId: string`
- `backHref?, backLabel?`

### `<TeamDetailView>`
**Archivo**: `components/torneos/TeamDetailView.tsx`
**Ruta**: `/torneos/edicion/[id]/gestionar/equipos/[regId]`

Vista de detalle de un team inscrito. Incluye:
- Hero compacto con logo (subible) + nombre editable + colores
- Status strip: Estado / Pago / Grupo / Seed (todo editable inline)
- 5 tabs: Plantilla (funcional), Partidos / Pagos / Sanciones / Estadísticas (placeholders)

### `<RosterTab>`
**Archivo**: `components/torneos/RosterTab.tsx`

Plantilla del team. Tabla:
- # (dorsal) | Jugador (clickeable) | POS | 🟨 | 🟥 | WO | Multas | Estado | Cap | Acciones
- Botones header: "Importar" + "Agregar jugador"

Acciones: editar (drawer), quitar, marcar capitán.

**Stats hardcoded en 0** hoy — pendiente leer de match_events y fines.

### `<PlayerDetailDrawer>`
**Archivo**: `components/torneos/PlayerDetailDrawer.tsx`

Drawer del jugador con modos ver/editar y 3 tabs:
- **Datos personales** (funcional): identidad, contacto, info laboral/salud
- **Historial** (placeholder)
- **Asistencia** (placeholder)

En modo ver: bloques agrupados con campos "Sin registrar" si vacíos. Cédula/email/teléfono clickeables. Edad calculada desde birthDate.

En modo edit: form con secciones igual al de creación.

### `<RosterImportDialog>`
**Archivo**: `components/torneos/RosterImportDialog.tsx`

Modal grande para importar jugadores desde CSV o Excel:
- Plantilla descargable (xlsx o csv)
- Drag & drop + click para subir
- Auto-detecta columnas con normalización de acentos y aliases
- Auto-mapea posición desde texto ("Defensa" → CB, "Volante derecho" → RW)
- Valida formato de fecha (DD/MM/YYYY, ISO, etc.)
- Detecta duplicados en BD y dentro del archivo
- Preview con marcadores de error inline
- Botón "Eliminar inválidos" + por fila
- Importa secuencialmente con progreso

---

## Grupos

### `<GruposManager>`
**Archivo**: `components/torneos/GruposManager.tsx`
**Rutas**: `/grupos-llaves`, `/torneos/edicion/[id]/gestionar/grupos`

Vista de grupos:
- Header: "Sortear equipos", "Generar desde formato", "+ Nuevo grupo"
- Stats card: N grupos · M aprobados · K sin asignar
- Grid 1/2/3 cols de `<GroupCard>` (interno)
- Pool "Equipos sin grupo" con chips para asignar

`<GroupCard>` tiene capacity tracking (verde/ámbar/rojo según ocupación), edición inline (nombre, código, maxTeams), drawer "Asignar equipos".

---

## Partidos

### `<PartidosManager>`
**Archivo**: `components/torneos/PartidosManager.tsx`
**Rutas**: `/partidos`, `/torneos/edicion/[id]/gestionar/partidos`

Fixture y resultados:
- Header: botón "Generar fixture" / "Regenerar fixture"
- Selector horizontal de jornadas (J1, J2, J3...) con `finished/total`
- Lista de partidos por grupo dentro de la jornada activa

`<MatchCard>` (interno): layout `Local | marcador o vs | Visitante`, footer con status, fecha, cancha, árbitro, botones Eventos / Cargar resultado / Programar / Eliminar.

`<ScheduleDialog>` (interno): drawer para programar fecha+hora+cancha+árbitro+status.

`<FinalizeDialog>` (interno): modal con 2 inputs grandes para marcador.

### `<MatchEventsDrawer>`
**Archivo**: `components/torneos/MatchEventsDrawer.tsx`

Drawer ancho con 4 secciones:
- **MVP**: selector único, badge dorado al asignar
- **Goles**: form (Equipo · Jugador · Asistente · Min · +) + lista
- **Tarjetas**: form con switch yellow/red + lista
- **Sustituciones**: form (Equipo · Sale · Entra · Min) + lista

Selectores de jugador leen `registration_players` de cada team. Auto-fines disparados al crear cards.

---

## Tabla / Posiciones

### `<TablaManager>`
**Archivo**: `components/torneos/TablaManager.tsx`
**Rutas**: `/tabla`, `/torneos/edicion/[id]/gestionar/tabla`

Vista con tabs:
- **Grupos** (si hay): una tabla por grupo, con líder marcado con trofeo, clasificados con fondo verde, columnas PJ/PG/PE/PP/GF/GC/DG/Pts. `table-fixed colgroup`, equipo al 30%
- **Reclasificación**: tabla general consolidada cross-grupos + chips por destino + columna "Destino" con seed asignado

Auto-switch a "Reclasificación" si no hay grupos.

---

## Pagos

### `<PagosManager>`
**Archivo**: `components/torneos/PagosManager.tsx`
**Rutas**: `/pagos`, `/torneos/edicion/[id]/gestionar/pagos`

Vista financiera:
- **Header con balance**: 4 cards (Recaudado / Por cobrar / Inscripciones X/Y / Multas)
- **Línea inferior**: balance neto destacado
- **Tabs**: Inscripciones / Multas y sanciones / Movimientos

Tab Inscripciones: tabla por team con tarifa/pagado/saldo + botón "Registrar pago" (modal con monto preset al saldo).

Tab Multas: tabla con concept/sanction/monto/status + botones rápidos ✓ pagar / ✗ perdonar. Modal con selector de team aprobado, jugador desde plantilla o manual, partido del equipo, monto, sanción, fechas suspensión.

Tab Movimientos: cronología de todos los payments con tipo/monto/status.

---

## Canchas y Árbitros

### `<VenuesManager>`
**Archivo**: `components/canchas/VenuesManager.tsx`
**Ruta**: `/canchas`

Grid de cards con foto, nombre, dirección, badge "N canchas" si pitchCount > 1. Drawer crear/editar con foto + nombre + dirección + ciudad + N° canchas + lat/lng colapsable.

### `<RefereesManager>`
**Archivo**: `components/arbitros/RefereesManager.tsx`
**Ruta**: `/arbitros`

Tabla simple: nombre + licencia + teléfono (link `tel:`). Drawer crear/editar.

---

### `<BracketManager>`
**Archivo**: `components/torneos/BracketManager.tsx`
**Rutas**: `/torneos/edicion/[id]/gestionar/bracket`

**Props**: `editionId`, `backHref?`, `backLabel?`

Layout:
- Breadcrumb (ChevronLeft → Gestionar)
- Header: icono Swords + título + stats (N llaves · M rondas) + botones Generar/Resetear
- Tabs de copas (si multi-cup)
- Vista horizontal del bracket: columnas por ronda
- Empty state si no hay bracket generado

Sub-componentes internos:
- `SlotCard` — card 192px con dos `TeamRow` (logo + nombre + score + penalties + winner trophy)
- `roundLabel()` — helper para labels: Octavos, Cuartos, Semifinales, Final

**API client**: `lib/brackets.ts` — `generateBracket`, `getBracket`, `getBracketCups`, `resetBracket`

---

## Helpers compartidos

### `<ActiveEditionRequired>`
**Archivo**: `components/torneos/ActiveEditionRequired.tsx`

```tsx
<ActiveEditionRequired moduleLabel="los partidos">
  {(editionId) => <PartidosManager editionId={editionId} backHref="/" backLabel="Torneo activo" />}
</ActiveEditionRequired>
```

Wrapper que:
1. Espera a que `ActiveEditionContext` esté ready
2. Si no hay tenant → empty state con CTA "Ir a torneos"
3. Si hay → llama children con el editionId

Usado en todas las rutas del sidebar (`/equipos`, `/partidos`, etc.).

---

## Patrones recurrentes

### Drawer lateral
Todos los drawers siguen este shape:
```tsx
<>
  <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
  <aside className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl z-50 flex flex-col">
    {/* header sticky */}
    {/* form scrolleable */}
    {/* footer sticky con botones */}
  </aside>
</>
```

### Modal pequeño
```tsx
<>
  <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
      {/* contenido */}
    </div>
  </div>
</>
```

### Status pills
```tsx
<span className={clsx(
  'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-bold border',
  meta.bg, meta.text,
)}>
  <span className={clsx('w-1.5 h-1.5 rounded-full', meta.dot)} />
  {meta.label}
</span>
```

### Empty states
```tsx
<div className="flex flex-col items-center justify-center gap-3 py-16 bg-white rounded-2xl border-2 border-dashed border-slate-200">
  <Icon size={28} className="text-slate-300" />
  <p className="text-sm font-semibold text-slate-500">Mensaje</p>
  <button>CTA opcional</button>
</div>
```

### `extractError` helper
Repetido en varios componentes (debería extraerse):
```tsx
function extractError(err: unknown): string | null {
  if (typeof err !== 'object' || err === null) return null
  const maybeAxios = err as { response?: { data?: { message?: string | string[] } } }
  const msg = maybeAxios.response?.data?.message
  if (!msg) return null
  return Array.isArray(msg) ? msg[0] ?? null : msg
}
```

---

## Lib (API clients y utilidades)

20 archivos en `apps/admin/src/lib/`. Cada dominio tiene su propio modulo con funciones axios + tipos.

| Archivo | Responsabilidad |
|---------|-----------------|
| `api.ts` | Axios instance + Firebase token interceptor (core) |
| `firebase.ts` | Firebase init (auth only, sin Firestore) |
| `auth.ts` | Helpers: signIn, signInWithGoogle, error messages |
| `leagues.ts` | Leagues + Editions CRUD + tipos complejos (~40 types) |
| `teams.ts` | Teams CRUD |
| `registrations.ts` | Inscripciones CRUD |
| `registration-players.ts` | Roster CRUD |
| `matches.ts` | Matches CRUD + fixture generation |
| `matchdays.ts` | Matchdays CRUD |
| `match-events.ts` | Eventos de partido CRUD + MVP |
| `groups.ts` | Groups CRUD + generate + draw |
| `standings.ts` | Standings query + qualifiers |
| `payments.ts` | Payments CRUD + summary |
| `fines.ts` | Fines CRUD |
| `venues.ts` | Venues CRUD |
| `referees.ts` | Referees CRUD |
| `image.ts` | Resize antes de upload (512px logos, 1200px banners) |
| `csv.ts` | Parser CSV RFC 4180 |
| `slug.ts` | Generador de slugs URL-safe |

**Patron de data fetching**: axios directo en `useEffect` con `useState` para loading/error/data. Sin cache ni invalidation (react-query instalado pero no usado).

---

## Estado y deuda tecnica

### Cosas a refactorizar
- `extractError` duplicado en ~5 componentes → mover a `lib/errors.ts`
- Algunos `*Manager` tienen drawers internos enormes (PagosManager > 900 lineas) → considerar extraer cada modal
- `LeagueEditDrawer` tiene imports muertos (warnings TS)
- Tablas construidas manualmente → podrian usar `@tanstack/react-table` (ya instalado)
- Data fetching repetitivo → podria usar `@tanstack/react-query` (ya instalado)
- Drag & drop de grupos no implementado → `@dnd-kit` ya instalado

### Dependencias sin usar
Instaladas en `package.json` pero sin import en el codigo:
- `zustand` (5.0.0) — estado global
- `@tanstack/react-query` (5.56.2) — server state cache
- `@tanstack/react-table` (8.20.5) — tablas avanzadas
- `recharts` (2.12.7) — graficas
- `@dnd-kit/core` + `@dnd-kit/sortable` — drag & drop

### Convenciones que aplicamos
- **`*Manager`** — vista grande con datos + acciones (componente principal de cada modulo)
- **`*Dialog` / `*Drawer`** — modales y drawers
- **Props consistentes**: `editionId`, `backHref?`, `backLabel?` en managers reutilizables
- **`onClose` + `onSaved`** — patron de callbacks en drawers
- **Tab keys**: `useState<TabKey>` con union de strings
- **Status pills**: badge con dot indicator + colores semanticos
- **Empty states**: icono + texto + CTA opcional con borde dashed
- **Breadcrumbs**: ChevronLeft + backHref + titulo
