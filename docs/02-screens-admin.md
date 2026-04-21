# Moverix Admin — Especificación de Pantallas

## Layout Global
- **Sidebar fijo** (izquierda, ~200px): logo, navegación, perfil usuario
- **Header** (top): torneo activo, buscador, notificaciones
- **Contenido principal** (resto): varía por módulo
- **Panel derecho** (opcional, Dashboard): alertas y acciones rápidas

---

## 1. Dashboard

### KPI Cards (fila superior, 5 tarjetas)
| Card | Valor | Sub-info | Color |
|------|-------|----------|-------|
| Torneos Activos | 3 | "2 en curso" | Azul |
| Equipos Inscritos | 96 | "CASB + Copa" | Verde |
| Pagos Pendientes | 14 | "$1.4M adeudado" | Rojo |
| Partidos Hoy | 8 | "C.Norte + C.Sur" | Azul |
| Sin Resultado | 3 | "Cargar resultado" | Naranja |

### Tabla "Estado por Torneo"
Columnas: Torneo | Fase | Eqs | Jugados | Pend. | Recaud.
- Enlace "Ver todos →"

### Sección "Partidos Hoy"
- Lista compacta: hora, local, resultado/score, visitante, cancha, estado-badge
- Enlace "Ver Fixture →"

### Panel Derecho
- **Alertas**: lista de items con icono de advertencia
  - Ejemplos: "4 equipos sin pago", "Llaves Copa B sin generar", "3 resultados por cargar"
- **Recaudo General**: barra de progreso con total y pendientes
- **Acciones Rápidas**: lista de shortcuts
  - + Crear torneo
  - Registrar resultado
  - Gestionar grupos
  - Aprobar inscripción
  - Ver pagos pendientes

---

## 2. Equipos

### KPI Cards (4)
- Total Equipos | Al día (verde) | Con deuda (naranja) | Críticos (rojo)

### Controles
- Buscador: "Buscar equipo..."
- Filtros pill: Todos | Al día | Deuda | Crítico
- Botones: `+ Agregar equipo` (verde) | `Exportar`

### Tabla de Equipos
| Columna | Tipo |
|---------|------|
| Equipo | Logo + nombre + delegado |
| GRP | Badge grupo (Grp A, B…) |
| Delegado | Texto |
| Sede Pref. | Texto (C. Norte, C. Sur) |
| PJ | Número (partidos jugados) |
| PG | Número (partidos ganados) |
| PP | Número (partidos perdidos) |
| Pagado | Monto en verde |
| Pendiente | Monto en rojo (si aplica) |
| Multas | Monto en naranja (si aplica) |
| Estado | Badge: Al día / Deuda / Crítico |

### Acciones por fila
- Click en equipo → detalle del equipo

---

## 3. Partidos

### Sub-tabs
- **Fase de Grupos** | **Llaves**

### KPI Cards (4)
- Total Partidos | Jugados (verde) | Pendientes (naranja) | Fechas completadas (X/Y)

### Controles
- `Generar fixture` (verde) | `Exportar PDF`

### Vista por Fechas (acordeón)
Cada Fecha muestra:
- Header: `{N}` | "Fecha N — Día DD Mes" | badge estado (Completada/En curso/Programada)
- Sub-info: "X partidos · Y finalizados · Z en curso"
- Tabla de partidos:

| Col | Tipo |
|-----|------|
| Hora | Texto (08:00) |
| Local | Nombre equipo (alineado derecha) |
| Resultado | Badge con score (2-1) o VS |
| Visitante | Nombre equipo |
| Cancha | F1, F2… |
| Árbitro | Apellido |
| Estado | Badge: Finalizado / En curso / Programado |
| Acción | "Ver acta" link + icono editar |

**Marcadores especiales:**
- `EN VIVO` badge naranja parpadeante
- `VS` para partidos sin resultado aún

---

## 4. Grupos y Llaves

### Sub-tabs
- **Grupos** | **Llaves**

### Tab: Grupos
- Info: "X grupos · Y equipos"
- Botones: `Regenerar automático` | `Confirmar grupos` (verde)
- Grid de tarjetas de grupos (A-H), cada una:
  - Header: "Grupo X" + contador (6/6)
  - Lista de equipos con handle de arrastre (drag & drop)
- Nota: "Arrastra equipos entre grupos para reorganizar · Confirmar grupos bloquea el sorteo"

### Tab: Llaves
- Sub-tabs de copa: `Copa A` | `Copa B`
- Botones: `Generar llaves` | `Exportar PDF`
- **Vista bracket** de izquierda a derecha:
  - Octavos → Cuartos → Semis → Final (trofeo)
  - Cada cruce muestra equipo + resultado (o "?" si pendiente)
  - Equipos clasificados en verde, eliminados en gris

---

## 5. Tabla y Reclasificación

### Panel Izquierdo — Tabla por Grupo
- Selector de grupo: dropdown "Grupo A"
- Tabs de grupos: Grp A | Grp B | Grp C | …
- Tabla de posiciones:

| Col | |
|-----|-|
| # | Posición |
| Equipo | Logo + nombre |
| PJ | Jugados |
| PG | Ganados |
| PE | Empates |
| PP | Perdidos |
| GF | Goles a favor |
| GC | Goles en contra |
| PTS | Puntos (destacado) |

- Top 4 clasifican en verde, resto en gris
- Nota: "Top 4 clasifican a siguiente fase"

### Panel Derecho — Reclasificación General
- Total: "48 equipos"
- Lista rankeada: # | Logo | Equipo | Grp | Pts | Asignación Copa
- Badges de copa: `Copa A` (verde) | `Copa B` (azul)
- Leyenda: 1-16 Copa A | 17-32 Copa B | 33-48 Eliminado (rojo)

---

## 6. Pagos

### KPI Cards (4)
| Card | Valor | Color |
|------|-------|-------|
| Total Esperado | $7.2M | Gris |
| Total Recaudado | $5.8M | Verde |
| Pendiente | $1.4M | Rojo |
| Multas Acumuladas | $240K | Naranja |

### Barra de Recaudo
- Progress bar: 80% recaudado | "14 equipos pendientes"

### Controles
- Filtros: Todos | Pendientes | Pagados | Sin pago
- Botones: `+ Registrar pago` (verde) | `Exportar Excel`

### Tabla de Pagos
| Columna | Tipo |
|---------|------|
| Equipo | Nombre |
| Concepto | Texto (Inscripción completa, Separación + saldo, W.O., etc.) |
| Valor | Monto total |
| Pagado | Monto pagado (verde) |
| Pend. | Monto pendiente (rojo) |
| Fecha | Fecha de pago |
| Estado | Badge: Pagado / Parcial / Sin pago |

---

## 7. Torneos y Ligas

### Controles
- `+ Nueva liga` (verde, top right)
- Info: "X ligas · Y ediciones en total"

### Lista de Ligas
Cada liga es un card expandible:
- Icono + Nombre + subtítulo (deporte · género · organización)
- Contador de ediciones + estado badge (En curso / Finalizado)
- `+ Nueva edición` button
- Ediciones horizontales (cards):
  - Temporada YYYY - I/II
  - Badge estado (En curso / Finalizado)
  - # equipos | fase actual | campeón (si finalizó)
  - `Gestionar edición →` (solo en edición activa)
- Histórico de liga: eds | eqs | partidos | goles

---

## 8. Reportes (por implementar)
- Estadísticas de goleadores
- Reporte financiero por torneo
- Exportación de datos

## 9. Configuración (por implementar)
- Datos de la organización
- Canchas / sedes
- Árbitros
- Conceptos de pago
- Usuarios y roles
