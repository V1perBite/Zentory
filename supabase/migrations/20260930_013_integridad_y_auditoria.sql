-- ============================================================
-- 013 · Integridad de datos y auditoría de anulaciones
-- Fecha: 2026-09-30
-- Aplicar en: Supabase → SQL Editor (sobre la BD existente,
--             después de 012 si no se ha aplicado).
-- Idempotente: se puede ejecutar más de una vez.
--
-- Qué hace:
--   1. Backfill de auditoría de las facturas anuladas antes de 011
--      (fecha_anulacion / razon_anulacion = NULL en 20 facturas).
--      usuario_anulacion_id se deja NULL: no se inventa quién anuló;
--      la UI muestra "—".
--   2. Deduplica los 23 clientes "Consumidor final" (22222) creados
--      uno por venta por la RPC antigua: reapunta las facturas al
--      cliente más antiguo y borra los sobrantes.
--   3. UNIQUE en clientes.identificacion (existía sólo en el baseline).
--   4. UNIQUE en items_factura(factura_id, producto_id) (idem).
--   5. Policy items_factura_select_role: hereda is_active_user() y
--      estado <> 'anulada' para no-admin (hueco de RLS de 012).
--   6. DROP COLUMN negocio.mensaje_agradecimiento (huérfana; su valor
--      ya vive en negocio_mensajes tipo 'cierre').
--
-- Nota: el trigger trg_bloquear_modificacion_anulada rechaza cualquier
-- UPDATE sobre facturas anuladas, así que los pasos 1 y 2 se ejecutan
-- con el trigger deshabilitado. Si algo falla, el bloque completo se
-- revierte (DDL transaccional) y el trigger queda como estaba.
-- ============================================================

do $$
begin
  alter table public.facturas
    disable trigger trg_bloquear_modificacion_anulada;

  -- ── 1. Backfill de auditoría de anulaciones históricas ─────
  update public.facturas
     set fecha_anulacion   = created_at,
         razon_anulacion   = coalesce(
                               nullif(trim(razon_anulacion), ''),
                               'Anulación registrada antes de crear la auditoría de anulaciones'
                             )
   where estado = 'anulada'
     and fecha_anulacion is null;

  -- ── 2. Dedupe de clientes por identificacion ───────────────
  -- 2a. reapunta las facturas al cliente más antiguo de cada identificacion
  update public.facturas f
     set cliente_id = k.keep_id
    from (
      select identificacion,
             (array_agg(id order by created_at asc, id asc))[1] as keep_id
        from public.clientes
       group by identificacion
      having count(*) > 1
    ) k
   where f.cliente_id <> k.keep_id
     and f.cliente_id in (
           select c.id from public.clientes c
            where c.identificacion = k.identificacion
         );

  -- 2b. borra los clientes duplicados que ya no referencian ninguna factura
  delete from public.clientes c
   using (
     select identificacion,
            (array_agg(id order by created_at asc, id asc))[1] as keep_id
       from public.clientes
      group by identificacion
     having count(*) > 1
   ) k
   where c.identificacion = k.identificacion
     and c.id <> k.keep_id;

  alter table public.facturas
    enable trigger trg_bloquear_modificacion_anulada;
end $$;

-- ── 3. UNIQUE clientes.identificacion ───────────────────────
do $$
begin
  if not exists (
    select 1
      from pg_constraint
     where conname = 'clientes_identificacion_key'
       and conrelid = 'public.clientes'::regclass
  ) then
    alter table public.clientes
      add constraint clientes_identificacion_key unique (identificacion);
  end if;
end $$;

-- ── 4. UNIQUE items_factura(factura_id, producto_id) ────────
do $$
begin
  if not exists (
    select 1
      from pg_constraint
     where conname = 'items_factura_unica_por_producto'
       and conrelid = 'public.items_factura'::regclass
  ) then
    alter table public.items_factura
      add constraint items_factura_unica_por_producto unique (factura_id, producto_id);
  end if;
end $$;

-- ── 5. RLS de items_factura alineada con 012 ────────────────
-- Antes faltaba is_active_user(): un usuario desactivado seguía
-- pudiendo leer ítems. Antes faltaba estado <> 'anulada': un vendedor
-- podía leer los ítems de una factura anulada sin ver su cabecera.
drop policy if exists items_factura_select_role on public.items_factura;
create policy items_factura_select_role on public.items_factura
  for select using (
    exists (
      select 1 from public.facturas f
       where f.id = items_factura.factura_id
         and public.is_active_user()
         and (
              public.is_admin()
              or (f.vendedor_id = auth.uid() and f.estado <> 'anulada')
            )
    )
  );

-- ── 6. Columna huérfana ─────────────────────────────────────
-- Valor ya migrado a negocio_mensajes (tipo 'cierre'):
--   "Gracias por tenernos en cuenta!!"
alter table public.negocio
  drop column if exists mensaje_agradecimiento;
