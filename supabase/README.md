# Base de datos — Zentory

Hay **dos caminos**. Elige uno; no hace falta ejecutar los dos.

| Situación | Archivo a ejecutar | Veces |
|---|---|---|
| **BD nueva** (recién creada en Supabase) | `baseline/ZENTORY_BASELINE.sql` | 1 sola vez |
| **BD existente** (la que está en uso hoy) | `migrations/20260925_012_reparacion_critica.sql`, `migrations/20260930_013_integridad_y_auditoria.sql`, `migrations/20261001_014_auditoria.sql` y después `20261002_015_superadmin_rol.sql`, `20261002_016_superadmin_guardas.sql` y `20261002_017_confirmar_factura_superadmin.sql` | 1 cada uno (idempotentes, en ese orden) |

> ⚠️ **No ejecutes el baseline sobre una BD que ya tiene datos**: la tabla
> `facturas` no se recrea, pero sí reemplazaría funciones, políticas RLS y
> descartaría los seeds. En una BD con datos, usa **012**.

---

## Opción A — Base de datos nueva

1. En Supabase: **Project Settings → Database → Reset database** (o crea un
   proyecto nuevo). *Esto borra todos los datos y usuarios de Auth.*
2. Abre **SQL Editor → New query**.
3. Pega **todo** el contenido de `baseline/ZENTORY_BASELINE.sql`.
4. **Run**.
5. Crea de nuevo los usuarios desde la app o desde
   **Authentication → Users → Add user** (el trigger `on_auth_user_created`
   crea automáticamente la fila en `public.usuarios`).

El baseline deja todo en su versión final: esquema, índices, triggers, RLS,
las 4 RPC de negocio corregidas y el seed de `negocio`.

---

## Opción B — Base de datos existente (la actual)

Conserva todos los datos: facturas, clientes, productos, kardex y usuarios.

1. En Supabase: **SQL Editor → New query**.
2. Pega **todo** el contenido de `migrations/20260925_012_reparacion_critica.sql`.
3. **Run**.
4. Con **New query**, pega **todo** el contenido de
   `migrations/20260930_013_integridad_y_auditoria.sql`.
5. **Run**.
6. Con **New query**, pega **todo** el contenido de
   `migrations/20261001_014_auditoria.sql`.
7. **Run**.
8. Con **New query**, pega `migrations/20261002_015_superadmin_rol.sql`
   y **Run** (va solo: añade el valor `superadmin` al enum y PostgreSQL
   no deja usarlo dentro de la misma transacción).
9. En **New query**, pega `migrations/20261002_016_superadmin_guardas.sql`
   y **Run** (is_admin(), policy, trigger de protección, whitelist de
   auditoría y promoción de la cuenta superadmin).
10. Por último, `migrations/20261002_017_confirmar_factura_superadmin.sql`
    y **Run** (permite facturar al rol `superadmin`).

Todas son **idempotentes**: si las ejecutas dos veces no pasa nada.

### Roles (015–017)

| Rol | Accesos |
|---|---|
| `superadmin` | Todo. Sólo la cuenta autorizada (`davidromerogocel@gmail.com`): no se puede editar su rol, desactivar ni eliminar, y ningún otro admin puede tocar su fila. No es asignable desde la UI. |
| `admin` | Todo lo operativo: dashboard, facturas, inventario con CRUD, reportes, negocio, usuarios y auditoría. |
| `vendedor` | Facturar, historial propio y consulta de inventario; creación de productos/auditoría según sus flags `usuarios.puede_*`. |

### Qué arregla 012

| # | Problema que resolvía |
|---|---|
| 1 | Faltaba `facturas.razon_anulacion` (la migración 010 nunca se aplicó) → **anular_factura() fallaba siempre** |
| 2 | `confirmar_factura()` aceptaba `items = NULL`, no ordenaba los `FOR UPDATE` (riesgo de deadlock) y **creaba un cliente nuevo por cada venta** |
| 3 | `anular_factura()` perdía stock si una factura tenía el mismo producto dos veces |
| 4 | Las salidas manuales de stock se guardaban como `ajuste` positivo → **el kardex las sumaba y Mermas salía siempre vacío** |
| 5 | La bandera `puede_crear_productos` no tenía política RLS → el vendedor recibía error de seguridad |
| 6 | Un usuario desactivado seguía pudiendo leer datos |
| 7 | Un vendedor podía leer facturas anuladas a nivel API |
| 8 | Cualquier autenticado podía crear clientes directamente por PostgREST |
| 9 | Faltaban índices para `facturas(created_at)`, `facturas(estado)` y `items_factura(producto_id)` |
| 10 | Las RPC eran ejecutables desde `anon`/`PUBLIC` |
| 11 | Existía `current_user_role()`, que **nunca se usaba** |

### Sección 13 — datos históricos

El último bloque de 012 (`update movimientos_stock set tipo = 'salida' ...`)
**no toca el esquema**: sólo corrige el `tipo` de los movimientos manuales ya
registrados. Puedes comentarlo si prefieres no modificar datos.

### Qué arregla 013 (`20260930_013_integridad_y_auditoria.sql`)

| # | Problema que resolvía |
|---|---|
| 1 | 20 facturas anuladas antes de 011 no tenían `fecha_anulacion` ni `razon_anulacion` → `/facturas/anuladas` salía con fecha vacía y **el filtro por rango las escondía todas** |
| 2 | 23 clientes `"Consumidor final"` duplicados (uno por venta, RPC antigua) → reportes fragmentados |
| 3 | Faltaba `UNIQUE (identificacion)` en `clientes` (sólo existía en el baseline) → reutilización sin garantía y vulnerable a carrera |
| 4 | Faltaba `UNIQUE (factura_id, producto_id)` en `items_factura` (sólo en el baseline) |
| 5 | La policy de `items_factura` no heredó `is_active_user()` ni `estado <> 'anulada'` → hueco de RLS heredado de 001 |
| 6 | `negocio.mensaje_agradecimiento` era una columna huérfana (su valor ya vive en `negocio_mensajes`) |

> ⚠️ El paso 1 y 2 deshabilitan temporalmente el trigger
> `trg_bloquear_modificacion_anulada` (si no, rechaza cualquier UPDATE sobre
> facturas anuladas). Si algo falla, todo el bloque se revierte solo.
> Recomiendo un **snapshot de la tabla `clientes`** antes de ejecutarla.

---

## Archivos de `migrations/`

| Archivo | Contenido |
|---|---|
| `20260429_001_init.sql` | Esquema base, RLS, RPC originales |
| `20260430_002_clientes_campos.sql` | `clientes.nit`, `clientes.email` |
| `20260430_003_precio_costo_kardex.sql` | `precio_costo`, `costo_unitario`; reescribe 2 RPC |
| `20260430_004_negocio.sql` | Tabla `negocio` + RLS + seed |
| `20260430_005_usuarios_email.sql` | `usuarios.email`; reescribe el trigger |
| `20260430_006_anular_factura.sql` | Enum `anulada`; RPC `anular_factura(uuid)` |
| `20260501_007_negocio_email_mensajes.sql` | `negocio.email`; tabla `negocio_mensajes` |
| `20260502_008_realtime_facturas.sql` | Realtime sobre `facturas` |
| `20260503_009_puede_crear_productos.sql` | `usuarios.puede_crear_productos` |
| `20260917_010_razon_anulacion.sql` | `facturas.razon_anulacion` (**nunca se aplicó**) |
| `20260924_011_anulacion_auditoria.sql` | Auditoría de anulación, trigger de bloqueo |
| **`20260925_012_reparacion_critica.sql`** | **Reparación completa** |
| **`20260930_013_integridad_y_auditoria.sql`** | **Backfill de auditoría, dedupe de clientes, UNIQUEs, RLS de items, columna huérfana** |
| **`20261001_014_auditoria.sql`** | **Sistema de auditoría: tabla `auditoria_eventos`, permisos `puede_ver_auditoria` / `puede_exportar_auditoria`, IP de sesión, triggers en 6 tablas y RPC** |
| **`20261002_015_superadmin_rol.sql`** | **Añade el rol `superadmin` al enum `public.user_role`** |
| **`20261002_016_superadmin_guardas.sql`** | **`is_admin()` reconoce `superadmin`, policy que aísla la fila superadmin, trigger `trg_proteger_superadmin`, whitelist de `auditoria_registrar` y promoción de la cuenta autorizada** |
| **`20261002_017_confirmar_factura_superadmin.sql`** | **`confirmar_factura()` acepta el rol `superadmin`** |

Las 11 primeras son el **historial**. En una BD nueva no se ejecutan: el
baseline ya incluye todo su contenido en su versión corregida (incluida la
policy de `items_factura` que corrige 013 y el bloque 11 = auditoría de 014).

---

## Auditoría (014)

**Quién hizo qué, cuándo, sobre qué, con qué valor anterior → nuevo y por qué.**

| Pieza | Dónde | Qué hace |
|---|---|---|
| `public.auditoria_eventos` | tabla | Fila por evento; **inmutable** (trigger `BEFORE UPDATE OR DELETE` lanza excepción, sin policies de escritura, `REVOKE` a los roles de la app) |
| `public.auditoria_trigger()` | triggers en `productos`, `clientes`, `facturas`, `movimientos_stock`, `usuarios`, `negocio` | Escribe el evento con OLD/NEW exactos en **cada escritura**, venga de la app o de una consulta directa |
| `public.auditoria_registrar(...)` | RPC | Única vía de la app y sólo para eventos sin fila en una tabla: `LOGIN`, `LOGIN_FALLIDO`, `LOGOUT`, `USUARIO_CREADO`, `USUARIO_MODIFICADO` (cambio de contraseña), `USUARIO_ELIMINADO`, `EXPORTACION_AUDITORIA` |
| `public.auditoria_registrar_ip(...)` | RPC | Guarda la IP de la sesión en `usuarios.ultima_ip` para que los triggers la incluyan |
| `puede_ver_auditoria()` / `puede_exportar_auditoria()` | helpers RLS | Admin siempre; el resto según `usuarios.puede_ver_auditoria` / `usuarios.puede_exportar_auditoria` |
| `src/lib/audit.ts` | app | `auditService.log()`: nunca lanza excepciones, un fallo de auditoría no rompe el negocio |
| `/auditoria` | app | Listado con filtros (usuario, fechas, acción, módulo, producto, factura, cliente), detalle con tabla ANTES → DESPUÉS y exportación CSV |

Los permisos se conceden desde **/admin/usuarios** (columnas *Ver auditoría* y
*Exportar auditoría*) o con SQL:

```sql
update public.usuarios
   set puede_ver_auditoria = true, puede_exportar_auditoria = true
 where email = 'vendedor@empresa.com';
```

Comprobación: `scripts/verificar-auditoria.sql` (ejecutar en el SQL Editor).

---

## Estado de la BD antes de 012 (comprobado el 2026-09-25)

| Comprobación | Resultado |
|---|---|
| Tablas expuestas por PostgREST | `facturas, items_factura, productos, clientes, usuarios, movimientos_stock, negocio, negocio_mensajes` |
| `factura_items` (la que usa el código en 9 sitios) | **No existe** → debe ser `items_factura` |
| `items_factura.subtotal` | **No existe** → debe ser `subtotal_item` |
| `facturas.razon_anulacion` | **No existe** (migración 010 sin aplicar) |
| RPC disponibles | `confirmar_factura`, `anular_factura`, `ajustar_stock_manual`, `marcar_factura_impresa`, `is_admin`, `current_user_role` |

---

## No hay `supabase/config.toml`

El proyecto **no** está vinculado al CLI de Supabase: las migraciones se
aplican a mano desde el SQL Editor, como se describe arriba. Si en algún
momento quieres `supabase db push`, habría que ejecutar `supabase init`
(y revisar que no pise los archivos existentes).
