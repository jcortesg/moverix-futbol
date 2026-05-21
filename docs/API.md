# Moverix — Catalogo de API

API REST de Moverix (`apps/api`). Todos los endpoints requieren `Authorization: Bearer <firebase_id_token>` salvo los marcados como `@Public()`.

**Base URL** (dev): `http://localhost:3001/ftb/v1`
**Swagger**: `http://localhost:3001/ftb/docs`

## Convenciones de respuesta

- `200` — OK con payload JSON
- `201` — Creado (POSTs)
- `204` — No Content (DELETE)
- `400` — Bad Request (validacion, reglas de negocio)
- `401` — Unauthorized (token invalido/expirado)
- `403` — Forbidden (no autorizado)
- `404` — Not Found
- `409` — Conflict (unique violation)
- `429` — Too Many Requests (throttle: 100 req/60s)
- `500` — Internal Server Error

## Errores

```json
{
  "statusCode": 400,
  "message": ["amount must not be less than 0"],
  "error": "Bad Request"
}
```

`message` puede ser string o array (validacion class-validator).

---

## Tabla de endpoints

### Health
| Metodo | Ruta | Descripcion |
|---|---|---|
| GET | `/health` | Publica. Status del servicio |

### Auth
| Metodo | Ruta | Descripcion |
|---|---|---|
| POST | `/auth/me` | Devuelve los claims del token actual |

### Organizations
| Metodo | Ruta | Descripcion |
|---|---|---|
| POST | `/organizations` | Crear org (ownerUid del token) |
| GET | `/organizations` | Lista del usuario actual (filtra por ownerUid) |
| GET | `/organizations/:id` | Detalle |
| PATCH | `/organizations/:id` | Actualizar |
| DELETE | `/organizations/:id` | Hard delete (cascade) |
| POST | `/organizations/:id/logo` | Multipart `file` (max 5MB) |

### Leagues
| Metodo | Ruta | Descripcion |
|---|---|---|
| POST | `/leagues` | Crear. Pre-check + catch 23505 → 409 |
| GET | `/leagues?organizationId=` | Lista por org |
| GET | `/leagues/:id` | Detalle |
| PATCH | `/leagues/:id` | Actualizar. Si cambia slug, valida unicidad |
| DELETE | `/leagues/:id` | Cascade |
| POST | `/leagues/:id/logo` | Upload (max 5MB, resize cliente) |
| POST | `/leagues/:id/banner` | Upload (max 5MB) |

### Editions
| Metodo | Ruta | Descripcion |
|---|---|---|
| POST | `/editions` | Crear (valida unicidad season en liga) |
| GET | `/editions?leagueId=` | Lista por liga |
| GET | `/editions/:id` | Detalle |
| PATCH | `/editions/:id` | Actualizar |
| DELETE | `/editions/:id` | Cascade |
| POST | `/editions/:id/logo` | Upload |
| POST | `/editions/:id/banner` | Upload |

### Teams
| Metodo | Ruta | Descripcion |
|---|---|---|
| POST | `/teams` | Crear (acepta `directorEmail` opcional para ceder ownership) |
| GET | `/teams/mine` | Teams donde soy director |
| GET | `/teams/search?q=` | Busqueda global (min 2 chars, max 20 resultados) |
| GET | `/teams/:id` | Detalle |
| PATCH | `/teams/:id` | Solo director |
| DELETE | `/teams/:id` | Solo director |
| POST | `/teams/:id/logo` | Upload (cualquier admin autenticado puede subir) |

### Registrations
| Metodo | Ruta | Descripcion |
|---|---|---|
| POST | `/registrations` | Inscribir team |
| GET | `/registrations?editionId=` | Lista con team joineado |
| GET | `/registrations/mine` | Mis teams (donde soy director) |
| GET | `/registrations/:id` | Detalle con team |
| PATCH | `/registrations/:id` | status, groupId, seedRank, paidAt |
| DELETE | `/registrations/:id` | Director del team o quien registro |

### Registration Players (Roster)
| Metodo | Ruta | Descripcion |
|---|---|---|
| POST | `/registration-players` | Agregar jugador (409 si email/cedula duplicado en roster) |
| GET | `/registration-players?registrationId=` | Roster ordenado por dorsal |
| GET | `/registration-players/:id` | Detalle |
| PATCH | `/registration-players/:id` | Editar |
| DELETE | `/registration-players/:id` | Quitar del roster |

### Groups
| Metodo | Ruta | Descripcion |
|---|---|---|
| POST | `/groups` | Crear grupo manual |
| POST | `/groups/generate` | Auto desde formatConfig.phase1 (Grupo A...Z) |
| POST | `/groups/draw` | Sortear (mode 'all' o 'unassigned', respeta seedRank) |
| GET | `/groups?editionId=` | Lista ordenada por order, code |
| GET | `/groups/:id` | Detalle |
| PATCH | `/groups/:id` | Editar |
| DELETE | `/groups/:id` | Hard delete (teams quedan con groupId=null) |

### Venues
| Metodo | Ruta | Descripcion |
|---|---|---|
| POST | `/venues` | Crear |
| GET | `/venues?organizationId=` | Lista ordenada por name |
| GET | `/venues/:id` | Detalle |
| PATCH | `/venues/:id` | Actualizar |
| DELETE | `/venues/:id` | Borra foto del storage |
| POST | `/venues/:id/photo` | Upload |

### Referees
| Metodo | Ruta | Descripcion |
|---|---|---|
| POST | `/referees` | Crear |
| GET | `/referees?organizationId=` | Lista |
| GET | `/referees/:id` | Detalle |
| PATCH | `/referees/:id` | Actualizar |
| DELETE | `/referees/:id` | Eliminar |

### Matchdays
| Metodo | Ruta | Descripcion |
|---|---|---|
| POST | `/matchdays` | Crear |
| GET | `/matchdays?editionId=` | Lista ordenada por number asc |
| GET | `/matchdays/:id` | Detalle |
| PATCH | `/matchdays/:id` | Actualizar |
| DELETE | `/matchdays/:id` | Eliminar |

### Matches
| Metodo | Ruta | Descripcion |
|---|---|---|
| POST | `/matches` | Crear partido manual |
| GET | `/matches?editionId=` | Todos con matchdayNumber joineado |
| GET | `/matches?matchdayId=` | De una jornada |
| GET | `/matches/:id` | Detalle |
| PATCH | `/matches/:id` | Programar/cambiar (fecha, cancha, arbitro, status) |
| PATCH | `/matches/:id/finalize` | Setea marcador + status='finished' + finishedAt |
| DELETE | `/matches/:id` | Eliminar |
| POST | `/matches/generate-fixture` | Auto Berger round-robin (force=true para regenerar) |

### Match Events
| Metodo | Ruta | Descripcion |
|---|---|---|
| POST | `/match-events` | Crear (auto-fines en yellow/red) |
| GET | `/match-events?matchId=` | Ordenados por minuto asc |
| GET | `/match-events/:id` | Detalle |
| PATCH | `/match-events/:id` | Editar |
| DELETE | `/match-events/:id` | Eliminar |
| POST | `/match-events/mvp` | Upsert MVP del partido |
| DELETE | `/match-events/mvp/:matchId` | Quitar MVP |

### Standings
| Metodo | Ruta | Descripcion |
|---|---|---|
| GET | `/standings?editionId=` | Tabla por grupo (con tiebreakers aplicados) |
| GET | `/standings/qualifiers?editionId=` | Clasificados con seed |

### Payments
| Metodo | Ruta | Descripcion |
|---|---|---|
| POST | `/payments` | Crear pago manual |
| GET | `/payments?editionId=` | Lista con team joineado |
| GET | `/payments?editionId=&teamId=` | Pagos de un team |
| GET | `/payments/summary?editionId=` | Agregados financieros |
| GET | `/payments/:id` | Detalle |
| PATCH | `/payments/:id` | Actualizar (auto verifiedAt+By al verificar) |
| DELETE | `/payments/:id` | Eliminar |

### Fines
| Metodo | Ruta | Descripcion |
|---|---|---|
| POST | `/fines` | Crear |
| GET | `/fines?editionId=` | Lista con team joineado |
| GET | `/fines/:id` | Detalle |
| PATCH | `/fines/:id` | Actualizar (al `paid` crea payment auto) |
| DELETE | `/fines/:id` | Eliminar |

### Uploads (infraestructura)
| Metodo | Ruta | Descripcion |
|---|---|---|
| GET | `/uploads/*` | Publica. Proxy a GCS con cache headers (solo prod) |

---

## Convenciones de query

- **Filtros**: query params (`?editionId=...&status=...`)
- **Sorting**: por defecto en cada endpoint (no expuesto al cliente)
- **Paginacion**: no implementada — todos los endpoints devuelven todo

## Multipart uploads

Endpoints `*/logo`, `*/banner`, `*/photo`:
```
POST /<entity>/<id>/<asset>
Content-Type: multipart/form-data; boundary=...
form field: file
```

**Cliente axios**: NO setear `Content-Type` manualmente. Pasar solo el `FormData` y dejar que axios calcule boundary.

**Resize en cliente** (antes de subir):
- Logos: max 512px
- Banners: max 1200px
- Reencoding JPEG 0.9 (PNG si tiene alpha)

---

## Auto-comportamientos

### Trigger updated_at
Cualquier UPDATE en 13 tablas dispara `updated_at = NOW()` automatico via trigger PostgreSQL.

### Auto-payment al pagar fine
Al `PATCH /fines/:id { status: 'paid' }`, el service crea un `payment` `type='fine' status='verified'` por el monto.

### Auto-fines al crear match-event de tarjeta
- **Roja** + playerUid: fine `concept='red_card'`, amount=50000, sancion='Suspension 1 partido', matchesBanned=1
- **Amarilla** + playerUid, acumulada (multiplo de 3): fine `concept='yellow_card_accumulation'`, amount=30000, matchesBanned=1
- Idempotentes por `(matchId, playerUid, concept)`. Best-effort (errores no rompen la creacion del evento).

### Auto-approvedAt en registrations
Al cambiar status a 'approved', se setea `approved_at` automaticamente.

---

## Payment summary endpoint

`GET /payments/summary?editionId=...` devuelve:

```ts
{
  edition: { id, name, season, currency, registrationFee, maxTeams, teamsApproved }
  registrations: {
    expected,        // teamsApproved * registrationFee
    paid,            // sum verified registration payments
    pending,         // expected - paid
    teamsPaid,       // count teams cuyo total >= fee
    teamsPending
  }
  fines: { issued, paid, pending, waived }
  totals: { income, pending }
}
```

---

## Errores especificos del dominio

| Endpoint | Error | Causa |
|---|---|---|
| POST /leagues | 409 | Slug duplicado en la org |
| POST /editions | 409 | Season duplicada en la liga |
| POST /registrations | 409 | Team ya inscrito en la edicion |
| POST /registration-players | 409 | Email o cedula ya existen en el roster |
| POST /match-events (mvp) | 409 | Ya hay un MVP. Usar `POST /match-events/mvp` que upsert |
| POST /matches/generate-fixture | 400 | Sin grupos, formato no soporta, fixture ya existe (sin force) |
| POST /groups/generate | 400 | Formato no es `groups`, ya hay grupos |
| POST /groups/draw | 400 | Sin grupos o sin equipos aprobados |

---

## Ejemplos curl

### Listar organizaciones

```bash
TOKEN="eyJhbGciOiJSUzI1NiIs..."

curl -H "Authorization: Bearer $TOKEN" http://localhost:3001/ftb/v1/organizations
```

### Crear edicion

```bash
curl -X POST http://localhost:3001/ftb/v1/editions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "leagueId": "uuid-here",
    "name": "Temporada 2025-I",
    "season": "2025-I",
    "maxTeams": 16,
    "registrationFee": 50000,
    "currency": "COP",
    "formatConfig": {
      "type": "groups_knockout",
      "phase1": {"kind":"groups","groupCount":4,"teamsPerGroup":4,"qualifiersPerGroup":2,"doubleLeg":false},
      "phase2": {"kind":"knockout","bracketSize":8,"hasThirdPlace":false,"hasRepechage":false}
    },
    "tiebreakerRules": {
      "winPts": 3, "drawPts": 1, "lossPts": 0, "allowDraw": true,
      "order": ["points","goalDiff","goalsFor","headToHead","yellowCards"]
    }
  }'
```

### Generar fixture

```bash
curl -X POST http://localhost:3001/ftb/v1/matches/generate-fixture \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"editionId": "uuid", "force": false}'
```

### Cargar resultado

```bash
curl -X PATCH http://localhost:3001/ftb/v1/matches/MATCH_ID/finalize \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"homeScore": 3, "awayScore": 1}'
```

### Subir logo (multipart)

```bash
curl -X POST http://localhost:3001/ftb/v1/teams/TEAM_ID/logo \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/path/to/logo.png"
```

---

## Resumen del progreso

**Endpoints implementados**: ~75 distribuidos en 15 modulos activos.

**Modulos con endpoints completos**: Organizations, Leagues, Editions, Teams, Registrations, Registration-Players, Groups, Matchdays, Matches, Match-Events, Standings, Payments, Fines, Venues, Referees

**Modulos stub (sin endpoints)**: Auth (vive en el guard global), Brackets, Players

**Endpoints pendientes**:
- Brackets (CRUD + generate + advance) — ~5 endpoints
- Player-stats (recompute + query) — ~3 endpoints
- Player-profiles (CRUD + follow/unfollow) — ~6 endpoints
- Match-fees (cuotas cancha/arbitraje) — ~4 endpoints
- Reports (endpoints especificos por reporte)
