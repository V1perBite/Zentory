create extension if not exists pgcrypto;

do $$ begin create type public.user_role as enum ('admin', 'vendedor'); exception when duplicate_object then null; end $$;
do $$ begin create type public.movimiento_tipo as enum ('entrada', 'salida', 'ajuste'); exception when duplicate_object then null; end $$;
do $$ begin create type public.factura_estado as enum ('pendiente_impresion', 'impresa'); exception when duplicate_object then null; end $$;
do $$ begin create type public.tipo_descuento as enum ('porcentaje', 'valor'); exception when duplicate_object then null; end $$;

create sequence if not exists public.facturas_numero_seq as bigint start with 1 increment by 1;

create table if not exists public.usuarios (
  id uuid primary key references auth.users (id) on delete cascade,
  nombre text not null,
  rol public.user_role not null default 'vendedor',
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.productos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  sku_code text not null unique,
  precio_venta numeric(12,2) not null check (precio_venta >= 0),
  stock_actual integer not null default 0 check (stock_actual >= 0),
  minimo_stock integer not null default 0 check (minimo_stock >= 0),
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.clientes (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  identificacion text not null,
  telefono text,
  direccion text,
  created_at timestamptz not null default now()
);

create table if not exists public.facturas (
  id uuid primary key default gen_random_uuid(),
  numero_factura bigint not null unique default nextval('public.facturas_numero_seq'),
  cliente_id uuid not null references public.clientes(id),
  vendedor_id uuid not null references public.usuarios(id),
  subtotal numeric(12,2) not null check (subtotal >= 0),
  descuento_total numeric(12,2) not null default 0 check (descuento_total >= 0),
  total numeric(12,2) not null check (total >= 0),
  estado public.factura_estado not null default 'pendiente_impresion',
  created_at timestamptz not null default now(),
  constraint facturas_total_consistency check (total = subtotal - descuento_total)
);

create table if not exists public.items_factura (
  id uuid primary key default gen_random_uuid(),
  factura_id uuid not null references public.facturas(id) on delete cascade,
  producto_id uuid not null references public.productos(id),
  cantidad integer not null check (cantidad > 0),
  precio_unitario numeric(12,2) not null check (precio_unitario >= 0),
  descuento_item numeric(12,2) not null default 0 check (descuento_item >= 0),
  tipo_descuento_item public.tipo_descuento not null,
  subtotal_item numeric(12,2) not null check (subtotal_item >= 0)
);

create table if not exists public.movimientos_stock (
  id uuid primary key default gen_random_uuid(),
  producto_id uuid not null references public.productos(id),
  tipo public.movimiento_tipo not null,
  cantidad integer not null check (cantidad > 0),
  motivo text not null,
  factura_id uuid references public.facturas(id),
  usuario_id uuid not null references public.usuarios(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_productos_sku_code on public.productos(sku_code);
create index if not exists idx_facturas_numero on public.facturas(numero_factura);
create index if not exists idx_facturas_vendedor_created_at on public.facturas(vendedor_id, created_at desc);
create index if not exists idx_movimientos_producto_created_at on public.movimientos_stock(producto_id, created_at desc);
create index if not exists idx_items_factura_factura_id on public.items_factura(factura_id);

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.usuarios (id, nombre, rol, activo)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nombre', split_part(new.email, '@', 1)),
    coalesce((new.raw_user_meta_data ->> 'rol')::public.user_role, 'vendedor'),
    true
  )
  on conflict (id) do update
  set nombre = excluded.nombre;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_auth_user();

create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select rol from public.usuarios where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.usuarios u
    where u.id = auth.uid() and u.rol = 'admin' and u.activo = true
  );
$$;

alter table public.usuarios enable row level security;
alter table public.productos enable row level security;
alter table public.movimientos_stock enable row level security;
alter table public.clientes enable row level security;
alter table public.facturas enable row level security;
alter table public.items_factura enable row level security;

drop policy if exists usuarios_select_self_or_admin on public.usuarios;
create policy usuarios_select_self_or_admin on public.usuarios
for select using (auth.uid() = id or public.is_admin());

drop policy if exists usuarios_update_admin on public.usuarios;
create policy usuarios_update_admin on public.usuarios
for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists usuarios_insert_admin on public.usuarios;
create policy usuarios_insert_admin on public.usuarios
for insert with check (public.is_admin());

drop policy if exists productos_select_authenticated on public.productos;
create policy productos_select_authenticated on public.productos
for select using (auth.uid() is not null and (activo = true or public.is_admin()));

drop policy if exists productos_mutation_admin on public.productos;
create policy productos_mutation_admin on public.productos
for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists clientes_select_authenticated on public.clientes;
create policy clientes_select_authenticated on public.clientes
for select using (auth.uid() is not null);

drop policy if exists clientes_insert_authenticated on public.clientes;
create policy clientes_insert_authenticated on public.clientes
for insert with check (auth.uid() is not null);

drop policy if exists clientes_update_admin on public.clientes;
create policy clientes_update_admin on public.clientes
for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists facturas_select_role on public.facturas;
create policy facturas_select_role on public.facturas
for select using (public.is_admin() or vendedor_id = auth.uid());

drop policy if exists facturas_insert_rpc_block on public.facturas;
create policy facturas_insert_rpc_block on public.facturas
for insert with check (false);

drop policy if exists facturas_update_only_admin_print on public.facturas;
create policy facturas_update_only_admin_print on public.facturas
for update using (public.is_admin())
with check (
  public.is_admin()
  and estado in ('pendiente_impresion', 'impresa')
);

drop policy if exists items_factura_select_role on public.items_factura;
create policy items_factura_select_role on public.items_factura
for select using (
  exists (
    select 1
    from public.facturas f
    where f.id = items_factura.factura_id
      and (public.is_admin() or f.vendedor_id = auth.uid())
  )
);

drop policy if exists items_factura_insert_rpc_block on public.items_factura;
create policy items_factura_insert_rpc_block on public.items_factura
for insert with check (false);

drop policy if exists movimientos_select_role on public.movimientos_stock;
create policy movimientos_select_role on public.movimientos_stock
for select using (public.is_admin() or usuario_id = auth.uid());

drop policy if exists movimientos_insert_admin on public.movimientos_stock;
create policy movimientos_insert_admin on public.movimientos_stock
for insert with check (public.is_admin());

create or replace function public.ajustar_stock_manual(
  p_producto_id uuid,
  p_cantidad integer,
  p_motivo text default 'ajuste_manual'
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
    usuario_id
  )
  values (
    p_producto_id,
    'ajuste',
    greatest(abs(p_cantidad), 1),
    trim(p_motivo),
    v_user_id
  );
end;
$$;

grant execute on function public.ajustar_stock_manual(uuid, integer, text) to authenticated;

create or replace function public.confirmar_factura(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_cliente_id uuid;
  v_factura_id uuid;
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

  insert into public.clientes (nombre, identificacion, telefono, direccion)
  values (
    coalesce(payload -> 'cliente' ->> 'nombre', 'Consumidor final'),
    coalesce(payload -> 'cliente' ->> 'identificacion', '22222'),
    payload -> 'cliente' ->> 'telefono',
    payload -> 'cliente' ->> 'direccion'
  )
  returning id into v_cliente_id;

  for v_item in select * from jsonb_array_elements(payload -> 'items') loop
    select p.id, p.nombre, p.precio_venta, p.stock_actual
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
    cliente_id,
    vendedor_id,
    subtotal,
    descuento_total,
    total,
    estado
  )
  values (
    v_cliente_id,
    v_user_id,
    v_subtotal,
    v_descuento_total,
    v_total,
    'pendiente_impresion'
  )
  returning id into v_factura_id;

  for v_item in select * from jsonb_array_elements(payload -> 'items') loop
    select p.id, p.nombre, p.precio_venta, p.stock_actual
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
      factura_id,
      producto_id,
      cantidad,
      precio_unitario,
      descuento_item,
      tipo_descuento_item,
      subtotal_item
    )
    values (
      v_factura_id,
      v_producto.id,
      v_cantidad,
      v_producto.precio_venta,
      v_desc_item,
      v_desc_item_tipo,
      v_subtotal_item
    );

    insert into public.movimientos_stock (
      producto_id,
      tipo,
      cantidad,
      motivo,
      factura_id,
      usuario_id
    )
    values (
      v_producto.id,
      'salida',
      v_cantidad,
      'venta',
      v_factura_id,
      v_user_id
    );
  end loop;

  return v_factura_id;
end;
$$;

grant execute on function public.confirmar_factura(jsonb) to authenticated;

create or replace function public.marcar_factura_impresa(p_factura_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Solo admin puede marcar facturas impresas';
  end if;

  update public.facturas
  set estado = 'impresa'
  where id = p_factura_id
    and estado = 'pendiente_impresion';
end;
$$;

grant execute on function public.marcar_factura_impresa(uuid) to authenticated;
