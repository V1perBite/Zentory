-- ============================================================
-- 20260925_012_reparacion_critica.sql
-- ============================================================
--
-- PARA QUÉ SIRVE
--   Repara la base de datos EXISTENTE sin borrar nada.
--   No hace falta resetear: se aplica encima y es 100 % idempotente
--   (se puede ejecutar más de una vez sin efectos secundarios).
--
-- SI EN CAMBIO VAS A CREAR LA BD DESDE CERO, NO EJECUTES ESTO:
--   usa supabase/baseline/ZENTORY_BASELINE.sql
--   Instrucciones en supabase/README.md
--
-- QUÉ ARREGLA
--   1. Falta la columna facturas.razon_anulacion -> la migración 010
--      nunca se aplicó, y por eso anular_factura() falla en runtime
--      con "column facturas.razon_anulacion does not exist".
--   2. confirmar_factura(): admite items null, no ordena los FOR UPDATE
--      (posible deadlock), no valida descuentos y CREA UN CLIENTE NUEVO
--      POR CADA VENTA (infla la tabla clientes).
--   3. anular_factura(): DISTINCT ON perdía stock con productos repetidos.
--   4. ajustar_stock_manual(): guardaba las salidas manuales como
--      'ajuste' con cantidad positiva -> el kardex las SUMABA y el
--      reporte de Mermas nunca devolvía filas.
--   5. La bandera puede_crear_productos no tenía política RLS:
--      el vendedor veía el botón y recibía error de seguridad.
--   6. Un usuario DESACTIVADO seguía leyendo datos (las políticas no
--      comprobaban usuarios.activo).
--   7. Un vendedor podía leer facturas anuladas a nivel API.
--   8. Cualquier autenticado podía INSERTAR en clientes por PostgREST.
--   9. Faltaban índices para las consultas de dashboard y reportes.
--  10. Las RPC de negocio eran ejecutables desde anon/PUBLIC.
--  11. Existía current_user_role(), que nunca se invocaba.
-- ============================================================


-- ============================================================
-- 1. COLUMNA QUE FALTA (migración 010 no aplicada)
-- ============================================================
-- Sin esto, public.anular_factura() revienta en el UPDATE final.
alter table public.facturas
  add column if not exists razon_anulacion text;


-- ============================================================
-- 2. FUNCIONES AUXILIARES PARA LAS POLÍTICAS RLS
-- ============================================================
-- (van antes que las políticas: CREATE POLICY falla si la función
--  que invoca todavía no existe)

create or replace function public.is_active_user()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.usuarios u
    where u.id = auth.uid() and u.activo = true
  );
$$;

create or replace function public.can_create_products()
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.is_admin() or exists (
    select 1 from public.usuarios u
    where u.id = auth.uid() and u.activo = true and u.puede_crear_productos = true
  );
$$;

grant execute on function public.is_active_user()      to public;
grant execute on function public.can_create_products() to public;
grant execute on function public.is_admin()            to public;


-- ============================================================
-- 3. ÍNDICES QUE FALTABAN
-- ============================================================
create index if not exists idx_facturas_created_at
  on public.facturas (created_at desc);
create index if not exists idx_facturas_estado
  on public.facturas (estado);
create index if not exists idx_facturas_cliente
  on public.facturas (cliente_id);
create index if not exists idx_items_factura_producto
  on public.items_factura (producto_id);
create index if not exists idx_movimientos_factura
  on public.movimientos_stock (factura_id);


-- ============================================================
-- 4. RPC: ajustar_stock_manual
-- ============================================================
-- Cambio de comportamiento:
--   p_cantidad > 0 -> movimiento 'entrada'
--   p_cantidad < 0 -> movimiento 'salida'   (antes: 'ajuste')
-- Así el kardex resta las salidas manuales y el reporte de Mermas
-- encuentra los registros.
-- Nota: la firma sigue siendo (uuid, integer, text, numeric) con el
-- cuarto parámetro opcional; el cliente ya funciona con ella.

drop function if exists public.ajustar_stock_manual(uuid, integer, text);

create or replace function public.ajustar_stock_manual(
  p_producto_id    uuid,
  p_cantidad       integer,
  p_motivo         text default 'ajuste_manual',
  p_costo_unitario numeric default null
)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_user_id      uuid := auth.uid();
  v_stock_actual integer;
begin
  if not public.is_admin() then
    raise exception 'Solo admin puede ajustar stock';
  end if;

  if p_cantidad is null or p_cantidad = 0 then
    raise exception 'La cantidad de ajuste no puede ser 0';
  end if;

  if coalesce(trim(p_motivo), '') = '' then
    raise exception 'El motivo del ajuste es obligatorio';
  end if;

  select stock_actual into v_stock_actual
  from public.productos
  where id = p_producto_id
  for update;

  if not found then
    raise exception 'Producto no encontrado';
  end if;

  if v_stock_actual + p_cantidad < 0 then
    raise exception 'Stock insuficiente para aplicar ajuste';
  end if;

  update public.productos
  set stock_actual = stock_actual + p_cantidad,
      precio_costo = case
        when p_cantidad > 0 and coalesce(p_costo_unitario, 0) > 0
          then p_costo_unitario
        else precio_costo
      end
  where id = p_producto_id;

  insert into public.movimientos_stock (
    producto_id, tipo, cantidad, motivo, usuario_id, costo_unitario
  )
  values (
    p_producto_id,
    case when p_cantidad > 0 then 'entrada'::public.movimiento_tipo
         else 'salida'::public.movimiento_tipo end,
    greatest(abs(p_cantidad), 1),
    trim(p_motivo),
    v_user_id,
    case when p_cantidad > 0 then p_costo_unitario else null end
  );
end;
$$;

revoke all on function public.ajustar_stock_manual(uuid, integer, text, numeric) from public, anon;
grant execute on function public.ajustar_stock_manual(uuid, integer, text, numeric) to authenticated;


-- ============================================================
-- 5. RPC: confirmar_factura  (v3)
-- ============================================================
-- Se elimina antes la versión antigua para que no queden sobras de
-- la firma/permisos anteriores.
drop function if exists public.confirmar_factura(jsonb);

create or replace function public.confirmar_factura(payload jsonb)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_user_id          uuid := auth.uid();
  v_cliente_id       uuid;
  v_ident            text;
  v_factura_id       uuid;
  v_numero_factura   bigint;
  v_subtotal         numeric(12,2) := 0;
  v_descuento_total  numeric(12,2) := 0;
  v_total            numeric(12,2) := 0;
  v_desc_global_tipo public.tipo_descuento;
  v_desc_global_valor numeric(12,2);
  v_raw_items        jsonb;
  v_items            jsonb;
  v_item             jsonb;
  v_producto         record;
  v_cantidad         integer;
  v_desc_item        numeric(12,2);
  v_desc_item_tipo   public.tipo_descuento;
  v_bruto            numeric(12,2);
  v_subtotal_item    numeric(12,2);
  v_estado           public.factura_estado;
begin
  -- ── Autenticación y permisos ──────────────────────────────
  if v_user_id is null then
    raise exception 'No autenticado';
  end if;

  if not exists (
    select 1 from public.usuarios u
    where u.id = v_user_id and u.activo = true
      and u.rol in ('admin', 'vendedor')
  ) then
    raise exception 'Usuario sin permisos para facturar';
  end if;

  -- ── Validación de ítems ───────────────────────────────────
  -- La versión anterior no cubría el caso payload->'items' = NULL:
  -- jsonb_array_length(NULL) devuelve NULL y la condición no se
  -- cumplía, con lo que se llegaba a insertar una factura vacía.
  v_raw_items := payload -> 'items';

  if v_raw_items is null
     or jsonb_typeof(v_raw_items) <> 'array'
     or jsonb_array_length(v_raw_items) = 0 then
    raise exception 'La factura debe tener al menos un ítem';
  end if;

  if exists (
    select 1 from jsonb_array_elements(v_raw_items) as i
    where coalesce(nullif(trim(i ->> 'producto_id'), ''), '') = ''
    limit 1
  ) then
    raise exception 'Todos los ítems deben indicar un producto válido';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(v_raw_items) as i
    group by (i ->> 'producto_id')
    having count(*) > 1
       and count(distinct (
             coalesce(i ->> 'descuento_item', '0') || '|' ||
             coalesce(i ->> 'tipo_descuento_item', 'valor')
           )) > 1
  ) then
    raise exception 'Un mismo producto aparece varias veces con descuentos distintos';
  end if;

  -- Deduplica: suma cantidades de un mismo producto
  select coalesce(
           jsonb_agg(
             jsonb_build_object(
               'producto_id',         producto_id,
               'cantidad',            cantidad,
               'descuento_item',      descuento_item,
               'tipo_descuento_item', tipo_descuento_item
             )
             order by producto_id
           ),
           '[]'::jsonb
         )
  into v_items
  from (
    select
      (i ->> 'producto_id')::uuid                                 as producto_id,
      sum(greatest(coalesce((i ->> 'cantidad')::integer, 1), 1))  as cantidad,
      max(coalesce((i ->> 'descuento_item')::numeric, 0))         as descuento_item,
      max(coalesce((i ->> 'tipo_descuento_item')::text, 'valor')) as tipo_descuento_item
    from jsonb_array_elements(v_raw_items) as i
    group by (i ->> 'producto_id')
  ) dedup;

  -- ── Descuento global ──────────────────────────────────────
  v_desc_global_tipo  := coalesce((payload ->> 'descuento_global_tipo')::public.tipo_descuento, 'valor');
  v_desc_global_valor := coalesce((payload ->> 'descuento_global_valor')::numeric, 0);

  if v_desc_global_valor < 0 then
    raise exception 'El descuento global no puede ser negativo';
  end if;

  -- ── Cliente: reutiliza o crea ─────────────────────────────
  if nullif(trim(payload ->> 'cliente_id'), '') is not null then
    begin
      v_cliente_id := (payload ->> 'cliente_id')::uuid;
    exception when invalid_text_representation then
      raise exception 'Identificador de cliente inválido';
    end;

    if not exists (select 1 from public.clientes where id = v_cliente_id) then
      raise exception 'Cliente no encontrado';
    end if;
  else
    v_ident := coalesce(nullif(trim(payload -> 'cliente' ->> 'identificacion'), ''), '22222');

    select id into v_cliente_id
    from public.clientes
    where identificacion = v_ident
    limit 1;

    if v_cliente_id is null then
      insert into public.clientes (nombre, identificacion, nit, email, telefono, direccion)
      values (
        coalesce(nullif(trim(payload -> 'cliente' ->> 'nombre'), ''), 'Consumidor final'),
        v_ident,
        nullif(trim(payload -> 'cliente' ->> 'nit'), ''),
        nullif(trim(payload -> 'cliente' ->> 'email'), ''),
        nullif(trim(payload -> 'cliente' ->> 'telefono'), ''),
        nullif(trim(payload -> 'cliente' ->> 'direccion'), '')
      )
      returning id into v_cliente_id;
    else
      update public.clientes
      set nombre     = case
                         when nullif(trim(payload -> 'cliente' ->> 'nombre'), '') is not null
                          and nullif(trim(payload -> 'cliente' ->> 'nombre'), '') <> 'Consumidor final'
                           then trim(payload -> 'cliente' ->> 'nombre')
                         else nombre
                       end,
          nit        = coalesce(nullif(trim(payload -> 'cliente' ->> 'nit'), ''), nit),
          email      = coalesce(nullif(trim(payload -> 'cliente' ->> 'email'), ''), email),
          telefono   = coalesce(nullif(trim(payload -> 'cliente' ->> 'telefono'), ''), telefono),
          direccion  = coalesce(nullif(trim(payload -> 'cliente' ->> 'direccion'), ''), direccion)
      where id = v_cliente_id;
    end if;
  end if;

  -- ── Estado resultante ─────────────────────────────────────
  v_estado := case
    when coalesce((payload ->> 'guardar_sin_imprimir')::boolean, false)
      then 'impresa'::public.factura_estado
    else 'pendiente_impresion'::public.factura_estado
  end;

  -- ── PASO 1: bloquea productos y calcula totales ───────────
  -- v_items está ordenado por producto_id: los FOR UPDATE se toman
  -- siempre en el mismo orden y dos facturas simultáneas no pueden
  -- provocar un deadlock (antes el orden era el del payload).
  for v_item in select * from jsonb_array_elements(v_items) loop
    select p.id, p.nombre, p.precio_venta, p.stock_actual, p.precio_costo
    into v_producto
    from public.productos p
    where p.id = (v_item ->> 'producto_id')::uuid
      and p.activo = true
    for update;

    if not found then
      raise exception 'Producto no encontrado o inactivo';
    end if;

    v_cantidad := greatest(coalesce((v_item ->> 'cantidad')::integer, 1), 1);

    if v_producto.stock_actual < v_cantidad then
      raise exception 'Stock insuficiente para %', v_producto.nombre;
    end if;

    v_desc_item      := coalesce((v_item ->> 'descuento_item')::numeric, 0);
    v_desc_item_tipo := coalesce((v_item ->> 'tipo_descuento_item')::public.tipo_descuento, 'valor');

    if v_desc_item < 0 then
      raise exception 'El descuento por ítem no puede ser negativo';
    end if;

    v_bruto := v_producto.precio_venta * v_cantidad;

    if v_desc_item_tipo = 'porcentaje' then
      if v_desc_item > 100 then
        raise exception 'El descuento porcentual no puede superar el 100%%';
      end if;
      v_subtotal_item := greatest(v_bruto - ((v_bruto * v_desc_item) / 100), 0);
    else
      v_subtotal_item := greatest(v_bruto - v_desc_item, 0);
    end if;

    v_subtotal := v_subtotal + v_subtotal_item;
  end loop;

  -- ── Descuento global ──────────────────────────────────────
  if v_desc_global_tipo = 'porcentaje' then
    if v_desc_global_valor > 100 then
      raise exception 'El descuento global no puede superar el 100%%';
    end if;
    v_descuento_total := greatest((v_subtotal * v_desc_global_valor) / 100, 0);
  else
    v_descuento_total := greatest(v_desc_global_valor, 0);
  end if;

  v_descuento_total := least(v_descuento_total, v_subtotal);
  v_total           := v_subtotal - v_descuento_total;

  -- ── PASO 2: cabecera ──────────────────────────────────────
  insert into public.facturas (
    cliente_id, vendedor_id, subtotal, descuento_total, total, estado
  )
  values (
    v_cliente_id, v_user_id, v_subtotal, v_descuento_total, v_total, v_estado
  )
  returning id, numero_factura into v_factura_id, v_numero_factura;

  -- ── PASO 3: detalle, stock y kardex ───────────────────────
  for v_item in select * from jsonb_array_elements(v_items) loop
    select p.id, p.nombre, p.precio_venta, p.stock_actual, p.precio_costo
    into v_producto
    from public.productos p
    where p.id = (v_item ->> 'producto_id')::uuid
      and p.activo = true
    for update;

    if not found then
      raise exception 'Producto no encontrado o inactivo';
    end if;

    v_cantidad       := greatest(coalesce((v_item ->> 'cantidad')::integer, 1), 1);
    v_desc_item      := coalesce((v_item ->> 'descuento_item')::numeric, 0);
    v_desc_item_tipo := coalesce((v_item ->> 'tipo_descuento_item')::public.tipo_descuento, 'valor');
    v_bruto          := v_producto.precio_venta * v_cantidad;

    if v_desc_item_tipo = 'porcentaje' then
      v_subtotal_item := greatest(v_bruto - ((v_bruto * v_desc_item) / 100), 0);
    else
      v_subtotal_item := greatest(v_bruto - v_desc_item, 0);
    end if;

    update public.productos
    set stock_actual = stock_actual - v_cantidad
    where id = v_producto.id;

    insert into public.items_factura (
      factura_id, producto_id, cantidad, precio_unitario,
      descuento_item, tipo_descuento_item, subtotal_item
    )
    values (
      v_factura_id, v_producto.id, v_cantidad, v_producto.precio_venta,
      v_desc_item, v_desc_item_tipo, v_subtotal_item
    );

    insert into public.movimientos_stock (
      producto_id, tipo, cantidad, motivo, factura_id, usuario_id, costo_unitario
    )
    values (
      v_producto.id, 'salida', v_cantidad, 'venta',
      v_factura_id, v_user_id, nullif(v_producto.precio_costo, 0)
    );
  end loop;

  return jsonb_build_object('id', v_factura_id, 'numero_factura', v_numero_factura);
end;
$$;

revoke all on function public.confirmar_factura(jsonb) from public, anon;
grant execute on function public.confirmar_factura(jsonb) to authenticated;


-- ============================================================
-- 6. RPC: marcar_factura_impresa
-- ============================================================
-- Antes devolvía sin avisar si la factura no existía o ya estaba
-- impresa; el Centro de Impresión lo interpretaba como éxito y la
-- factura se re-encolaba cada 10 s.
create or replace function public.marcar_factura_impresa(p_factura_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Solo admin puede marcar facturas impresas';
  end if;

  update public.facturas
  set estado = 'impresa'
  where id = p_factura_id
    and estado = 'pendiente_impresion';

  if not found then
    raise exception 'Factura no encontrada o ya impresa';
  end if;
end;
$$;

revoke all on function public.marcar_factura_impresa(uuid) from public, anon;
grant execute on function public.marcar_factura_impresa(uuid) to authenticated;


-- ============================================================
-- 7. RPC: anular_factura
-- ============================================================
-- Antes: SELECT DISTINCT ON (producto_id) ... se quedaba con UNA sola
-- línea del producto y devolvía sólo esa cantidad al stock.
-- Ahora: SUM(...) ... GROUP BY producto_id devuelve todo.
drop function if exists public.anular_factura(uuid);
drop function if exists public.anular_factura(uuid, text);

create or replace function public.anular_factura(
  p_factura_id uuid,
  p_razon      text
)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_item       record;
  v_factura    record;
  v_motivo     text;
  v_user_id    uuid := auth.uid();
  v_razon_trim text := trim(p_razon);
begin
  if not public.is_admin() then
    raise exception 'Solo un administrador puede anular facturas';
  end if;

  if v_razon_trim is null or length(v_razon_trim) < 10 then
    raise exception 'El motivo de anulación debe tener al menos 10 caracteres';
  end if;

  select id, numero_factura, estado
  into v_factura
  from public.facturas
  where id = p_factura_id
  for update;

  if not found then
    raise exception 'Factura no encontrada';
  end if;

  if v_factura.estado = 'anulada' then
    raise exception 'La factura ya se encuentra anulada';
  end if;

  v_motivo := 'Devolución por anulación de factura #' || v_factura.numero_factura::text;

  for v_item in
    select
      fi.producto_id,
      sum(fi.cantidad)::integer as cantidad,
      (array_agg(ms.costo_unitario order by ms.created_at desc))[1] as costo_unitario
    from public.items_factura fi
    left join public.movimientos_stock ms
      on  ms.factura_id  = fi.factura_id
      and ms.producto_id = fi.producto_id
      and ms.tipo        = 'salida'
    where fi.factura_id = p_factura_id
    group by fi.producto_id
    order by fi.producto_id
  loop
    update public.productos
    set stock_actual = stock_actual + v_item.cantidad
    where id = v_item.producto_id;

    insert into public.movimientos_stock (
      producto_id, tipo, cantidad, motivo, factura_id, usuario_id, costo_unitario
    ) values (
      v_item.producto_id, 'entrada', v_item.cantidad, v_motivo,
      p_factura_id, v_user_id, v_item.costo_unitario
    );
  end loop;

  update public.facturas
  set estado               = 'anulada',
      razon_anulacion      = v_razon_trim,
      fecha_anulacion      = now(),
      usuario_anulacion_id = v_user_id
  where id = p_factura_id;
end;
$$;

revoke all on function public.anular_factura(uuid, text) from public, anon;
grant  execute on function public.anular_factura(uuid, text) to authenticated;


-- ============================================================
-- 8. RLS: bandera puede_crear_productos
-- ============================================================
-- La migración 009 añadió la columna y la UI la mostraba, pero la
-- única política de escritura de productos exigía is_admin(): el
-- vendedor autorizado recibía "row-level security policy".
-- Se separa INSERT (admin o bandera) de UPDATE/DELETE (sólo admin).

drop policy if exists productos_mutation_admin  on public.productos;
drop policy if exists productos_insert_allowed  on public.productos;
drop policy if exists productos_update_admin    on public.productos;
drop policy if exists productos_delete_admin    on public.productos;

create policy productos_insert_allowed on public.productos
  for insert with check (public.can_create_products());

create policy productos_update_admin on public.productos
  for update using (public.is_admin()) with check (public.is_admin());

create policy productos_delete_admin on public.productos
  for delete using (public.is_admin());


-- ============================================================
-- 9. RLS: usuarios desactivados dejan de leer datos
-- ============================================================
-- requireProfile() sólo redirige, no cierra la sesión, así que un
-- usuario con activo = false conservaba un JWT válido y seguía leyendo
-- productos, clientes, negocio e historial.

drop policy if exists productos_select_authenticated on public.productos;
create policy productos_select_authenticated on public.productos
  for select using (
    public.is_active_user() and (activo = true or public.is_admin())
  );

drop policy if exists clientes_select_authenticated on public.clientes;
create policy clientes_select_authenticated on public.clientes
  for select using (public.is_active_user());

drop policy if exists movimientos_select_role on public.movimientos_stock;
create policy movimientos_select_role on public.movimientos_stock
  for select using (
    public.is_active_user()
    and (public.is_admin() or usuario_id = auth.uid())
  );

drop policy if exists negocio_select_authenticated on public.negocio;
create policy negocio_select_authenticated on public.negocio
  for select using (public.is_active_user());

drop policy if exists negocio_mensajes_select_authenticated on public.negocio_mensajes;
create policy negocio_mensajes_select_authenticated on public.negocio_mensajes
  for select using (public.is_active_user());


-- ============================================================
-- 10. RLS: el vendedor ya no lee facturas anuladas
-- ============================================================
-- La migración 011 declaraba este objetivo pero se revirtió
-- (commit 2745248) porque rompía la consulta. Aquí se aplica sobre
-- una base comprobada: la app redirige a los vendedores lejos de
-- /historial y /facturas/anuladas, y anular_factura() es
-- SECURITY DEFINER, así que no depende de esta política.
drop policy if exists facturas_select_role on public.facturas;
create policy facturas_select_role on public.facturas
  for select using (
    public.is_active_user()
    and (
      public.is_admin()
      or (vendedor_id = auth.uid() and estado <> 'anulada')
    )
  );


-- ============================================================
-- 11. RLS: ya no se puede INSERTAR clientes por PostgREST
-- ============================================================
-- confirmar_factura() es SECURITY DEFINER, así que sigue pudiendo
-- crear clientes. La aplicación no hace ningún otro INSERT sobre
-- esta tabla (verificado), de modo que la política sobraba: permitía
-- escribir datos personales desde cualquier sesión autenticada.

drop policy if exists clientes_insert_authenticated on public.clientes;


-- ============================================================
-- 12. PERMISOS DE EJECUCIÓN
-- ============================================================
revoke all on function public.confirmar_factura(jsonb)        from public, anon;
revoke all on function public.ajustar_stock_manual(uuid, integer, text, numeric) from public, anon;
revoke all on function public.marcar_factura_impresa(uuid)    from public, anon;
revoke all on function public.anular_factura(uuid, text)      from public, anon;

-- Función obsoleta: 0 llamadas desde la aplicación en todo el código.
drop function if exists public.current_user_role();


-- ============================================================
-- 13. NORMALIZACIÓN DE DATOS HISTÓRICOS (revisar antes de ejecutar)
-- ============================================================
-- La sección anterior es 100 % segura. ESTA NO TOCA EL ESQUEMA:
-- corrige el 'tipo' de los movimientos manuales ya registrados.
--
-- Por qué es correcto: desde la migración 20260430_003,
-- ajustar_stock_manual() sólo escribía 'ajuste' cuando p_cantidad < 0
-- (para positivos escribía 'entrada'). Luego todo movimiento 'ajuste'
-- existente es en realidad una SALIDA. Sin esta corrección, esos
-- registros siguen sumando en el kardex en lugar de restar.
--
-- Si prefieres no tocar los datos, comenta o borra este bloque:
-- el resto de la migración sigue funcionando igual.

update public.movimientos_stock
set tipo = 'salida'
where tipo = 'ajuste'
  and factura_id is null;

-- ============================================================
-- FIN DE LA MIGRACIÓN 012
-- ============================================================
