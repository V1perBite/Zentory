# Zentory

PWA de inventario y facturación con `Next.js 14` + `Supabase` + `Tailwind`, con carrito persistido en `Zustand`, escáner de código de barras y flujo de impresión remota en ticket térmico 80mm.

## Stack

- `Next.js 14` (App Router)
- `Tailwind CSS`
- `Supabase` (PostgreSQL, Auth, Realtime, RLS)
- `Zustand` (carrito con `persist`)
- `@zxing/browser` (escaneo por cámara)
- `react-to-print` (ticket 80mm)
- `next-pwa`

## Configuración local

1. Instalar dependencias:

```bash
npm install
```

2. Copiar variables de entorno:

```bash
copy .env.example .env.local
```

3. Completar en `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

4. Ejecutar migración SQL en Supabase:

- Archivo: `supabase/migrations/20260429_001_init.sql`

5. Ejecutar proyecto:

```bash
npm run dev
```

## Estado implementado

- Login con Supabase Auth y verificación de `usuarios.activo`.
- Rutas protegidas y shell por rol (`admin`, `vendedor`).
- Inventario con listado, alertas de mínimo y herramientas admin (crear producto, activar/desactivar, ajuste manual por RPC).
- Facturación con carrito persistido en `localStorage`, escaneo por cámara, descuentos por ítem/global y confirmación vía RPC atómica.
- Centro de impresión (`/imprimir`) solo para admin, con cola `pendiente_impresion`, Realtime, ticket 72mm y marcado automático a `impresa`.
- Historial por rol (admin: todo, vendedor: propio).
- PWA configurada (`manifest`, `sw`).
