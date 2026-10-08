# Flujo de datos — Zentory

> Documento de auditoría (solo lectura). Registra **qué datos lee, qué datos envía y qué
> funciones existen sin usarse**. No cambia el comportamiento de la aplicación.
>
> Última revisión: 2026-09-25.

---

## 1. Principio general del proyecto

| Aspecto | Realidad |
|---|---|
| Cliente de BD en navegador | `createBrowserClient` con **anon key** (`src/lib/supabase/client.ts`) |
| Cliente de BD en servidor | `createServerClient` con cookies (`src/lib/supabase/server.ts`) |
| Service role key | **Solo** en `src/app/actions/admin-usuarios.ts` (nunca llega al bundle del cliente) |
| Precios / totales | **Nunca** se envían desde el cliente; `confirmar_factura` los recalcula desde `productos.precio_venta` |
| Escritura directa de facturas | Bloqueada con `WITH CHECK (false)`; solo pasa por RPC `SECURITY DEFINER` |
| Tipos generados de BD | **No existen** (`database.types.ts` ausente) → todos los `.select("...")` son cadenas libres y los errores de columna **no se detectan al compilar** |

---

## 2. Datos que salen de la app (lo que enviamos)

| Destino | Datos enviados | Origen |
|---|---|---|
| `confirmar_factura(payload)` | `items[{producto_id, cantidad, descuento_item, tipo_descuento_item}]`, `descuento_global_*`, `guardar_sin_imprimir`, y `cliente_id` **o** `cliente{nombre, identificacion, nit, email, telefono, direccion}` | `nueva-factura-client.tsx:149-172` |
| `anular_factura(p_factura_id, p_razon)` | id de factura + motivo (≥ 10 caracteres) | `actions/admin-facturas.ts:22` |
| `marcar_factura_impresa(p_factura_id)` | id de factura | `printing/print-center.tsx:42` |
| `ajustar_stock_manual(...)` | producto, cantidad, motivo, costo unitario opcional | `inventario/inventario-client.tsx:123-125` |
| `auth.admin.createUser` | email + password + metadata (usa **service role**) | `actions/admin-usuarios.ts` |
| `negocio_mensajes` | `delete` + `insert` de los mensajes del ticket | `admin/negocio-form.tsx:96-107` |
| Login | email + contraseña (Supabase Auth) | `auth/login-form.tsx` |
| `auditoria_registrar(...)` | `EXPORTACION_INVENTARIO` / `EXPORTACION_REPORTE` + código de reporte, total de filas, usuario, IP | `actions/inventario-export.ts`, `actions/auditoria.ts:registrarExportacionReporte` |

**No se envía nunca:** precios de venta, costos, subtotales calculados, stock ni número de
factura — todo eso se decide en el servidor.

---

## 3. Datos que entran (lo que se consulta) por pantalla

| Pantalla | Tablas leídas | Campos / observaciones |
|---|---|---|
| `/login` | `usuarios` | `activo` para bloquear el acceso |
| `/dashboard` | `facturas`, `items_factura`, `productos`, `movimientos_stock` | 7 consultas; **2 apuntan a la tabla inexistente `factura_items`** |
| `/facturas/nueva` | `productos` (límite 500), `clientes` (autocomplete, límite 6) | Catálogo completo si hay ≤ 500 productos |
| `/imprimir` | `facturas` + `clientes` + `usuarios` + `items_factura` + `productos` + `negocio` | Filtro `estado = pendiente_impresion`, límite 100 |
| `/historial` | `facturas` + `items_factura` | **Límite 200** (trunca silenciosamente) |
| `/inventario` | `productos`, `movimientos_stock` | **Límite 200**; el kardex depende de `movimientos_stock`. **`precio_costo` no viaja en las props si el usuario no es admin** (`page.tsx:67`) |
| `/reportes` (11 subreportes) | `facturas`, `items_factura`, `productos`, `clientes`, `movimientos_stock` | **Sin `limit()`** en ninguno → PostgREST corta en `db.max_rows` (1000) |
| `/admin/reportes` | igual que arriba | Duplicado funcional del hub `/reportes` |
| `/admin/usuarios` | `usuarios` | lista completa |
| `/admin/negocio` | `negocio` + `negocio_mensajes` | `.select("*, negocio_mensajes(*)")` |

### 3.1 Consultas que traen más datos de los necesarios

| Ubicación | Problema |
|---|---|
| `reportes/bajo-stock-client.tsx:31` | `.lte("stock_actual", 1000000)` **trae todo el catálogo** y filtra en JS |
| Los 11 `reportes/*-client.tsx` | **Sin `limit()`** → truncamiento silencioso a 1000 filas |
| `cliente-autocomplete` + RLS `clientes_select_authenticated` | cualquier autenticado puede leer **toda la cartera de clientes** (nombre, cédula, NIT, email, teléfono, dirección) |
| `reportes/*-client.tsx` | corren **en el navegador** con la anon key; dependen 100 % de RLS |

---

## 4. Funciones / elementos existentes pero SIN USO

| Elemento | Definido en | Uso real en `src/` | Nota |
|---|---|---|---|
| RPC `current_user_role()` | `20260429_001_init.sql:105` | **0 llamadas** | Función muerta, expuesta con `EXECUTE` a `PUBLIC` por defecto. **Eliminada en la migración 012 y del baseline.** |
| RPC `is_admin()` | `20260429_001_init.sql:115` | **0 llamadas** desde TS | Se usa solo dentro de SQL/RLS — es correcto, pero su `EXECUTE` es `PUBLIC` (se revoca en 012) |
| Columna `negocio.mensaje_agradecimiento` | `20260430_004_negocio.sql:7` | Se recibe via `.select("*")` pero **nunca se renderiza** | Legacy: la migración 007 ya copió su contenido a `negocio_mensajes` |
| `src/components/facturas/barcode-scanner.tsx` | — | **0 importaciones** (68 líneas) | El escáner real es `ui/fullscreen-scanner.tsx` vía `ui/sku-input.tsx` |
| Variable `TESTSPRITE_API_KEY` | `.env.local` | **0 usos en `src/`** | Falta en `.env.example`; solo la usa la suite de tests |
| Pestaña `/admin/reportes` | `app/(app)/admin/reportes/page.tsx` | **Sin entrada en el menú** (`app-shell.tsx:42-50`) | Duplicada respecto a `/reportes` + sus 11 subrutas |
| Dashboard: botones "Exportar Vista" / "Reporte Ventas" | `dashboard/DashboardClient.tsx:100-108` | **Sin `onClick`** → no hacen nada | |
| Dashboard: select "Sucursal" | `dashboard/DashboardClient.tsx:130-133` | `disabled` permanente, dato ficticio | |
| Dashboard: módulo "Días y Horarios" | `dashboard/DashboardClient.tsx:254-280` | Maqueta con `blur` y "En desarrollo..." | |
| `reportes/page.tsx:166-171` bloque "Próximamente" | | **Inalcanzable** (todos los reportes tienen `disponible: true`) | |
| `historial/page.tsx:45-49` rama `else` | | **Código muerto** (el `redirect` anterior ya expulsó a los vendedores) | |

---

## 5. Superficies de datos abiertas más de lo necesario

Esto queda **documentado, no modificado** en esta fase (decisión del proyecto):

1. **Vendedor lee todos los clientes** — política `clientes_select_authenticated` usa solo `auth.uid() is not null`.
2. **Vendedor lee facturas anuladas a nivel API** — la migración 011 declaró querer impedirlo y se revirtió (commit `2745248`); la UI lo redirige pero la BD no lo bloquea.
3. **Usuario desactivado mantiene lecturas** — `requireProfile()` solo redirige, no cierra sesión; la mayoría de políticas no comprueban `usuarios.activo`.
4. **Bypass del middleware** — `lib/supabase/middleware.ts:9` salta la autenticación si la petición trae cabecera `next-action`.
5. **`auditoria_registrar()` es `SECURITY DEFINER` ejecutable por `anon`** — el aviso del linter de Supabase es real: cualquier request sin sesión puede insertar `LOGIN_FALLIDO` (el resto de acciones la rechaza). Se tolera porque el formulario de login necesita registrar el fallo antes de autenticarse.
6. **Autocomplete sin escapar** — `cliente-autocomplete.tsx:63` construye un `.or()` con el input crudo (una coma en el nombre rompe el filtro).
7. **`negocio-form.tsx:96-112`** hace `delete` + `insert` sin transacción: si falla el insert se pierden los mensajes.

---

## 6. Datos que NO se manejan (ausencias de diseño)

- **No hay tabla de pagos** — `facturas.estado` representa el ciclo de **impresión**, no el cobro.
  El dashboard lo traduce como "pagadas" (`dashboard.ts:141-147`), lo cual es confuso.
- **No hay IVA ni impuestos** en esquema, RPC ni ticket.
- **No hay devoluciones parciales** — la anulación es todo o nada.
- **La venta bruta antes de descuentos por ítem no es reconstruible**: solo se guarda
  `subtotal_item` ya descontado; el descuento por línea no se agrega en ninguna columna.
- **No hay `updated_at`** en `facturas`, `clientes`, `productos`, `usuarios`.

---

## 7. Rutas de migración

| Situación | Archivo a ejecutar |
|---|---|
| Base de datos **nueva** (recién creada) | `supabase/baseline/ZENTORY_BASELINE.sql` — una sola vez |
| Base de datos **existente** (la actual) | `supabase/migrations/` del **012 al 018**, en orden, cada uno una vez (idempotentes) |

Detalle e instrucciones en `supabase/README.md`.
