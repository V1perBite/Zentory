# PRD — Zentory

## 1) Resumen del producto
Zentory es una aplicación web de inventario y facturación orientada a operación de punto de venta con impresión de tickets. El sistema permite autenticación por roles, gestión de inventario, creación de facturas con escaneo de códigos de barras, consulta de historial y un centro de impresión automática para facturas pendientes.

## 2) Objetivo
Centralizar en una sola plataforma el flujo operativo de:
- Control de productos y stock.
- Generación de facturas con descuentos.
- Seguimiento de ventas por vendedor.
- Impresión de tickets en cola.

## 3) Alcance
### Incluido (MVP actual)
- Login con Supabase Auth y validación de usuario activo.
- Dashboard con accesos por módulo y alerta de bajo stock.
- Inventario con lectura de stock para todos y herramientas de administración para `admin`.
- Facturación con carrito persistente, lectura por SKU y escáner de cámara.
- Historial de facturas con filtros.
- Detalle de factura en formato ticket.
- Centro de impresión automática para facturas pendientes (solo admin).

### Fuera de alcance (actual)
- Pasarela de pago integrada.
- Facturación fiscal electrónica con integración gubernamental.
- Multi-sucursal / multi-bodega nativo.
- Auditoría avanzada y analítica BI.

## 4) Tipos de usuario
1. **Administrador (`admin`)**
   - Acceso total a módulos.
   - CRUD de productos y ajustes de stock.
   - Acceso al centro de impresión.
   - Vista global del historial.

2. **Vendedor (`vendedor`)**
   - Acceso a dashboard, inventario lectura, facturas e historial propio.
   - Sin acceso a impresión central ni administración de inventario.

## 5) Rutas y módulos
- `/login`: autenticación.
- `/dashboard`: resumen operativo y navegación.
- `/inventario`: consulta stock + acciones admin.
- `/facturas`: entrada al módulo de facturación.
- `/facturas/nueva`: creación de factura.
- `/historial`: listado de facturas con filtros.
- `/historial/[id]`: detalle de factura.
- `/imprimir`: cola de impresión (admin).

## 6) Requerimientos funcionales
### RF-01 Autenticación y sesión
- El usuario debe iniciar sesión con email y contraseña.
- Si el usuario no tiene perfil activo, debe bloquearse el acceso.
- Las rutas protegidas deben redirigir a `/login` si no hay sesión válida.

### RF-02 Control de acceso por rol
- `admin` ve y usa herramientas administrativas de inventario.
- `vendedor` no puede acceder a funciones administrativas ni `/imprimir`.

### RF-03 Inventario
- Listar productos con `stock_actual`, `minimo_stock`, precio y estado activo.
- Mostrar movimientos recientes de stock (admin).
- Permitir crear, editar, activar/desactivar productos (admin).
- Permitir ajuste manual de stock vía procedimiento transaccional (admin).

### RF-04 Facturación
- Permitir agregar productos por SKU manual o escaneo de código de barras.
- Mantener carrito con cantidades y descuentos por ítem/global.
- Capturar datos mínimos de cliente.
- Confirmar factura mediante RPC, persistiendo cabecera + detalle.
- Cambiar estado inicial de factura a pendiente de impresión.

### RF-05 Historial de ventas
- Listar facturas con filtros por número, estado y fecha.
- `admin` puede ver facturas globales; `vendedor` solo propias.
- Ver detalle de factura en formato ticket.

### RF-06 Impresión automática
- Cargar facturas pendientes al abrir el módulo.
- Escuchar nuevos inserts de facturas pendientes en tiempo real.
- Imprimir ticket y marcar factura como impresa.
- Mantener cola cuando hay fallos de impresión.

## 7) Requerimientos no funcionales
- **RNF-01 Seguridad:** sesión y permisos gestionados con Supabase y validaciones por ruta.
- **RNF-02 Rendimiento:** tiempos de carga razonables en tablas de hasta 100–300 registros por consulta en vistas principales.
- **RNF-03 UX operativa:** interfaz simple y rápida para uso en caja.
- **RNF-04 Disponibilidad funcional:** impresión dependiente de una sesión admin activa en `/imprimir`.
- **RNF-05 Escalabilidad técnica:** arquitectura preparada para crecer con más módulos sobre App Router.

## 8) Stack técnico
- **Frontend:** Next.js 14 (App Router), React 18, TypeScript.
- **UI:** Tailwind CSS.
- **Estado cliente:** Zustand (persistencia local de carrito).
- **Backend BaaS:** Supabase (Auth, DB, Realtime, RPC).
- **Integraciones:** ZXing (escaneo), react-to-print (impresión).

## 9) Modelo de datos (alto nivel)
- `usuarios`: identidad interna, rol, estado activo.
- `productos`: catálogo, SKU, precio, stock, mínimo, activo.
- `movimientos_stock`: trazabilidad de ajustes y movimientos.
- `clientes`: datos de comprador.
- `facturas`: cabecera de venta, vendedor, totales, estado.
- `items_factura`: detalle por producto.

## 10) Flujos principales
1. **Login** → validación de perfil activo → dashboard.
2. **Venta** → agregar ítems/escaneo → aplicar descuentos → confirmar factura.
3. **Impresión** → cola detecta pendiente → render ticket → marcar impresa.
4. **Inventario admin** → crear/editar producto o ajustar stock.

## 11) Métricas de éxito sugeridas
- Tiempo promedio de creación de factura.
- % de facturas impresas en menos de 1 minuto.
- Tasa de errores en confirmación de factura.
- Número de productos bajo stock por día.
- Uso de escaneo vs ingreso manual de SKU.

## 12) Riesgos y dependencias
### Riesgos
- Si no hay pestaña admin en `/imprimir`, las facturas pueden quedar pendientes.
- Errores de cámara/permiso pueden degradar el flujo de escaneo.

### Dependencias
- Variables de entorno Supabase configuradas.
- Procedimientos RPC y esquema SQL desplegados.
- Dispositivo de impresión y navegador compatibles.

## 13) Roadmap propuesto
### Fase 1 (estabilización)
- Robustecer manejo de errores de impresión.
- Mejorar feedback visual y reintentos en facturación.

### Fase 2 (operación)
- Reportes de ventas por período y vendedor.
- Exportación CSV/PDF de historial.

### Fase 3 (expansión)
- Multi-sucursal.
- Integración con métodos de pago y facturación electrónica.

## 14) Criterios de aceptación (MVP)
- Un vendedor activo inicia sesión y crea una factura completa.
- Un admin gestiona productos y ajusta stock exitosamente.
- El historial refleja la factura creada y su detalle.
- El centro de impresión procesa facturas pendientes y actualiza estado.
- Las rutas restringidas no son accesibles por usuarios sin permiso.
