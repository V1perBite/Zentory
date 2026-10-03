-- ============================================================
-- 20261002_017_confirmar_factura_superadmin.sql
--
-- confirmar_factura() comprobaba `u.rol in ('admin', 'vendedor')`:
-- con el nuevo rol 'superadmin' la cuenta protegida no podría facturar.
-- Se reemplaza el control por ('admin', 'superadmin', 'vendedor').
--
-- El cuerpo se copia literalmente de
-- migrations/20260925_012_reparacion_critica.sql (única línea cambiada)
-- para no perder ninguna de las correcciones de esa migración.
-- CREATE OR REPLACE conserva los grants existentes.
--
-- Idempotente: se puede ejecutar más de una vez.
-- ============================================================
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
      and u.rol in ('admin', 'superadmin', 'vendedor')
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
