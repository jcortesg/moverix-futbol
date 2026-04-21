# Moverix — Visión General del Producto

## Problema que Resuelve
Las ligas y torneos de fútbol amateur se gestionan manualmente (WhatsApp, Excel, cuadernos). Moverix digitaliza toda la operación: inscripciones, fixture, resultados, tabla de posiciones y cobros.

## Usuarios
| Rol | Descripción |
|-----|-------------|
| Super Admin | Gestiona toda la plataforma, puede crear ligas |
| Organizador | Administra su liga/torneo específico |
| Delegado | Representa a un equipo, registra pagos y novedades |
| Jugador | Consulta fixture, tabla y resultados (app móvil) |

## Productos
1. **Backoffice Admin (web)** — fase 1, prioridad
2. **App móvil** — fase 2

---

## Módulos del Backoffice Admin

### Estructura de Navegación
```
TORNEO ACTIVO (contextual al torneo seleccionado)
├── Dashboard
├── Equipos
├── Partidos
├── Grupos y Llaves
├── Tabla
└── Pagos

GENERAL
├── Torneos
├── Reportes
└── Config
```

### Contexto Activo
El header siempre muestra el torneo activo seleccionado (ej. "Liga CASB 2025"). Todo el menú "TORNEO ACTIVO" es contextual a ese torneo.

---

## Modelo de Datos Conceptual

### Liga
- Nombre, deporte (F8/F11/F5), género, organizador/federación
- Tiene múltiples Ediciones (temporadas)

### Edición (Torneo)
- Referencia a Liga
- Fechas inicio/fin, estado (Inscripción | En curso | Finalizado)
- Formato: Grupos + Llaves, solo Grupos, solo Llaves
- Número de equipos, número de grupos

### Equipo
- Nombre, logo, delegado (nombre + contacto)
- Sede preferida
- Inscrito en una o más ediciones

### Inscripción
- Equipo + Edición
- Estado de pago, monto, multas
- Grupo asignado

### Partido
- Equipo local + visitante
- Fecha, hora, cancha, árbitro
- Resultado (goles local / goles visitante)
- Estado: Programado | En curso | Finalizado
- Pertenece a una Fecha (jornada)

### Fecha (Jornada)
- Número, fecha, estado (Programada | En curso | Completada)
- Pertenece a una Edición

### Grupo
- Nombre (A, B, C…)
- Equipos asignados (muchos-a-muchos)
- Pertenece a una Edición

### Llave (Bracket)
- Copa (A, B, C…)
- Rondas: Octavos, Cuartos, Semis, Final
- Cruces (partido de llave)

### Pago
- Equipo + Edición
- Concepto (inscripción, separación, multa, W.O.)
- Monto total, pagado, pendiente
- Estado: Pagado | Parcial | Sin pago
- Fecha de pago

---

## Estados de Equipos (Pagos)
| Estado | Color | Descripción |
|--------|-------|-------------|
| Al día | Verde | Sin deuda pendiente |
| Deuda | Naranja | Pago parcial |
| Crítico | Rojo | Sin pago registrado o muy atrasado |

## Estados de Partidos
| Estado | Color | Descripción |
|--------|-------|-------------|
| Programado | Gris | No ha comenzado |
| En curso / EN VIVO | Naranja | En progreso |
| Finalizado | Verde | Con resultado registrado |
