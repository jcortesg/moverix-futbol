# Moverix — Design Tokens y Sistema Visual

## Paleta de Colores

### Colores Base
```css
--color-sidebar-bg: #1B2535;      /* Sidebar fondo oscuro */
--color-sidebar-text: #94A3B8;    /* Texto inactivo sidebar */
--color-sidebar-active: #FFFFFF;  /* Texto activo sidebar */
--color-sidebar-active-bg: rgba(255,255,255,0.08); /* Fondo item activo */

--color-bg: #F8FAFC;              /* Fondo general */
--color-surface: #FFFFFF;         /* Cards y paneles */
--color-border: #E2E8F0;          /* Bordes */
--color-text-primary: #0F172A;    /* Texto principal */
--color-text-secondary: #64748B;  /* Texto secundario */
--color-text-muted: #94A3B8;      /* Texto tenue */
```

### Colores de Estado
```css
/* Verde — positivo, pagado, al día, finalizado */
--color-success: #16A34A;
--color-success-bg: #F0FDF4;
--color-success-border: #BBF7D0;

/* Naranja — pendiente, en curso, deuda */
--color-warning: #D97706;
--color-warning-bg: #FFFBEB;
--color-warning-border: #FDE68A;

/* Rojo — crítico, sin pago, alerta */
--color-danger: #DC2626;
--color-danger-bg: #FEF2F2;
--color-danger-border: #FECACA;

/* Azul — información, KPIs neutros */
--color-info: #2563EB;
--color-info-bg: #EFF6FF;
```

### Color Primario (Acción)
```css
--color-primary: #16A34A;         /* Verde Moverix */
--color-primary-hover: #15803D;
--color-primary-text: #FFFFFF;
```

---

## Tipografía
- **Fuente**: Inter (Google Fonts)
- **Tamaños**:
  - KPI valor grande: 32px / bold
  - Título de sección: 20px / semibold
  - Texto de tabla: 14px / regular
  - Badge / label: 12px / medium
  - Sub-info: 12px / regular / muted

---

## Componentes Clave

### Badge de Estado
```
Pagado / Al día → bg-green-100 text-green-700
Parcial / Deuda / En curso → bg-amber-100 text-amber-700
Sin pago / Crítico → bg-red-100 text-red-700
Programado → bg-slate-100 text-slate-600
EN VIVO → bg-amber-500 text-white (animado)
Finalizado → bg-green-600 text-white
Completada → bg-green-100 text-green-700
```

### KPI Card
- Fondo blanco, borde sutil
- Label pequeño arriba (uppercase, muted)
- Valor grande abajo (bold, negro o coloreado)
- Sub-texto pequeño debajo

### Sidebar
- Fondo: #1B2535
- Sección label: uppercase, 11px, muted
- Item normal: texto gris, sin fondo
- Item activo: texto blanco, fondo semitransparente, borde izquierdo verde 3px

### Tabla
- Header: bg-slate-50, texto uppercase 11px muted, border-b
- Row: border-b border-slate-100
- Row hover: bg-slate-50
- Padding celda: py-3 px-4

---

## Iconografía
- Usar **Lucide React** para todos los iconos
- Iconos del sidebar: Trophy (Torneos), Shield (Equipos), Calendar (Partidos), Grid (Grupos), BarChart (Tabla), DollarSign (Pagos)
- Tamaño estándar: 16px (sidebar), 20px (acciones)
