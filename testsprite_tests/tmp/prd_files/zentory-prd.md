# ZENTORY
## Product Requirements Document
### Sistema de Inventario y Facturación con Impresión Remota

| Campo | Valor |
|---|---|
| Versión | 1.0 |
| Fecha | Abril 2026 |
| Estado | En desarrollo |
| Clasificación | Confidencial |

---

## Tabla de Contenido

1. [Resumen Ejecutivo](#1-resumen-ejecutivo)
2. [Usuarios y Roles](#2-usuarios-y-roles)
3. [Stack Tecnológico](#3-stack-tecnológico)
4. [Esquema de Base de Datos](#4-esquema-de-base-de-datos)
5. [Especificaciones de Impresión](#5-especificaciones-de-impresión)
6. [Plan de Desarrollo por Fases](#6-plan-de-desarrollo-por-fases)
7. [Exclusiones Explícitas v1](#7-exclusiones-explícitas-v1)
8. [Supuestos y Decisiones Cerradas](#8-supuestos-y-decisiones-cerradas)

---

## 1. Resumen Ejecutivo

Zentory es una aplicación web progresiva (PWA) diseñada para negocios físicos que necesitan gestionar su inventario y generar facturas desde cualquier dispositivo, con impresión automática en una impresora térmica conectada al computador.

El sistema elimina la dependencia de un único punto de venta al permitir que los vendedores operen desde sus celulares, mientras la impresión ocurre de forma automática en el computador del negocio sin intervención manual adicional.

**Stack principal:** Next.js 14 + Supabase + Vercel. **Tiempo estimado:** 6 semanas.

### 1.1 Objetivos del Producto

- Permitir la gestión de inventario (CRUD de productos, control de stock, movimientos) desde cualquier dispositivo.
- Habilitar la generación de facturas desde celular o computador con escaneo de códigos de barras.
- Automatizar la impresión térmica en el computador del negocio al confirmar una venta desde cualquier dispositivo.
- Implementar control de acceso por roles (admin y vendedor) con seguridad en base de datos vía RLS.
- Ser instalable como PWA en móvil y desktop para operación diaria sin fricción.

### 1.2 Problema que Resuelve

Los negocios con un único computador de caja generan cuellos de botella cuando múltiples personas necesitan facturar. Zentory desacopla el punto de creación de la factura (cualquier dispositivo) del punto de impresión (el computador con impresora), optimizando el flujo operativo sin necesidad de infraestructura adicional como scripts locales o servidores dedicados.

---

## 2. Usuarios y Roles

El sistema contempla dos roles con permisos diferenciados, implementados mediante Supabase Row Level Security (RLS). Ninguna lógica de autorización vive exclusivamente en el cliente.

| Módulo | Admin | Vendedor |
|---|---|---|
| Autenticación | Login/logout con credenciales propias | Login/logout con credenciales propias |
| Inventario | CRUD completo, ajuste stock, activar/desactivar | Solo lectura, alertas de stock mínimo |
| Facturación | Crear facturas, ver todas las facturas | Crear facturas, ver solo sus propias facturas |
| Impresión | Acceso a /imprimir, marcar facturas como impresas | Sin acceso a /imprimir ni a cambio de estado |
| Usuarios | Crear y desactivar vendedores | Sin acceso |
| Historial | Historial completo de todos los vendedores | Solo su propio historial |

> **Nota:** el cambio de estado de una factura de `pendiente_impresion` a `impresa` solo puede realizarlo un usuario con rol `admin`, y únicamente desde la página `/imprimir`. Esta restricción está implementada a nivel de RLS y de RPC (`marcar_factura_impresa`), no solo en la interfaz.

### 2.1 Flujo del Vendedor

1. Ingresa a la aplicación con sus credenciales propias (email + contraseña).
2. Desde el dashboard accede al módulo de Facturas.
3. Presiona "Añadir producto" para activar la cámara y escanear el código de barras.
4. Ajusta cantidad y descuento (por porcentaje o valor fijo) para cada producto.
5. Opcionalmente aplica un descuento global sobre el total de la factura.
6. Presiona "Imprimir factura": la factura se guarda en Supabase con estado `pendiente_impresion`.
7. La impresión ocurre automáticamente en el computador sin que el vendedor deba hacer nada más.

### 2.2 Flujo del Computador de Impresión

El computador del negocio mantiene abierta la página `/imprimir` con sesión admin activa:

- Al iniciar sesión en `/imprimir`, carga el backlog de facturas con estado `pendiente_impresion` aún no procesadas.
- Está suscrito via Supabase Realtime a nuevas facturas pendientes.
- Al detectar una factura pendiente, carga el detalle completo y ejecuta `window.print()` automáticamente.
- Tras impresión exitosa, invoca `marcar_factura_impresa` para actualizar el estado a `impresa`.
- Si la impresión falla o el PC pierde sesión, el estado permanece `pendiente_impresion` para reintento automático.
- Un indicador visual muestra el estado de conexión: 🟢 "Conectado y escuchando" / 🔴 "Sin sesión / reconectando".
- Si la sesión expira, redirige automáticamente al login y de vuelta a `/imprimir` tras autenticarse.

---

## 3. Stack Tecnológico

| Componente | Tecnología | Razón |
|---|---|---|
| Framework | Next.js 14 (App Router) | SSR, rutas protegidas, PWA |
| Estilos | Tailwind CSS | Responsivo móvil/desktop |
| Base de datos | Supabase (PostgreSQL + Auth + Realtime + RLS) | Todo integrado, tiempo real |
| Estado local | Zustand + persist middleware | Carrito persistido en localStorage |
| Escáner | @zxing/browser | Mejor soporte códigos 1D (EAN-13, Code128) |
| Impresión | react-to-print + @media print | Formato térmico 80mm optimizado |
| Hosting | Vercel | Integración nativa Next.js, CI/CD automático |
| PWA | next-pwa | Instalable, modo offline parcial |

### 3.1 Decisiones de Arquitectura Relevantes

**¿Por qué `@zxing/browser` en lugar de `html5-qrcode`?**
`@zxing/browser` tiene mejor soporte para códigos de barras 1D (EAN-13, Code128), que son los más comunes en productos físicos. `html5-qrcode` es superior para QR pero limitado en 1D.

**¿Por qué Zustand con `persist` en lugar de TanStack Query?**
Con Supabase Realtime ya existe un canal de datos en vivo. TanStack Query generaría dos fuentes de verdad difíciles de sincronizar. Zustand con `persist` middleware cubre el estado local del carrito y lo persiste en `localStorage`, previniendo pérdida de datos ante recargas accidentales en móvil.

**¿Por qué impresión híbrida sin script local?**
La alternativa de un script Node.js/Python local introduce un componente frágil que requiere monitoreo, reinicio automático (PM2) y manejo de errores adicional. El modelo híbrido con Supabase Realtime + `window.print()` en el computador logra impresión prácticamente automática sin infraestructura extra.

---

## 4. Esquema de Base de Datos

Todas las tablas tienen RLS habilitado. La función helper `current_user_role()` se usa en las políticas para evitar joins repetitivos.

### 4.1 `usuarios`

| Campo | Tipo | Restricción | Descripción |
|---|---|---|---|
| id | uuid PK | FK → auth.users | Sincronizado con Supabase Auth via trigger |
| nombre | text | NOT NULL | Nombre del usuario |
| rol | enum | admin \| vendedor | Define permisos en RLS |
| activo | boolean | default true | Usuario inactivo no puede autenticarse |
| created_at | timestamptz | default now() | Fecha de creación |

### 4.2 `productos`

| Campo | Tipo | Restricción | Descripción |
|---|---|---|---|
| id | uuid PK | NOT NULL | Identificador único |
| nombre | text | NOT NULL | Nombre del producto |
| sku_code | text | UNIQUE NOT NULL | Código de barras (índice para búsqueda rápida) |
| precio_venta | numeric(12,2) | >= 0 | Precio unitario de venta |
| stock_actual | int | >= 0 | Cantidad disponible actual |
| minimo_stock | int | >= 0 | Umbral de alerta de bajo stock |
| activo | boolean | default true | Producto inactivo no aparece en búsquedas |
| created_at | timestamptz | default now() | Fecha de creación |

### 4.3 `movimientos_stock`

| Campo | Tipo | Restricción | Descripción |
|---|---|---|---|
| id | uuid PK | NOT NULL | Identificador único |
| producto_id | uuid FK | → productos | Producto afectado |
| tipo | enum | entrada \| salida \| ajuste | Tipo de movimiento |
| cantidad | int | > 0 | Unidades movidas |
| motivo | text | NOT NULL | Ej: 'venta', 'ajuste_manual' |
| factura_id | uuid FK | nullable → facturas | Solo en movimientos tipo venta |
| usuario_id | uuid FK | → usuarios | Quién generó el movimiento |
| created_at | timestamptz | default now() | Timestamp del movimiento |

### 4.4 `clientes`

| Campo | Tipo | Restricción | Descripción |
|---|---|---|---|
| id | uuid PK | NOT NULL | Identificador único |
| nombre | text | NOT NULL | Nombre del cliente |
| identificacion | text | NOT NULL | Número de documento |
| telefono | text | nullable | Teléfono de contacto |
| direccion | text | nullable | Dirección del cliente |
| created_at | timestamptz | default now() | Fecha de creación |

### 4.5 `facturas`

| Campo | Tipo | Restricción | Descripción |
|---|---|---|---|
| id | uuid PK | NOT NULL | Identificador único |
| numero_factura | bigint | UNIQUE, secuencia global | Número legible, autoincremental global |
| cliente_id | uuid FK | → clientes | Cliente asociado a la factura |
| vendedor_id | uuid FK | → usuarios | Vendedor que generó la factura |
| subtotal | numeric(12,2) | >= 0 | Suma de subtotales de ítems antes de descuento global |
| descuento_total | numeric(12,2) | <= subtotal | Monto final del descuento global aplicado |
| total | numeric(12,2) | >= 0 | subtotal - descuento_total, validado en RPC |
| estado | enum | pendiente_impresion \| impresa | Solo admin puede transicionar a impresa |
| created_at | timestamptz | default now() | Fecha y hora de creación |

### 4.6 `items_factura`

| Campo | Tipo | Restricción | Descripción |
|---|---|---|---|
| id | uuid PK | NOT NULL | Identificador único |
| factura_id | uuid FK | → facturas | Factura contenedora |
| producto_id | uuid FK | → productos | Producto vendido |
| cantidad | int | > 0 | Unidades vendidas |
| precio_unitario | numeric(12,2) | >= 0 | Precio en el momento de la venta |
| descuento_item | numeric(12,2) | >= 0 | Valor del descuento sobre este ítem |
| tipo_descuento_item | enum | porcentaje \| valor | Cómo interpretar descuento_item |
| subtotal_item | numeric(12,2) | >= 0 | Monto final del ítem tras descuento |

### 4.7 RPCs Principales

**`confirmar_factura`**
Transacción atómica que: valida rol activo, verifica stock suficiente por ítem, inserta factura con estado `pendiente_impresion`, inserta `items_factura`, descuenta `stock_actual`, e inserta `movimientos_stock` tipo `salida`. Si cualquier paso falla, revierte todo (rollback completo).

**`marcar_factura_impresa`**
Invocable únicamente por admin. Valida que el estado actual sea `pendiente_impresion` antes de transicionar a `impresa`. Implementada con `SECURITY DEFINER` para garantizar que la validación ocurra en el servidor.

**`ajustar_stock_manual`**
Solo admin. Actualiza `stock_actual` del producto y registra el movimiento en `movimientos_stock` con tipo `ajuste` y motivo obligatorio.

---

## 5. Especificaciones de Impresión

La impresora objetivo es la **SAT Serie Q22**, impresora térmica directa de 80mm. El componente de ticket debe estar diseñado específicamente para este hardware, no para una pantalla.

| Parámetro | Valor |
|---|---|
| Modelo | SAT Serie Q22 |
| Tecnología | Térmica directa (sin tinta) |
| Ancho de papel | 80 mm |
| Ancho útil de impresión | 72 mm (~4mm de margen por lado) |
| Resolución | 203 DPI (≈ 576 puntos de ancho) |
| Velocidad | 230 mm/s |
| Autocortador | Sí, hasta 1.5M cortes |
| Compatibilidad OS | Windows, macOS, Linux, Android |

### 5.1 Reglas CSS para el Ticket

- `width: 72mm` fijo en el componente de ticket.
- `@media print` oculta todo el contenido de la página excepto el componente de ticket.
- Fuentes: mínimo `8px` para texto secundario, máximo `14px` para títulos y totales.
- Logo del negocio: solo SVG o PNG de bajo peso. Sin imágenes decorativas.
- El autocortador se activa automáticamente al finalizar el job de impresión, sin control desde software.

### 5.2 Contenido del Ticket

- Encabezado: nombre del negocio, dirección, teléfono.
- Número de factura y fecha/hora.
- Datos del cliente: nombre e identificación.
- Tabla de productos: nombre, cantidad, precio unitario, descuento por ítem, subtotal por ítem.
- Descuento global (si aplica), con indicación de tipo (% o valor).
- Total a pagar (destacado).
- Nombre del vendedor.
- Mensaje de agradecimiento.

---

## 6. Plan de Desarrollo por Fases

| Fase | Nombre | Entregables clave | Tiempo estimado |
|---|---|---|---|
| 1 | Configuración y Auth | Next.js 14, Supabase, Auth, RLS base, triggers, semillas | Semana 1 |
| 2 | Módulo Inventario | CRUD productos, ajuste stock, movimientos, alertas mínimo | Semana 2 |
| 3 | Módulo Facturación | Carrito Zustand persistido, escaneo, descuentos, RPC atómica | Semana 3 |
| 4 | Impresión Remota | Realtime, /imprimir, react-to-print, ticket 80mm, reconexión | Semana 4 |
| 5 | Historial | Vistas por rol, filtros, detalle factura, paginación | Semana 5 |
| 6 | Pulido Final | PWA, mobile-first, alertas stock, hardening UX, E2E | Semana 6 |

### 6.1 Criterios Transversales de Aceptación

- Ninguna ruta crítica es accesible sin sesión válida y rol correcto.
- Todas las operaciones de escritura pasan por RPCs con validación en servidor.
- El carrito de factura se recupera ante recargas accidentales en móvil (localStorage).
- Las facturas no se pierden si el computador de impresión se apaga (estado persiste en BD).
- El ticket impreso contiene todos los campos requeridos y es legible en papel de 80mm.

---

## 7. Exclusiones Explícitas v1

| Exclusión | Nota |
|---|---|
| Reportes y analytics | No incluido en v1. Posible fase futura. |
| Métodos de pago / pasarelas | La factura es informativa, sin cobro integrado. |
| Facturación electrónica (DIAN) | No aplica en esta versión. |
| Notificaciones push | No incluido en v1. |
| Exportación PDF / Excel | No incluido en v1. |

---

## 8. Supuestos y Decisiones Cerradas

- **`numero_factura` es global.** Una sola secuencia para todo el negocio. Sin segmentación por sede o caja.
- **`descuento_total` persiste como valor monetario final.** Independientemente de si el descuento fue ingresado como porcentaje o valor fijo.
- **Si la impresión falla, la factura permanece en `pendiente_impresion`.** No existe un estado `error_impresion` separado. El reintento es automático por Realtime o manual recargando `/imprimir`.
- **Solo `admin` puede cambiar el estado de una factura a `impresa`.** El vendedor no tiene este permiso ni en RLS ni en RPC.
- **La sesión del computador de impresión es de un usuario `admin`.** No existe un rol técnico `impresor` separado. La seguridad física de la impresora es la barrera operativa suficiente.
- **El stock solo se descuenta al confirmar una factura.** No al añadir al carrito. El carrito es local y no reserva stock.
