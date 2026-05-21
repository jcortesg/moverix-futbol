# Moverix — Vision General del Producto

## Problema que Resuelve
Las ligas y torneos de futbol amateur se gestionan manualmente (WhatsApp, Excel, cuadernos). Moverix digitaliza toda la operacion: inscripciones, fixture, resultados, tabla de posiciones y cobros.

## Usuarios

| Rol | Descripcion | Implementacion actual |
|-----|-------------|----------------------|
| Owner / Super Admin | Crea la organizacion, gestiona toda la plataforma | `organizations.owner_uid` — acceso total |
| Organizador | Administra su liga/torneo especifico | Mismo owner (no hay multi-usuario por org aun) |
| Director / Delegado | Representa a un equipo, registra jugadores | `teams.director_uid` — puede crear/editar su team |
| Jugador | Consulta fixture, tabla y resultados | Fase 2 (app movil) |

> **Nota**: El sistema de roles (`@Roles()` decorator) existe en el backend pero no tiene enforcement real. Hoy todo usuario autenticado con token Firebase valido tiene acceso a los endpoints (excepto restricciones puntuales como "solo el director puede editar su team").

## Productos
1. **Backoffice Admin (web)** — fase 1, en produccion
2. **API REST** — backend compartido
3. **App movil** — fase 2, scaffold basico con Expo

---

## Modulos del Backoffice Admin

### Estructura de navegacion
```
TORNEO ACTIVO (contextual a la edicion seleccionada)
├── Dashboard          → vacio
├── Equipos            → inscripciones + roster + importacion
├── Partidos           → fixture + resultados + eventos
├── Grupos y Llaves    → generacion + sorteo
├── Tabla              → posiciones + reclasificacion
└── Pagos              → inscripciones + multas + balance

GENERAL
├── Torneos            → ligas + ediciones (CRUD + wizard)
├── Canchas            → sedes con foto
├── Arbitros           → catalogo
├── Reportes           → vacio
└── Config             → vacio
```

### Contexto activo
El header muestra la edicion activa (ej. "Liga CASB 2025-I"). Todo el menu "TORNEO ACTIVO" es contextual a esa edicion. Se persiste en `localStorage` y se sincroniza entre tabs del navegador.

---

## Modelo de Datos

### Organization
Tenant raiz. Dueña de leagues, venues, referees.
- Campos: name, slug (unique), logo, city, country, owner_uid, active

### League (Liga)
Liga persistente dentro de una organizacion. Puede tener multiples ediciones.
- Campos: name, slug (unique por org), sport_format (F5/F8/F11), gender (M/F/Mixed), logo, banner

### Edition (Edicion / Torneo)
Temporada concreta de una liga (ej. "2025-I", "Copa Verano").
- Campos: name, season (unique por liga), status, format_config (JSONB), tiebreaker_rules (JSONB), max_teams, registration_fee, prize_pool, currency
- Status: `draft → registration → active → finished`
- format_config soporta: groups_knockout, groups_multi_cup, round_robin_playoffs, knockout_only, round_robin_only

### Team (Equipo)
Equipo creado por un jugador/DT. **Global** — no pertenece a una org. Se inscribe a ediciones via registrations.
- Campos: name, short_name, director_uid, logo, colores primario/secundario, city
- El director (owner) es quien puede editar/eliminar el team

### Registration (Inscripcion)
Relacion team ↔ edition. Cada team puede inscribirse una vez por edicion.
- Campos: status (pending/approved/rejected/withdrawn), group_id, seed_rank, paid_at, approved_at
- Constraint: UNIQUE(edition_id, team_id)

### Registration Player (Plantilla)
Jugadores de un team **para una edicion especifica**. Un jugador puede estar en plantillas de distintas ediciones.
- Campos: player_uid, player_name, first_name, last_name, doc_number, birth_date, employer, phone, email, health_provider, jersey_number, position, is_captain
- Importacion masiva via CSV/Excel

### Group (Grupo)
Agrupacion de equipos (Grupo A, B, C...) dentro de una edicion.
- Campos: name, code, phase, max_teams, order
- Generacion automatica desde format_config + sorteo con seed_rank

### Venue (Cancha / Sede)
Sede deportiva reusable entre ediciones. Pertenece a la organizacion.
- Campos: name, address, city, lat/lng, pitch_count, photo

### Referee (Arbitro)
Catalogo de arbitros de la org. Se asignan a partidos.
- Campos: full_name, phone, license_number, photo (UI no expuesta aun)

### Matchday (Jornada)
Agrupacion temporal de partidos dentro de una edicion.
- Campos: number, name, phase, scheduled_date

### Match (Partido)
Partido individual entre dos equipos.
- Campos: home/away team, venue, referee, status, scores, penalties, scheduled_at, is_neutral, round
- Status: scheduled, live, finished, postponed, cancelled, walkover
- Generacion automatica de fixture round-robin (algoritmo Berger)

### Match Event (Evento de partido)
Goles, tarjetas, sustituciones, MVP dentro de un partido.
- Tipos: goal, own_goal, yellow_card, red_card, substitution, penalty_scored, penalty_missed, mvp
- Auto-genera multas al registrar tarjetas (roja → fine automatica, amarilla acumulada cada 3)
- Constraint: un solo MVP por partido

### Bracket Slot (Llave eliminatoria)
Posicion en un cuadro eliminatorio. Schema listo, modulo pendiente.
- Campos: cup_name, round, slot, match_id, home/away team, winner_id, next_slot_id

### Payment (Pago)
Registro de pagos del torneo.
- Campos: edition_id, team_id, registration_id, fine_id, type (registration/fine/other), amount, currency, status (pending/verified/rejected), receipt_url, verified_at/by
- Soporta pagos parciales de inscripcion

### Fine (Multa)
Multas y sanciones disciplinarias.
- Campos: edition_id, team_id, match_id, player_uid, concept, reason, amount, currency, status (pending/paid/waived), sanction, matches_banned, appealed
- Concepts: yellow_card, yellow_card_accumulation, red_card, walkover, late_arrival, misconduct, team_misconduct, other
- Al marcar como `paid`, se crea automaticamente un payment verificado

### Standings (Tabla de posiciones)
**No tiene tabla propia** — se computa on-the-fly desde matches finalizados + match_events.
- Ordenamiento configurable via tiebreaker_rules de la edicion

### Player Profile / Player Stats (Fase 2)
Perfil global y stats por edicion. Schema creado, modulos vacios.

---

## Flujos principales

### Flujo de creacion de torneo
1. Owner crea Organization (o ya tiene una)
2. Crea League dentro de la org
3. Crea Edition (wizard 4 pasos: basico → equipos → formato → resumen)
4. Inscribe teams (buscar existente o crear nuevo)
5. Aprueba inscripciones + asigna grupos
6. Genera fixture automatico (Berger round-robin)
7. Programa partidos (fecha, cancha, arbitro)
8. Registra resultados y eventos
9. Tabla de posiciones se calcula automaticamente

### Flujo de onboarding
Si el usuario no tiene organizacion → wizard 3 pasos: crear org → crear liga → crear primera edicion.

### Flujo de pagos
1. Equipos inscritos tienen tarifa de inscripcion (de la edicion)
2. Admin registra pagos (manuales, con monto)
3. Multas se generan automaticamente desde tarjetas o manualmente
4. Al pagar multa → se crea payment verificado automatico
5. Balance general: recaudado vs por cobrar

---

## Estados

### Edicion
| Estado | Descripcion |
|--------|-------------|
| draft | Borrador, configuracion inicial |
| registration | Inscripciones abiertas |
| active | Torneo en curso |
| finished | Torneo finalizado |

### Inscripcion (Registration)
| Estado | Descripcion |
|--------|-------------|
| pending | Solicitud enviada |
| approved | Aprobada por el admin |
| rejected | Rechazada |
| withdrawn | Retirada |

### Partido (Match)
| Estado | Color badge | Descripcion |
|--------|-------------|-------------|
| scheduled | slate | Programado, sin jugar |
| live | amber (animado) | En curso |
| finished | green | Con resultado registrado |
| postponed | amber | Aplazado |
| cancelled | red | Cancelado |
| walkover | red | W.O. |

### Pago (Payment)
| Estado | Color badge | Descripcion |
|--------|-------------|-------------|
| pending | amber | Sin verificar |
| verified | green | Verificado por admin |
| rejected | red | Rechazado |

### Multa (Fine)
| Estado | Descripcion |
|--------|-------------|
| pending | Sin pagar |
| paid | Pagada (genera payment auto) |
| waived | Perdonada |
