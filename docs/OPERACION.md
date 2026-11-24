# Operación en producción (runbook)

Cómo se atienden los pedidos del día a día de los organizadores (llegan por WhatsApp:
TORNEOS CASB, Premier Cup, etc.) y cómo se despliega. Actualizado 2026-11-21.

> Regla: antes de borrar o mover datos, **mirar primero** (select) y contar. Los
> arreglos de varias filas van en una transacción (`-1` o `begin … commit`).

## 1. Acceso

| Qué | Cómo |
|---|---|
| Base de datos | `scripts/prod-db.sh` (necesita `cloud-sql-proxy`, `psql` y gcloud con sesión; levanta `cloud-sql-proxy` en el puerto 6543 — el 5433 lo usa un Docker de Vive Bolívar y abre psql) |
| Sesión gcloud vencida | `gcloud auth login` y reiniciar el proxy (`pkill -f cloud-sql-proxy`) |
| Firebase Auth (cuentas) | REST `identitytoolkit` con `gcloud auth print-access-token` + header `x-goog-user-project: moverix` |
| Logs API | `gcloud logging read 'resource.labels.service_name="moverix-api-production" severity>=ERROR' --project moverix --limit 20 --freshness 30m` |

Buscar una cuenta de Firebase por correo y corregir el nombre visible:

```bash
T=$(gcloud auth print-access-token)
curl -s -X POST "https://identitytoolkit.googleapis.com/v1/projects/moverix/accounts:lookup" \
  -H "Authorization: Bearer $T" -H "x-goog-user-project: moverix" -H "Content-Type: application/json" \
  -d '{"email":["correo@ejemplo.com"]}'            # o {"localId":["<uid>"]}
curl -s -X POST "https://identitytoolkit.googleapis.com/v1/projects/moverix/accounts:update" \
  -H "Authorization: Bearer $T" -H "x-goog-user-project: moverix" -H "Content-Type: application/json" \
  -d '{"localId":"<uid>","displayName":"Nombre Completo"}'
```

Cuando se corrige un nombre, corregirlo en **los tres lados**: `player_profiles` (perfil),
`registration_players.player_name` de sus nóminas y el `displayName` de Firebase.

## 2. Despliegue

Desde `plataforma/`. Producción corre la rama que se despliegue (no necesariamente `main`).

```bash
# API
gcloud builds submit --config apps/api/cloudbuild.yaml --project moverix
gcloud run services update moverix-api-production \
  --image us-central1-docker.pkg.dev/moverix/moverix/api@sha256:<digest-del-build> \
  --region us-central1 --project moverix

# Admin (el servicio que sirve admin-ftb.moverix.co / futbol.moverix.co es moverix-admin-production;
# el servicio "admin-ftb" no se usa)
gcloud builds submit --config apps/admin/cloudbuild.yaml --project moverix
gcloud run services update moverix-admin-production \
  --image us-central1-docker.pkg.dev/moverix/moverix/admin@sha256:<digest> \
  --region us-central1 --project moverix
```

- Desplegar por **digest** (`@sha256:…` que imprime el build), no por tag, para saber qué corre.
- Verificar: `curl https://api-ftb.moverix.co/ftb/v1/health` → 200 y revisar logs de errores.
  La URL `*.run.app` del admin responde 403: es normal (entra por el proxy nginx).
- Type-check antes de desplegar: `npx tsc --noEmit -p tsconfig.json` en `apps/api` y `apps/admin`.

## 3. Modelo de datos que más se toca

| Concepto | Dónde |
|---|---|
| Perfil del jugador | `player_profiles` (`uid` = Firebase uid, `full_name`, `doc_number`, `phone`, `deactivated_at`) |
| Equipo | `teams` (`director_uid` = delegado principal, `access_code`, `pending_delegate_email`) |
| Miembros del equipo | `team_members` (`player_uid`, `role` director \| player, `is_player`). Un delegado adicional = `role='director'`; si además juega, `is_player=true` |
| Inscripción de un equipo a un torneo | `registrations` (`edition_id`, `team_id`, `status`, `invite_code`) |
| Nómina | `registration_players`, único `(registration_id, player_uid)`; retirado = `removed_at` no nulo |
| Jugador sin cuenta | `player_uid = 'manual:<uuid>'` con `invite_code` (se genera al pedir el enlace) |
| Tope de jugadores | `editions.max_players_per_team` (hoy 31 en los torneos activos) |
| Árbitros / veedores del partido | `match_delegates` (`role` referee_1 \| delegate \| fourth; `uid` o `pending_email`) + `matches.referee_id` → `referees` (staff de la organización) |
| Multas | `fines` (`concept` red_card \| yellow_card \| yellow_card_accumulation \| other; `status` pending \| paid \| waived) |
| Tarifas de multas | `editions.fine_defaults` jsonb (`redCard`, `yellowCard`, `yellowAccumulation`, `yellowsForAccumulation`, `redCardMatchesBanned`, …). Si falta una clave rige el default de la API: amarilla 0, roja 50.000, acumulación 0 cada 3, 1 fecha |

Reglas de negocio vigentes (en la API):

- **Tope de nómina en cada alta** (`apps/api/src/common/utils/roster-capacity.ts`): crear, restaurar,
  agregar en lote, agregar por delegado y unirse con código. Si alguien entra con el código y la
  nómina está llena, queda en el equipo pero no en la nómina.
- **Multas de tarjetas sincronizadas**: al editar o borrar una tarjeta en un partido se borran
  las multas *pendientes* que ya no tienen tarjeta (`dropOrphanCardFines` en match-events).
- `GET registration-players/delegates?registrationId=` devuelve los delegados (principal / adicional,
  si están en la nómina) — el admin los marca en la planilla, el PDF y el Excel.

## 4. Recetas SQL frecuentes

```sql
-- Buscar jugador por cédula / nombre (el correo está en Firebase; en nóminas, registration_players.email)
select uid, full_name, doc_number, phone, deactivated_at from player_profiles
 where doc_number = '1082470064' or full_name ilike '%cantillo%';
select rp.registration_id, rp.player_uid, rp.player_name, rp.doc_number, rp.removed_at
  from registration_players rp where rp.doc_number = '1082470064';

-- Equipos con nombre parecido (duplicados)
select t.id, t.name, t.created_at, (select count(*) from team_members m where m.team_id=t.id) miembros,
       (select count(*) from registrations r where r.team_id=t.id) inscripciones
  from teams t where t.name ilike '%file%way%' order by t.created_at;

-- Nóminas de un equipo con su conteo
select r.id, e.name torneo, r.status, r.invite_code,
       count(rp.*) filter (where rp.removed_at is null) jugadores, e.max_players_per_team tope
  from registrations r join editions e on e.id=r.edition_id
  left join registration_players rp on rp.registration_id=r.id
 where r.team_id = '<team_id>' group by r.id, e.name, e.max_players_per_team;

-- Reabrir una nómina para que el delegado pueda agregar jugadores (luego la vuelve a enviar)
update registrations set status='draft' where id = '<registration_id>';

-- Dejar a alguien como delegado del equipo
insert into team_members (team_id, player_uid, player_name, role, is_player)
values ('<team_id>', '<uid>', '<nombre>', 'director', true)
on conflict do nothing;            -- y si es el principal: update teams set director_uid='<uid>' …

-- Nóminas por encima del tope
select e.name, t.name, count(*) n, e.max_players_per_team
  from registration_players rp join registrations r on r.id=rp.registration_id
  join editions e on e.id=r.edition_id join teams t on t.id=r.team_id
 where rp.removed_at is null group by 1,2,4 having count(*) > e.max_players_per_team;

-- Asignar árbitro a un partido (staff con cuenta)
insert into match_delegates (match_id, uid, role, assigned_by_uid) values ('<match>', '<uid>', 'referee_1', '<admin_uid>');
update matches set referee_id = '<referee_id>' where id = '<match>';
-- Sin cuenta: pending_email + invited_name en vez de uid.
```

Notas:

- Para `string_agg` sobre columnas enum hay que castear `::text`.
- Al reasignar una fila de nómina a otra cuenta, revisar antes que no exista una fila retirada
  del mismo jugador en esa nómina (choca con el único `(registration_id, player_uid)`).
- Filas de nómina llamadas "Delegado" o atadas a la cuenta de un organizador son basura de
  carga: se retiran o se pasan a `manual:` y se conectan con la cuenta real del jugador.

## 5. IDs útiles (producción)

| Qué | ID |
|---|---|
| Edición Campeón de Campeones (CdC) | `6484dcac-68cc-4c21-9398-d22cd03beb85` — tarifas: amarilla 15.000, roja 30.000 |
| Edición GOLDEN ERA | `48b78c6c-7303-4e03-bb20-9687c3688fc7` |
| Edición CASB LEGEND ÚNICA | `87ff2eae-84dd-49fe-96ad-b9c3583192b1` |
| César Augusto Sánchez (staff que crea equipos; árbitro) | uid `xTltVp4APnfxcs8AOT9qbq6jZ0D3` |
| Andrés Chacón (árbitro) | referee `357e8c02-7248-4205-873d-c74383c768fd`, uid `MWPeBMod2vS66wpOoa54zUSyoUP2` |
| Jorge Páez (árbitro, sin cuenta) | referee `451b1500-3184-42cb-ba63-1599b4e7efce` |
| Edwar Cadena (árbitro) | uid `VAPqRSO7NPP0LBLjELCSb10cGOF3` |
| Sebastián Rey (árbitro) | uid `giKAOTfZLAbkfjd2mYZ6eau5Yq22` |
