# Analisis de Archivos — Proyecto Zentory

**Fecha:** Mayo 2026  
**Scope:** Analisis completo de la estructura de archivos del proyecto para identificar archivos activos, huérfanos y recomendaciones de limpieza.

---

## 1. Estructura general

```
zentory/
├── src/
│   ├── app/                    # Next.js App Router (páginas y layouts)
│   │   ├── (app)/              # Rutas protegidas (requieren sesion)
│   │   │   ├── admin/          # negocio, reportes, usuarios
│   │   │   ├── dashboard/
│   │   │   ├── facturas/       # lista + nueva
│   │   │   ├── historial/      # lista + [id]
│   │   │   ├── imprimir/       # centro de impresion
│   │   │   └── inventario/
│   │   ├── actions/            # Server Actions
│   │   ├── login/
│   │   ├── layout.tsx          # Root layout
│   │   ├── page.tsx            # Redirect / → /dashboard
│   │   └── globals.css
│   ├── components/
│   │   ├── admin/              # negocio-form, usuarios-client
│   │   ├── auth/               # login-form
│   │   ├── facturas/           # nueva-factura-client, cliente-autocomplete, barcode-scanner
│   │   ├── historial/          # historial-client
│   │   ├── inventario/         # inventario-client, admin-tools, import-csv-modal, kardex-modal
│   │   ├── printing/           # ticket, print-center
│   │   ├── ui/                 # number-field, sku-input
│   │   ├── app-shell.tsx
│   │   └── signout-button.tsx
│   ├── lib/
│   │   ├── supabase/           # client.ts, server.ts, middleware.ts
│   │   ├── auth.ts
│   │   ├── constants.ts
│   │   ├── invoice-calculations.ts
│   │   └── types.ts
│   └── store/
│       └── use-invoice-cart.ts # Zustand store
├── public/                     # Estaticos + PWA
├── supabase/migrations/        # 9 migraciones SQL
├── testsprite_tests/           # Tests E2E + artifacts
└── [config files]
```

---

## 2. Archivos con problemas detectados

### Archivos huérfanos (nunca importados — candidatos a eliminar)

| Archivo | Motivo |
|---|---|
| `src/components/facturas/barcode-scanner.tsx` | **Nunca importado** en ningún otro archivo. `SkuInput` (`ui/sku-input.tsx`) ya integra escaneo de codigo de barras con `@zxing/browser`. Este componente es redundante y no tiene referencias entrantes. |
| `public/next.svg` | Boilerplate de `create-next-app`. No se referencia en el codigo fuente ni en el manifest. |
| `public/vercel.svg` | Boilerplate de `create-next-app`. No se referencia en el codigo fuente ni en el manifest. |

### Archivos de infraestructura / build (no son codigo del proyecto)

| Archivo/Directorio | Motivo |
|---|---|
| `.agents/skills/ui-ux-pro-max/` | Infraestructura del IDE, no es codigo de la aplicacion. |
| `skills-lock.json` | Artefacto interno del agente, no referenciado por el proyecto. |
| `tsconfig.tsbuildinfo` | Cache de compilacion incremental de TypeScript. Se regenera en cada build. |
| `testsprite_tests/tmp/` (6 archivos, ~2.6 MB) | Artefactos de ejecucion de tests: logs (`mcp.log` ~2.5 MB), resultados, cache. No son codigo fuente. |

### Archivos correctamente conectados

Todos los demas archivos en `src/` estan correctamente referenciados en el grafo de dependencias:

- **13 paginas** → cada una importa los componentes y libs que necesita.
- **14 componentes** → cada uno es importado por al menos una pagina o componente padre.
- **7 archivos lib** → cada export es consumido por al menos un consumidor.
- **1 store** → usado por `nueva-factura-client.tsx`.
- **9 migraciones** → ejecutadas en Supabase, necesarias para el schema.

---

## 3. Grafo de dependencias (resumen)

```
middleware.ts
  └── lib/supabase/middleware.ts → updateSession()

app/layout.tsx
  ├── globals.css
  └── lib/constants.ts (APP_NAME)

app/login/page.tsx
  ├── components/auth/login-form.tsx → lib/supabase/client.ts
  └── lib/auth.ts (getSessionUser)

app/(app)/layout.tsx
  ├── components/app-shell.tsx → signout-button, lib/types, lib/constants
  └── lib/auth.ts (requireProfile)

app/(app)/dashboard/page.tsx
  ├── lib/auth.ts, lib/constants.ts
  └── lib/supabase/server.ts

app/(app)/facturas/nueva/page.tsx
  ├── lib/supabase/server.ts, lib/auth.ts
  └── components/facturas/nueva-factura-client.tsx
      ├── store/use-invoice-cart.ts → lib/invoice-calculations, lib/constants
      ├── lib/invoice-calculations.ts
      ├── components/ui/sku-input.tsx → @zxing/browser
      ├── components/ui/number-field.tsx
      └── components/facturas/cliente-autocomplete.tsx → lib/supabase/client.ts

app/(app)/historial/page.tsx
  ├── lib/auth.ts, lib/supabase/server.ts, lib/constants.ts
  └── components/historial/historial-client.tsx
      ├── app/actions/admin-facturas.ts → lib/supabase/server.ts
      └── lib/invoice-calculations.ts

app/(app)/historial/[id]/page.tsx
  ├── lib/auth.ts, lib/supabase/server.ts, lib/constants.ts, lib/types.ts
  └── components/printing/ticket.tsx → lib/invoice-calculations, lib/types

app/(app)/imprimir/page.tsx
  ├── lib/auth.ts, lib/supabase/server.ts, lib/constants.ts, lib/types.ts
  └── components/printing/print-center.tsx
      ├── lib/supabase/client.ts, lib/constants.ts, lib/types.ts
      └── components/printing/ticket.tsx

app/(app)/inventario/page.tsx
  ├── lib/auth.ts, lib/supabase/server.ts, lib/constants.ts
  ├── components/inventario/admin-tools.tsx
  │   ├── lib/supabase/client.ts
  │   ├── components/ui/sku-input.tsx, components/ui/number-field.tsx
  │   └── components/inventario/import-csv-modal.tsx → lib/supabase/client.ts
  └── components/inventario/inventario-client.tsx
      ├── lib/supabase/client.ts, lib/invoice-calculations.ts
      ├── components/ui/sku-input.tsx, components/ui/number-field.tsx
      └── components/inventario/kardex-modal.tsx → lib/supabase/client.ts, lib/invoice-calculations

app/(app)/admin/negocio/page.tsx
  ├── lib/auth.ts, lib/supabase/server.ts, lib/constants.ts, lib/types.ts
  └── components/admin/negocio-form.tsx → lib/supabase/client.ts, lib/types

app/(app)/admin/usuarios/page.tsx
  ├── lib/auth.ts, lib/supabase/server.ts, lib/constants.ts
  └── components/admin/usuarios-client.tsx
      └── app/actions/admin-usuarios.ts → lib/supabase/server.ts, lib/auth.ts, lib/constants.ts

app/(app)/admin/reportes/page.tsx
  ├── lib/auth.ts, lib/supabase/server.ts, lib/constants.ts
  └── lib/invoice-calculations.ts
```

---

## 4. Dependencias npm

| Paquete | Usado por | ¿Necesario? |
|---|---|---|
| `@supabase/ssr` | `client.ts`, `server.ts`, `middleware.ts`, `admin-usuarios.ts` | ✅ |
| `@supabase/supabase-js` | (transitiva) | ✅ |
| `@zxing/browser` | `sku-input.tsx`, `barcode-scanner.tsx` (huérfano) | ✅ (aun necesario para `SkuInput`) |
| `lucide-react` | `app-shell`, `historial-client`, `nueva-factura-client`, `inventario-client`, `signout-button` | ✅ |
| `next-pwa` | `next.config.mjs`, `sw.js`, `workbox-*.js` | ✅ |
| `react-to-print` | `print-center.tsx` | ✅ |
| `zustand` | `use-invoice-cart.ts` | ✅ |

---

## 5. Recomendaciones

### Acciones recomendadas (limpieza)

1. **Eliminar `src/components/facturas/barcode-scanner.tsx`** — componente huérfano, funcionalidad duplicada por `SkuInput`.
2. **Eliminar `public/next.svg` y `public/vercel.svg`** — boilerplate no utilizado.
3. **Limpiar `testsprite_tests/tmp/`** — 2.6 MB de artefactos de test (logs, cache). No son codigo fuente.
4. **Agregar `tsconfig.tsbuildinfo` al `.gitignore`** — es cache de build, no debe versionarse.

### Opcionales

5. **Eliminar `.agents/` y `skills-lock.json`** si no son requeridos por el flujo del equipo. Son infraestructura del IDE.
6. **Considerar si `getCurrentProfile` debe seguir exportado** desde `auth.ts` — solo se usa internamente por `requireProfile`. Si no se prevé uso externo, puede dejar de exportarse.

### Archivos que deben conservarse

- **Los 9 archivos de migracion** en `supabase/migrations/` — son el historial del schema de BD.
- **`public/sw.js` y `public/workbox-*.js`** — service worker de la PWA, generado por `next-pwa`.
- **`public/manifest.json`** — referenciado en el metadata del root layout.
- **Todos los archivos en `src/`** (excepto `barcode-scanner.tsx`) — estan correctamente conectados en el grafo de dependencias.

---

## 6. Conclusion

El proyecto tiene **43 archivos en `src/`**, de los cuales **42 estan correctamente referenciados** y solo **1 es huérfano** (`barcode-scanner.tsx`). La arquitectura es limpia: separacion clara entre paginas (server components), componentes cliente, librerias compartidas y store global. No se detectaron importaciones circulares ni dependencias rotas. La deuda tecnica se limita a los artefactos de build/tests no limpiados y 2 SVGs boilerplate.
