alter table public.productos
  add column if not exists precio_costo numeric(12,2) not null default 0 check (precio_costo >= 0);

alter table public.movimientos_stock
  add column if not exists costo_unitario numeric(12,2) check (costo_unitario >= 0);

drop function if exists public.ajustar_stock_manual(uuid, integer, text);

create or replace function public.ajustar_stock_manual(
  p_producto_id uuid,
  p_cantidad integer,
  p_motivo text default 'ajuste_manual',
  p_costo_unitario numeric default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_stock_actual integer;
begin
  if not public.is_admin() then
    raise exception 'Solo admin puede ajustar stock';
  end if;

  if p_cantidad = 0 then
    raise exception 'La cantidad de ajuste no puede ser 0';
  end if;

  if coalesce(trim(p_motivo), '') = '' then
    raise exception 'El motivo del ajuste es obligatorio';
  end if;

  select stock_actual
  into v_stock_actual
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
  set stock_actual = stock_actual + p_cantidad
  where id = p_producto_id;

  insert into public.movimientos_stock (
    producto_id,
    tipo,
    cantidad,
    motivo,
    usuario_id,
    costo_unitario
  )
  values (
    p_producto_id,
    case when p_cantidad > 0 then 'entrada'::public.movimiento_tipo else 'ajuste'::public.movimiento_tipo end,
    greatest(abs(p_cantidad), 1),
    trim(p_motivo),
    v_user_id,
    p_costo_unitario
  );
end;
$$;

grant execute on function public.ajustar_stock_manual(uuid, integer, text, numeric) to authenticated;

drop function if exists public.confirmar_factura(jsonb);

create or replace function public.confirmar_factura(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_cliente_id uuid;
  v_factura_id uuid;
  v_numero_factura bigint;
  v_subtotal numeric(12,2) := 0;
  v_descuento_total numeric(12,2) := 0;
  v_total numeric(12,2) := 0;
  v_desc_global_tipo public.tipo_descuento := coalesce((payload ->> 'descuento_global_tipo')::public.tipo_descuento, 'valor');
  v_desc_global_valor numeric(12,2) := coalesce((payload ->> 'descuento_global_valor')::numeric, 0);
  v_item jsonb;
  v_producto record;
  v_cantidad integer;
  v_desc_item numeric(12,2);
  v_desc_item_tipo public.tipo_descuento;
  v_bruto numeric(12,2);
  v_subtotal_item numeric(12,2);
  v_estado public.factura_estado;
begin
  if v_user_id is null then
    raise exception 'No autenticado';
  end if;

  if not exists (
    select 1 from public.usuarios u
    where u.id = v_user_id and u.activo = true and u.rol in ('admin', 'vendedor')
  ) then
    raise exception 'Usuario sin permisos para facturar';
  end if;

  if jsonb_array_length(payload -> 'items') = 0 then
    raise exception 'La factura debe tener al menos un ítem';
  end if;

  if (payload ->> 'cliente_id') is not null then
    v_cliente_id := (payload ->> 'cliente_id')::uuid;
  else
    insert into public.clientes (nombre, identificacion, nit, email, telefono, direccion)
    values (
      coalesce(payload -> 'cliente' ->> 'nombre', 'Consumidor final'),
      coalesce(payload -> 'cliente' ->> 'identificacion', '22222'),
      nullif(payload -> 'cliente' ->> 'nit', ''),
      nullif(payload -> 'cliente' ->> 'email', ''),
      nullif(payload -> 'cliente' ->> 'telefono', ''),
      nullif(payload -> 'cliente' ->> 'direccion', '')
    )
    returning id into v_cliente_id;
  end if;

  v_estado := case
    when (payload ->> 'guardar_sin_imprimir')::boolean = true
      then 'impresa'::public.factura_estado
    else 'pendiente_impresion'::public.factura_estado
  end;

  for v_item in select * from jsonb_array_elements(payload -> 'items') loop
    select p.id, p.nombre, p.precio_venta, p.stock_actual, p.precio_costo
    into v_producto
    from public.productos p
    where p.id = (v_item ->> 'producto_id')::uuid
      and p.activo = true
    for update;

    if not found then
      raise exception 'Producto no encontrado o inactivo';
    end if;

    v_cantidad := greatest((v_item ->> 'cantidad')::integer, 1);

    if v_producto.stock_actual < v_cantidad then
      raise exception 'Stock insuficiente para %', v_producto.nombre;
    end if;

    v_desc_item := coalesce((v_item ->> 'descuento_item')::numeric, 0);
    v_desc_item_tipo := coalesce((v_item ->> 'tipo_descuento_item')::public.tipo_descuento, 'valor');
    v_bruto := v_producto.precio_venta * v_cantidad;

    if v_desc_item_tipo = 'porcentaje' then
      v_subtotal_item := greatest(v_bruto - ((v_bruto * v_desc_item) / 100), 0);
    else
      v_subtotal_item := greatest(v_bruto - v_desc_item, 0);
    end if;

    v_subtotal := v_subtotal + v_subtotal_item;
  end loop;

  if v_desc_global_tipo = 'porcentaje' then
    v_descuento_total := greatest((v_subtotal * v_desc_global_valor) / 100, 0);
  else
    v_descuento_total := greatest(v_desc_global_valor, 0);
  end if;

  v_descuento_total := least(v_descuento_total, v_subtotal);
  v_total := v_subtotal - v_descuento_total;

  insert into public.facturas (
    cliente_id, vendedor_id, subtotal, descuento_total, total, estado
  )
  values (
    v_cliente_id, v_user_id, v_subtotal, v_descuento_total, v_total, v_estado
  )
  returning id, numero_factura into v_factura_id, v_numero_factura;

  for v_item in select * from jsonb_array_elements(payload -> 'items') loop
    select p.id, p.nombre, p.precio_venta, p.stock_actual, p.precio_costo
    into v_producto
    from public.productos p
    where p.id = (v_item ->> 'producto_id')::uuid
      and p.activo = true
    for update;

    v_cantidad := greatest((v_item ->> 'cantidad')::integer, 1);
    v_desc_item := coalesce((v_item ->> 'descuento_item')::numeric, 0);
    v_desc_item_tipo := coalesce((v_item ->> 'tipo_descuento_item')::public.tipo_descuento, 'valor');
    v_bruto := v_producto.precio_venta * v_cantidad;

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
      v_factura_id, v_user_id,
      nullif(v_producto.precio_costo, 0)
    );
  end loop;

  return jsonb_build_object('id', v_factura_id, 'numero_factura', v_numero_factura);
end;
$$;

grant execute on function public.confirmar_factura(jsonb) to authenticated;
