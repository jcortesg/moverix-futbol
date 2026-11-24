# Plan de actualización del admin (UX)

**Versión 1.1** · 2026-11-24 · Estado: fase 0 en curso

## Por qué

Los organizadores no encuentran o no entienden varias acciones del panel y terminan pidiéndolas a
soporte por WhatsApp: reabrir una nómina, poner a alguien de delegado, asignar árbitro, quitar
duplicados. Este plan sale de una revisión del código del admin, pantalla por pantalla.

**Hallazgo de fondo:** dos de esos pedidos **no se pueden hacer desde el panel** aunque se
mejore la interfaz:
- poner delegados adicionales (la API solo lo permite desde la app);
- enviar o aprobar una nómina que está en borrador (solo existe en la app).

Para esos dos hacen falta endpoints nuevos en la API.

## Glosario (se usa igual en todas las pantallas)

| Término | Significa |
|---|---|
| **Nómina** | Lista de jugadores de un equipo en un torneo |
| **Planilla** | Documento del partido (PDF) y la hoja que llena el árbitro |
| **Delegado del equipo** | Quien administra el equipo y su nómina (principal + adicionales) |
| **Veedor del partido** | El rol "delegate" de un partido (hoy también se llama "delegado" y confunde) |
| **Calendario** | Antes "Fixture" / "Partidos" |
| **Llaves** | Antes "Bracket" / "Fase eliminatoria" |
| **Tabla** | Antes "Posiciones" |
| **Cabeza de serie** | Antes "Seed" |

## Regla de producto (2026-11-24)

La nómina queda **abierta para todos los equipos hasta que el admin la cierre**. "Enviada" es un
estado de la inscripción, no cierra la nómina: el delegado puede seguir agregando, quitando y
editando jugadores. Lo único que cierra es el candado de nóminas del campeonato o el de un equipo.

## Fases

### Fase 0 — Arreglos rápidos (S, solo admin)

| # | Qué | Estado |
|---|---|---|
| 0.1 | Nómina: columnas desalineadas (bajo "Datos" salía Activo/Suspendido) y columnas falsas (WO y Multas siempre 0, "Suspendido" con cualquier roja histórica) | **Hecho** 2026-11-24 |
| 0.2 | Avisos de éxito/error (toasts) en Equipos, ficha del equipo, Nómina y Pagos. Hoy los errores pasan en silencio | Pendiente |
| 0.3 | Estado de la nómina en la ficha del equipo: "Nómina abierta/cerrada" + botón "Reabrir/Cerrar nómina". En la lista, columna "Nómina" con texto (clic para abrir/cerrar ese equipo) en vez del candado de 11px | **Hecho** 2026-11-24 |
| 0.4 | Filtro "Sin enviar (n)" en Equipos con la explicación "El delegado aún no envía la nómina desde la app"; "Pendiente" → "Enviada"; columna "Inscripción" separada de "Nómina" | **Hecho** 2026-11-24 |
| 0.5 | Delegado: modal en vez de `window.prompt`, refrescar la fila al guardar, texto coherente; en la ficha mostrar nombre/correo del delegado en vez de "DT uid…" | Pendiente |
| 0.6 | Partido: botón "Árbitro / terna" en la tarjeta que abre el selector de terna y muestra quién está asignado (o "Sin árbitro") | Pendiente |
| 0.7 | Quitar lo que no funciona: buscador y campana del Header, botones "Nueva liga" / "Crear primera liga" sin acción | Pendiente |
| 0.8 | Botón "Delegado" de la nómina → "Agregar al delegado como jugador" | Pendiente |

### Fase 1 — Acciones que hoy solo se piden por WhatsApp (M, API + admin)

| # | Qué |
|---|---|
| 1.1 | Sección **Delegados** en la ficha del equipo: principal, adicionales y "por reclamar". Agregar por correo o eligiendo un jugador de la nómina, con check "también juega". Endpoint admin para delegados adicionales |
| 1.2 | Nómina en borrador: acción "Aprobar directamente" (con confirmación) y recorrido visible Borrador → Enviada → Aprobada. Endpoint admin |
| 1.3 | Un solo lugar para el árbitro: sección "Árbitro y terna" en el diálogo Programar. Hoy hay dos selectores y el del catálogo no habilita la planilla en `/dirigir` |
| 1.4 | Duplicados: marcar "Duplicado" si la misma cédula aparece dos veces en una nómina, y aviso en Equipos de jugadores inscritos en dos equipos del mismo torneo |
| 1.5 | Pagos: una sola fuente de "pagado" (Equipos y Pagos hoy pueden decir cosas distintas); "Marcar pago" abre el diálogo de pago; Pagos incluye equipos no aprobados |

### Fase 2 — Navegación y orden (M)

| # | Qué |
|---|---|
| 2.1 | Una sola ruta por pantalla de torneo (hoy cada una tiene dos: sidebar y "Gestionar"). Al cambiar de torneo en el Header, ir a la misma sección del torneo nuevo. Hoy el Header puede decir un torneo y la página mostrar otro |
| 2.2 | Selector de torneo con el nombre de la edición como texto principal (hoy dos ediciones de la misma liga se ven iguales) |
| 2.3 | Inicio con bloque **Pendientes**: nóminas por revisar, equipos sin delegado, partidos sin árbitro, multas por cobrar; cada contador lleva a la lista filtrada |
| 2.4 | Portada "Gestionar" con contadores por sección y la configuración plegada |
| 2.5 | Glosario aplicado en todo el panel (sin inglés ni jerga) |
| 2.6 | Buscador de jugadores enlazado a la nómina de cada equipo |
| 2.7 | Modal de confirmación propio (reemplaza `window.confirm`/`prompt`); aprobar/rechazar/retirar con texto y motivo |

### Fase 3 — Celular (M)

| # | Qué |
|---|---|
| 3.1 | Sidebar como menú desplegable en pantallas chicas |
| 3.2 | Equipos y nómina como tarjetas en celular (o al menos scroll horizontal); barras de botones que bajan de línea |

## Cómo se trabaja

- Cada punto se implementa y se prueba en local (`scripts/local-dev.sh`, admin en `localhost:3100`)
  antes de subirlo.
- Se despliega por fases y solo con el visto bueno de Jhon.
- Al terminar un punto se marca aquí como **Hecho** con la fecha.
