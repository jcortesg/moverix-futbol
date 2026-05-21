# Moverix — Sistema Visual y Design Tokens

Basado en la implementacion real (Tailwind config + globals.css + componentes).

## Tailwind Theme

### Colores custom (tailwind.config.ts)

```js
theme.extend.colors = {
  sidebar: {
    bg: '#1B2535',       // Fondo sidebar oscuro
    text: '#94A3B8',     // Texto inactivo sidebar
    active: '#FFFFFF',   // Texto activo sidebar
  },
  brand: {
    green: '#16A34A',    // Verde Moverix (acciones principales)
    'green-hover': '#15803D',
  },
}

theme.extend.fontFamily = {
  sans: ['Inter', 'system-ui', 'sans-serif'],
}
```

### Variables CSS (globals.css)

```css
:root {
  --sidebar-bg: #1B2535;
  --brand-green: #16A34A;
}

body {
  @apply bg-slate-50 text-slate-900;
}
```

> **Nota**: La mayoria del styling usa clases Tailwind directamente, no CSS custom properties.

---

## Paleta de colores en uso

### Estructura
| Uso | Clase Tailwind |
|-----|---------------|
| Fondo general | `bg-slate-50` (#F8FAFC) |
| Cards y paneles | `bg-white` |
| Bordes | `border-slate-200` (#E2E8F0) |
| Texto principal | `text-slate-900` (#0F172A) |
| Texto secundario | `text-slate-500` (#64748B) |
| Texto muted | `text-slate-400` (#94A3B8) |

### Sidebar
| Uso | Valor |
|-----|-------|
| Fondo | `bg-[#1B2535]` |
| Texto inactivo | `text-slate-400` |
| Texto activo | `text-white` |
| Fondo item activo | `bg-white/8` (rgba semitransparente) |
| Borde izquierdo activo | `border-l-3 border-green-500` |
| Seccion label | uppercase, text-[11px], text-slate-500 |

### Colores de estado

**Verde — positivo**
```
bg-green-100 text-green-700 border-green-200     → badges: Pagado, Al dia, Completada
bg-green-600 text-white                          → badge: Finalizado
bg-green-50                                      → fondo fila clasificado
```

**Ambar/naranja — pendiente/en curso**
```
bg-amber-100 text-amber-700 border-amber-200     → badges: Parcial, Deuda, En curso, Pendiente
bg-amber-500 text-white                          → badge: EN VIVO (con animacion)
```

**Rojo — critico/negativo**
```
bg-red-100 text-red-700 border-red-200           → badges: Sin pago, Critico, Rechazado
```

**Slate/gris — neutro**
```
bg-slate-100 text-slate-600                      → badge: Programado, Draft
```

**Azul — informativo**
```
bg-blue-100 text-blue-700                        → badges: Copa A, info neutral
```

### Color primario (acciones)
```
bg-green-600 hover:bg-green-700 text-white       → botones principales (Crear, Guardar, Aprobar)
```

---

## Tipografia

- **Fuente**: Inter (via Google Fonts / system-ui fallback)
- **Tamanos en uso**:

| Uso | Clase |
|-----|-------|
| KPI valor grande | `text-3xl font-bold` (~30px) |
| Titulo de seccion | `text-xl font-semibold` (20px) |
| Titulo de card | `text-lg font-semibold` (18px) |
| Texto normal | `text-sm` (14px) |
| Badge / label | `text-xs font-bold` (12px) |
| Seccion sidebar | `text-[11px] uppercase tracking-wider` |
| Sub-info / hint | `text-xs text-slate-400` (12px) |

---

## Componentes del sistema visual

### Badge de estado (status pill)
```tsx
<span className={clsx(
  'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-bold border',
  meta.bg, meta.text,
)}>
  <span className={clsx('w-1.5 h-1.5 rounded-full', meta.dot)} />
  {meta.label}
</span>
```

Variantes: Pagado/Al dia (green), Parcial/En curso (amber), Sin pago/Critico (red), Programado (slate), EN VIVO (amber-500 animado), Finalizado (green-600).

### KPI Card
```
bg-white rounded-xl border border-slate-200 p-4
Label: text-xs uppercase text-slate-400 tracking-wider
Valor: text-2xl/3xl font-bold (negro o coloreado)
Sub-texto: text-xs text-slate-400
```

### Sidebar
```
Fondo: #1B2535 (w-56 fixed h-screen)
Seccion: uppercase text-[11px] text-slate-500 px-4 mt-6
Item normal: text-slate-400 hover:text-white hover:bg-white/5
Item activo: text-white bg-white/8 border-l-3 border-green-500
Footer: avatar + email + logout
```

### Tablas
```
Header: bg-slate-50 text-[11px] uppercase text-slate-400 border-b
Row: border-b border-slate-100 hover:bg-slate-50
Celda: py-3 px-4 text-sm
```

### Cards / Paneles
```
bg-white rounded-xl border border-slate-200 shadow-sm
Hover (si clickeable): hover:shadow-md transition-shadow
```

### Inputs
```
w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5
text-sm text-slate-900 outline-none transition
focus:border-green-500 focus:bg-white focus:ring-2 focus:ring-green-500/20
placeholder:text-slate-400
```

### Drawer lateral
```
Overlay: fixed inset-0 bg-black/30 z-40
Panel: fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl z-50
Header: sticky top-0 bg-white border-b px-6 py-4
Content: overflow-y-auto flex-1 p-6
Footer: sticky bottom-0 bg-white border-t px-6 py-4
```

### Modal
```
Overlay: fixed inset-0 bg-black/40 z-40
Container: fixed inset-0 z-50 flex items-center justify-center p-4
Panel: bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto
```

### Empty state
```
flex flex-col items-center justify-center gap-3 py-16
bg-white rounded-2xl border-2 border-dashed border-slate-200
Icono: size-7 text-slate-300
Texto: text-sm font-semibold text-slate-500
CTA: boton verde o link
```

---

## Iconografia

- **Libreria**: Lucide React
- **Iconos del sidebar**: Trophy (Torneos), Shield (Equipos), Calendar (Partidos), Grid3X3 (Grupos), BarChart3 (Tabla), DollarSign (Pagos), MapPin (Canchas), UserCheck (Arbitros)
- **Tamano estandar**: 16px (sidebar/inline), 20px (acciones/botones), 28px (empty states)

---

## Responsive

- Sidebar fijo en desktop (w-56)
- Contenido principal con padding px-6 py-8
- Grids responsivos:
  - Grupos: `grid-cols-1 md:grid-cols-2 lg:grid-cols-3`
  - KPI cards: `grid-cols-2 md:grid-cols-4`
  - Canchas: `grid-cols-1 md:grid-cols-2 lg:grid-cols-3`
- Tablas con overflow-x-auto en mobile
- Drawers full-width en mobile, max-w-md en desktop
