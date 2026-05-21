# Moverix Admin — Especificacion de Pantallas

Estado actual de la UI implementada. Marcadas con estado: ✅ implementada, 🚧 parcial, ⏳ pendiente.

## Layout Global
- **Sidebar fijo** (izquierda, ~200px): logo, navegacion con 2 secciones, perfil usuario + logout
- **Header** (top): selector de edicion activa (dropdown agrupado por liga), buscador (placeholder), notificaciones (placeholder)
- **Contenido principal** (resto): varia por modulo
- **Middleware**: cookie `moverix-auth` redirige a `/login` si no hay sesion

---

## Auth ✅

### Login (`/login`)
- Formulario email + password (react-hook-form + zod)
- Boton "Continuar con Google" (Firebase Google provider)
- Link a registro

### Registro (`/registro`)
- Formulario nombre + email + password (react-hook-form + zod)
- Boton Google
- Tras registro → redirect a `/onboarding`

### Onboarding (`/onboarding`)
- Wizard 3 pasos si el usuario no tiene organizacion:
  1. Crear organizacion (nombre, ciudad)
  2. Crear liga (nombre, formato F5/F8/F11, genero)
  3. Crear primera edicion (nombre, temporada, max teams)
- Tras completar → redirect a `/torneos`

---

## 1. Dashboard (`/`) ✅

**Estado**: implementado. Muestra datos del torneo activo.

### KPI Cards (fila superior, 4 tarjetas)
| Card | Valor | Sub-info | Color |
|------|-------|----------|-------|
| Partidos hoy | N | "X finalizados en total" | Azul |
| Equipos inscritos | N | "de M max" | Verde |
| Pagos pendientes | $X | "N equipos deben" | Rojo |
| Multas pendientes | N | "$X por cobrar" | Ámbar |

### Layout (grid 2/3 + 1/3)
- **Col izquierda**: "Partidos de hoy" (lista con hora + ronda + status/score) + "Sin resultado" (partidos pasados sin finalizar)
- **Col derecha**: Mini tabla de posiciones (top 5 del primer grupo) + Panel acciones rápidas (links a partidos, pagos, bracket, tabla)

### Sin torneo activo
Empty state centrado con CTA "Ir a Torneos" cuando no hay tenant seleccionado.

---

## 2. Torneos y Ligas (`/torneos`) ✅

### Vista principal — TorneosView
- Header: "+ Nueva liga" (boton verde, abre LeagueEditDrawer)
- Grid de ligas como cards colapsables:
  - Logo + nombre + formato (ej. "F8 · Masculino") + badge "Activa" si tiene edicion activa
  - Stats: ediciones, activas, equipos
  - Botones: "Editar liga" + "Nueva edicion"
  - Grid horizontal de EditionCards

### EditionCard
Cada edicion muestra: nombre, temporada, badge status, equipos, fase actual
- "Editar" → `/torneos/edicion/:id`
- "Gestionar" → `/torneos/edicion/:id/gestionar` (activa el tenant)

### LeagueEditDrawer
Drawer lateral para crear/editar liga: nombre, formato deportivo, genero, descripcion, logo, banner.

### Wizard crear edicion (`/torneos/edicion/nueva?leagueId=X`)
4 pasos con stepper visual:
1. **Basico**: nombre, fechas (auto-genera season "YYYY-I/II")
2. **Equipos**: max teams (input + presets 8/16/24/32)
3. **Formato**: selector de tipo + sub-forms (grupos, knockout, round-robin, multi-cup)
4. **Resumen**: review + crear

### Editar edicion (`/torneos/edicion/:id`)
Hero con banner/logo subibles. 5 tabs:
- **General**: nombre, season, status, fechas
- **Equipos**: capacidad
- **Formato**: tipo + fases + TiebreakerEditor (winPts/drawPts/lossPts, criterios reordenables)
- **Finanzas**: moneda, inscripcion, premio
- **Documentos**: URL de reglamento

### Pagina gestionar (`/torneos/edicion/:id/gestionar`)
Hub con:
- Hero mini: banner + logo + nombre + season
- ConfigSummary: 4 columnas (Formato, Fechas, Equipos+Reglas, Finanzas) + fila de Puntuacion/Desempates
- 6 tiles: Equipos, Grupos, Fixture, Bracket, Posiciones, Pagos

---

## 3. Equipos ✅

### EquiposManager (`/equipos` o `/gestionar/equipos`)
- Header con barra de capacidad (aprobados / max_teams)
- Chips de filtro por status (pending/approved/rejected/withdrawn)
- Tabla: Equipo (clickeable) · Status pill · Pago · Grupo (select inline) · Acciones
- Acciones por fila: ✓ aprobar / ✗ rechazar / menu contextual
- Drawer "Inscribir equipo": 2 tabs — buscar existente (search API) / crear nuevo

### TeamDetailView (`/gestionar/equipos/:regId`)
- Hero compacto: logo subible + nombre editable + colores (primary/secondary)
- Status strip: Estado / Pago / Grupo / Seed (todo editable inline)
- 5 tabs:
  - **Plantilla** (RosterTab) ✅
  - **Partidos** ⏳ placeholder
  - **Pagos** ⏳ placeholder
  - **Sanciones** ⏳ placeholder
  - **Estadisticas** ⏳ placeholder

### RosterTab
Tabla: # (dorsal) · Jugador (clickeable) · POS · 🟨 · 🟥 · WO · Multas · Estado · Cap · Acciones
- Botones: "Importar" (CSV/Excel) + "Agregar jugador"
- Acciones: editar (drawer), quitar, marcar capitan
- **Columnas 🟨 🟥 WO Multas hardcoded en 0** — pendiente leer de match_events y fines

### PlayerDetailDrawer
Drawer con modos ver/editar y 3 tabs:
- **Datos personales** ✅: identidad, contacto, info laboral/salud. Edad calculada desde birthDate
- **Historial** ⏳ placeholder
- **Asistencia** ⏳ placeholder

### RosterImportDialog
Modal de importacion masiva:
- Plantilla descargable (xlsx/csv)
- Drag & drop o click para subir
- Auto-deteccion de columnas (normaliza acentos y aliases)
- Auto-mapeo de posiciones ("Defensa" → CB, "Volante derecho" → RW)
- Valida formato fecha, detecta duplicados en BD y archivo
- Preview con errores inline + "Eliminar invalidos"
- Importacion secuencial con progreso

---

## 4. Partidos ✅

### PartidosManager (`/partidos` o `/gestionar/partidos`)
- Header: boton "Generar fixture" / "Regenerar fixture" (con confirmacion si ya existe)
- Selector horizontal de jornadas (J1, J2, J3...) con badge `finished/total`
- Lista de partidos agrupados por grupo dentro de la jornada activa

### MatchCard
Layout: `Local | marcador o VS | Visitante`
- Footer: status pill, fecha+hora, cancha, arbitro
- Botones: Eventos (drawer) / Cargar resultado / Programar / Eliminar

### ScheduleDialog
Drawer para programar: fecha + hora, cancha (dropdown venues), arbitro (dropdown referees), status

### FinalizeDialog
Modal con 2 inputs grandes para marcador (home_score, away_score). Al confirmar → `PATCH /matches/:id/finalize`

### MatchEventsDrawer
Drawer ancho con 4 secciones:
- **MVP**: selector unico de jugador, badge dorado
- **Goles**: form (Equipo · Jugador · Asistente · Minuto) + lista de goles
- **Tarjetas**: form con switch yellow/red + lista
- **Sustituciones**: form (Equipo · Sale · Entra · Minuto) + lista

Selectores de jugador leen `registration_players` de cada team del partido. Auto-fines disparados al crear tarjetas.

---

## 5. Grupos y Llaves ✅

### GruposManager (`/grupos-llaves` o `/gestionar/grupos`)
- Header: "Sortear equipos", "Generar desde formato", "+ Nuevo grupo"
- Stats card: N grupos · M aprobados · K sin asignar
- Grid responsive (1/2/3 cols) de GroupCards
- Pool "Equipos sin grupo" con chips para asignar

### GroupCard
- Header: "Grupo X" + ocupacion (ej. 4/6)
- Capacidad visual (verde/ambar/rojo segun ocupacion)
- Lista de equipos asignados
- Edicion inline: nombre, codigo, maxTeams
- Drawer "Asignar equipos" desde pool

### BracketManager (`/gestionar/bracket`) ✅
- Header: icono Swords + "Fase eliminatoria" + stats (N llaves · M rondas)
- Botón "Generar llaves" (estado vacío) / "Resetear" (estado con bracket)
- Tabs de copas (si multi-cup): botones coloreados por copa activa
- Vista horizontal del bracket: una columna por ronda (Octavos → Cuartos → Semis → Final)
- Round header: badge con label (Final tiene icono Trophy dorado)
- **SlotCard**: card de 192px con dos TeamRows separadas por línea
  - TeamRow: logo (5x5) + nombre truncado + score tabular + penaltis + Trophy si ganador
  - Ganador: fondo verde, nombre bold, icono Trophy
  - Perdedor: opacidad 50%
  - Sin equipo: "Por definir" en italic
- Estado vacío: card dashed con CTA "Completa la fase de grupos y luego genera las llaves"
- Confirmación destructiva: `confirm()` antes de resetear

---

## 6. Tabla y Reclasificacion ✅

### TablaManager (`/tabla` o `/gestionar/tabla`)
Vista con tabs (no panel izq/der):

**Tab Grupos** (si hay grupos):
- Una tabla por grupo
- Columnas: # · Equipo · PJ · PG · PE · PP · GF · GC · DG · Pts
- Layout `table-fixed` con `colgroup`, equipo al 30%
- Lider marcado con trofeo dorado
- Clasificados con fondo verde
- Tarjetas reales leidas de match_events

**Tab Reclasificacion**:
- Tabla general consolidada cross-grupos
- Columnas adicionales: Grupo (badge) · Destino (Copa A/B con chip coloreado + seed)
- Distribucion segun format_config (qualifiersPerGroup, cups from/to)

Auto-switch a "Reclasificacion" si no hay grupos (round_robin).

---

## 7. Pagos ✅

### PagosManager (`/pagos` o `/gestionar/pagos`)

**Header con balance** (4 cards):
| Card | Descripcion | Color |
|------|-------------|-------|
| Recaudado | Sum verified payments | Verde |
| Por cobrar | Expected - paid | Rojo |
| Inscripciones | Teams pagadas / total | Azul |
| Multas | Multas pendientes | Naranja |

- Linea inferior: balance neto destacado

**3 tabs**:

**Tab Inscripciones**: tabla por team con tarifa / pagado / saldo + boton "Registrar pago" (modal con monto preset al saldo)

**Tab Multas y sanciones**: tabla con concept/sancion/monto/status + botones rapidos ✓ pagar / ✗ perdonar.
- Modal nueva multa: selector de team aprobado, jugador desde plantilla o manual, partido del equipo (opcional), monto, sancion, fechas suspension

**Tab Movimientos**: cronologia de todos los payments con tipo/monto/status

---

## 8. Canchas (`/canchas`) ✅

### VenuesManager
- Grid de cards: foto, nombre, direccion, badge "N canchas" si pitchCount > 1
- Drawer crear/editar: foto + nombre + direccion + ciudad + N° canchas + lat/lng (colapsable)

---

## 9. Arbitros (`/arbitros`) ✅

### RefereesManager
- Tabla simple: nombre + licencia + telefono (link `tel:`)
- Drawer crear/editar

---

## 10. Reportes (`/reportes`) ⏳

Pagina vacia. Planeado:
- Estadisticas de goleadores (top scorers)
- Reporte financiero por torneo
- Boleta de partido
- Listado de inscritos
- Exportacion PDF/Excel

---

## 11. Configuracion (`/config`) ⏳

Pagina vacia. Planeado:
- Datos de la organizacion
- Conceptos de pago y montos default de multas
- Usuarios y roles (multi-usuario por org)
- Preferencias generales

---

## Patrones de UI recurrentes

### Drawer lateral
```
Overlay negro/30 z-40 + aside fixed right-0 max-w-md bg-white shadow-2xl z-50
Header sticky + form scrolleable + footer sticky con botones
```

### Modal
```
Overlay negro/40 z-40 + div centered max-w-md bg-white rounded-2xl shadow-2xl
max-h-[90vh] overflow-y-auto
```

### Status pills
```
inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-bold border
+ dot indicator (w-1.5 h-1.5 rounded-full)
```

### Empty states
```
flex flex-col items-center justify-center gap-3 py-16
bg-white rounded-2xl border-2 border-dashed border-slate-200
Icono + mensaje + CTA opcional
```

### KPI Cards
Fondo blanco, borde sutil. Label pequeño arriba (uppercase, muted). Valor grande (bold). Sub-texto.

### Breadcrumbs
Link con ChevronLeft al backHref + separador + titulo actual.
Desde gestionar: back a `/torneos/edicion/[id]/gestionar`. Desde sidebar: back a `/`.
