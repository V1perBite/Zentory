-- ============================================================
-- ZENTORY — BASELINE (esquema completo y definitivo)
-- ============================================================
--
-- PARA QUÉ SIRVE
--   Crea TODA la base de datos de Zentory en una base de datos
--   NUEVA / recién creada, en una sola pasada y en su versión final.
--
-- CUÁLO USAR
--   · Base de datos nueva        -> ESTE ARCHIVO (una sola vez)
--   · Base de datos existente    -> supabase/migrations/20260925_012_reparacion_critica.sql
--   Instrucciones completas en supabase/README.md
--
-- INCLUYE LAS CORRECCIONES RESPECTO A LAS 11 MIGRACIONES HISTÓRICAS:
--   1. confirmar_factura v3  : valida items null, ordena los FOR UPDATE
--      (sin deadlocks), valida descuentos, deduplica productos y
--      REUTILIZA clientes existentes en vez de duplicarlos.
--   2. anular_factura v2     : SUM/GROUP BY en vez de DISTINCT ON
--      (antes perdía stock si había productos repetidos).
--   3. ajustar_stock_manual  : guarda 'entrada'/'salida' según el signo
--      (antes todo quedaba en 'ajuste' positivo, el kardex SUMABA las
--      salidas y el reporte de Mermas nunca devolvía filas).
--   4. razon_anulacion       : la migración 010 nunca se aplicó; aquí
--      la columna existe desde el principio.
--   5. RLS puede_crear_productos : antes el flag estaba en la UI pero
--      sin política, así que el vendedor recibía error de seguridad.
--   6. RLS activo            : los usuarios desactivados ya no leen datos.
--   7. RLS anuladas          : el vendedor ya no lee facturas anuladas.
--   8. clientes INSERT       : solo la RPC crea clientes (antes cualquier
--      autenticado podía escribir en la tabla).
--   9. Índices que faltaban  : facturas(created_at), facturas(estado),
--      items_factura(producto_id), facturas(cliente_id).
--  10. Se eliminan funciones sin uso: current_user_role().
--  11. Se elimina la columna legacy negocio.mensaje_agradecimiento
--      (el código nunca la leía; 007 ya la copió a negocio_mensajes).
--  12. Permisos: las RPC de negocio se revocan de PUBLIC y anon.
--  13. items_factura UNIQUE(factura_id, producto_id) + seed idempotente.
--
-- RE-EJECUTABLE: sí. Todas las operaciones son IF NOT EXISTS /
-- CREATE OR REPLACE / DROP POLICY IF EXISTS.
-- ============================================================


-- ============================================================
-- 0. EXTENSIONES Y TIPOS
-- ============================================================

create extension if not exists pgcrypto;

do $$ begin create type public.user_role        as enum ('admin', 'vendedor');            exception when duplicate_object then null; end $$;
do $$ begin create type public.movimiento_tipo  as enum ('entrada', 'salida', 'ajuste');  exception when duplicate_object then null; end $$;
do $$ begin create type public.factura_estado   as enum ('pendiente_impresion', 'impresa', 'anulada'); exception when duplicate_object then null; end $$;
do $$ begin create type public.tipo_descuento   as enum ('porcentaje', 'valor');          exception when duplicate_object then null; end $$;
do $$ begin create type public.negocio_mensaje_tipo as enum ('encabezado', 'cierre');     exception when duplicate_object then null; end $$;


-- ============================================================
-- 1. SECUENCIA DE NUMERACIÓN
-- ============================================================
-- Segura ante concurrencia (nextval es atómico). Puede dejar números
-- huérfanos si una factura revierta: es comportamiento esperado.

create sequence if not exists public.facturas_numero_seq
  as bigint start with 1 increment by 1;


-- ============================================================
-- 2. TABLAS
-- ============================================================

create table if not exists public.usuarios (
  id                    uuid primary key references auth.users (id) on delete cascade,
  nombre                text not null,
  email                 text,
  rol                   public.user_role not null default 'vendedor',
  activo                boolean not null default true,
  puede_crear_productos boolean not null default false,
  created_at            timestamptz not null default now()
);

create table if not exists public.productos (
  id             uuid primary key default gen_random_uuid(),
  nombre         text not null,
  sku_code       text not null unique,
  precio_venta   numeric(12,2) not null check (precio_venta >= 0),
  precio_costo   numeric(12,2) not null default 0 check (precio_costo >= 0),
  stock_actual   integer not null default 0 check (stock_actual >= 0),
  minimo_stock   integer not null default 0 check (minimo_stock >= 0),
  activo         boolean not null default true,
  created_at     timestamptz not null default now()
);

create table if not exists public.clientes (
  id             uuid primary key default gen_random_uuid(),
  nombre         text not null,
  identificacion text not null unique,   -- cédula/NIT: una sola fila por cliente
  nit            text,
  email          text,
  telefono       text,
  direccion      text,
  created_at     timestamptz not null default now()
);

create table if not exists public.facturas (
  id                   uuid primary key default gen_random_uuid(),
  numero_factura       bigint not null unique default nextval('public.facturas_numero_seq'),
  cliente_id           uuid not null references public.clientes(id),
  vendedor_id          uuid not null references public.usuarios(id),
  subtotal             numeric(12,2) not null check (subtotal >= 0),
  descuento_total      numeric(12,2) not null default 0 check (descuento_total >= 0),
  total                numeric(12,2) not null check (total >= 0),
  estado               public.factura_estado not null default 'pendiente_impresion',
  razon_anulacion      text,
  fecha_anulacion      timestamptz,
  usuario_anulacion_id uuid references public.usuarios(id),
  created_at           timestamptz not null default now(),
  constraint facturas_total_consistency check (total = subtotal - descuento_total)
);

create table if not exists public.items_factura (
  id                  uuid primary key default gen_random_uuid(),
  factura_id          uuid not null references public.facturas(id) on delete cascade,
  producto_id         uuid not null references public.productos(id),
  cantidad            integer not null check (cantidad > 0),
  precio_unitario     numeric(12,2) not null check (precio_unitario >= 0),
  descuento_item      numeric(12,2) not null default 0 check (descuento_item >= 0),
  tipo_descuento_item public.tipo_descuento not null,
  subtotal_item       numeric(12,2) not null check (subtotal_item >= 0),
  constraint items_factura_unica_por_producto unique (factura_id, producto_id)
);

create table if not exists public.movimientos_stock (
  id             uuid primary key default gen_random_uuid(),
  producto_id    uuid not null references public.productos(id),
  tipo           public.movimiento_tipo not null,
  cantidad       integer not null check (cantidad > 0),
  motivo         text not null,
  factura_id     uuid references public.facturas(id),
  usuario_id     uuid not null references public.usuarios(id),
  costo_unitario numeric(12,2) check (costo_unitario >= 0),
  created_at     timestamptz not null default now()
);

create table if not exists public.negocio (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null default 'Mi Negocio',
  direccion   text,
  telefono    text,
  nit         text,
  email       text,
  updated_at  timestamptz not null default now()
);

create table if not exists public.negocio_mensajes (
  id          uuid primary key default gen_random_uuid(),
  negocio_id  uuid not null references public.negocio(id) on delete cascade,
  tipo        public.negocio_mensaje_tipo not null,
  orden       integer not null default 0,
  texto       text not null,
  created_at  timestamptz not null default now()
);


-- ============================================================
-- 3. ÍNDICES
-- ============================================================
-- Se omiten los dos redundantes de la migración 001
-- (idx_productos_sku_code y idx_facturas_numero), porque ya existen
-- los índices UNIQUE que cubren exactamente las mismas columnas.

create index if not exists idx_facturas_vendedor_created_at
  on public.facturas (vendedor_id, created_at desc);
create index if not exists idx_movimientos_producto_created_at
  on public.movimientos_stock (producto_id, created_at desc);
create index if not exists idx_items_factura_factura_id
  on public.items_factura (factura_id);

-- Los que faltaban (dashboard y reportes filtran por fecha, estado y cliente)
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

create index if not exists idx_negocio_mensajes_negocio_tipo_orden
  on public.negocio_mensajes (negocio_id, tipo, orden, created_at);

create index if not exists idx_facturas_anuladas_fecha
  on public.facturas (fecha_anulacion desc)
  where estado = 'anulada';


-- ============================================================
-- 4. FUNCIONES AUXILIARES (usadas por las políticas RLS)
-- ============================================================

-- Devuelve true si el usuario autenticado es admin y está activo.
create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.usuarios u
    where u.id = auth.uid() and u.rol = 'admin' and u.activo = true
  );
$$;

-- Devuelve true si hay sesión y el usuario está activo.
-- Se usa en las políticas SELECT para que un usuario desactivado
-- deje de leer datos aunque su JWT siga siendo válido.
create or replace function public.is_active_user()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.usuarios u
    where u.id = auth.uid() and u.activo = true
  );
$$;

-- Admin, o vendedor con la bandera puede_crear_productos activa.
create or replace function public.can_create_products()
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.is_admin() or exists (
    select 1 from public.usuarios u
    where u.id = auth.uid() and u.activo = true and u.puede_crear_productos = true
  );
$$;

-- Trigger: crea el perfil en public.usuarios al registrarse en Auth.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.usuarios (id, nombre, rol, activo, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nombre', split_part(new.email, '@', 1)),
    coalesce((new.raw_user_meta_data ->> 'rol')::public.user_role, 'vendedor'),
    true,
    new.email
  )
  on conflict (id) do update
  set nombre = excluded.nombre,
      email  = excluded.email;

  return new;
end;
$$;

-- Trigger: impide modificar o borrar físicamente una factura ya anulada.
create or replace function public.bloquear_modificacion_anulada()
returns trigger
language plpgsql set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    if old.estado = 'anulada' then
      raise exception 'No se puede eliminar una factura anulada (id: %)', old.id;
    end if;
    return old;
  end if;

  if old.estado = 'anulada' then
    raise exception 'No se puede modificar una factura ya anulada (id: %)', old.id;
  end if;
  return new;
end;
$$;


-- ============================================================
-- 5. TRIGGERS
-- ============================================================

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_auth_user();

drop trigger if exists trg_bloquear_modificacion_anulada on public.facturas;
create trigger trg_bloquear_modificacion_anulada
  before update or delete on public.facturas
  for each row execute procedure public.bloquear_modificacion_anulada();


-- ============================================================
-- 6. RPC DE NEGOCIO
-- ============================================================
-- Todas son SECURITY DEFINER con search_path = public: bypasean RLS
-- (necesario porque facturas/items_factura tienen INSERT con
-- WITH CHECK (false)) y validan el rol INTERNAMENTE.

-- ------------------------------------------------------------
-- 6.1 ajustar_stock_manual
--   p_cantidad > 0  -> 'entrada'
--   p_cantidad < 0  -> 'salida'
--   Antes: los negativos se guardaban como 'ajuste' con cantidad
--   positiva, así que el kardex los SUMABA y Mermas no encontraba nada.
-- ------------------------------------------------------------
create or replace function public.ajustar_stock_manual(
  p_producto_id  uuid,
  p_cantidad     integer,
  p_motivo       text default 'ajuste_manual',
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


-- ------------------------------------------------------------
-- 6.2 confirmar_factura  (la transacción completa de venta)
--
--   · Recalcula precios y totales SIEMPRE desde productos.precio_venta
--     (el cliente nunca envía precios).
--   · Bloquea los productos con FOR UPDATE en orden de producto_id
--     (dos facturas simultáneas no pueden provocar deadlock).
--   · Deduplica productos repetidos del payload.
--   · Reutiliza el cliente existente por identificacion (antes creaba
--     un "Consumidor final" nuevo en cada venta).
--   · Devuelve {id, numero_factura}.
-- ------------------------------------------------------------
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

  -- Un mismo producto repetido sólo es aceptable si el descuento es igual
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

  -- Deduplica: suma las cantidades de un mismo producto
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
      (i ->> 'producto_id')::uuid                                        as producto_id,
      sum(greatest(coalesce((i ->> 'cantidad')::integer, 1), 1))         as cantidad,
      max(coalesce((i ->> 'descuento_item')::numeric, 0))                as descuento_item,
      max(coalesce((i ->> 'tipo_descuento_item')::text, 'valor'))        as tipo_descuento_item
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
      -- Cliente ya registrado: actualiza sólo los datos aportados.
      -- El nombre sólo se toca si no es el valor por defecto del formulario.
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
  -- v_items está ordenado por producto_id => los bloqueos se toman
  -- siempre en el mismo orden y no puede haber deadlock.
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

    v_cantidad      := greatest(coalesce((v_item ->> 'cantidad')::integer, 1), 1);
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


-- ------------------------------------------------------------
-- 6.3 marcar_factura_impresa
-- ------------------------------------------------------------
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


-- ------------------------------------------------------------
-- 6.4 anular_factura
--   · Valida rol y motivo >= 10 caracteres en el SERVIDOR.
--   · FOR UPDATE sobre la factura: serializa dobles anulaciones.
--   · SUM/GROUP BY por producto (no DISTINCT ON): si una factura
--     tuviera dos líneas del mismo producto devuelve TODO el stock.
--   · Orden por producto_id: mismo criterio de bloqueo que
--     confirmar_factura, así que no hay deadlock entre ambos.
--   · Conserva el costo_unitario HISTÓRICO de la venta original.
-- ------------------------------------------------------------
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
-- 7. ROW LEVEL SECURITY
-- ============================================================

alter table public.usuarios          enable row level security;
alter table public.productos         enable row level security;
alter table public.movimientos_stock enable row level security;
alter table public.clientes          enable row level security;
alter table public.facturas          enable row level security;
alter table public.items_factura     enable row level security;
alter table public.negocio           enable row level security;
alter table public.negocio_mensajes  enable row level security;

-- ── usuarios ────────────────────────────────────────────────
-- Se permite leer la propia fila aunque esté inactiva: la aplicación
-- necesita detectar el estado para mostrar "usuario inactivo".
drop policy if exists usuarios_select_self_or_admin on public.usuarios;
create policy usuarios_select_self_or_admin on public.usuarios
  for select using (auth.uid() = id or public.is_admin());

drop policy if exists usuarios_update_admin on public.usuarios;
create policy usuarios_update_admin on public.usuarios
  for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists usuarios_insert_admin on public.usuarios;
create policy usuarios_insert_admin on public.usuarios
  for insert with check (public.is_admin());

-- ── productos ───────────────────────────────────────────────
drop policy if exists productos_select_authenticated on public.productos;
create policy productos_select_authenticated on public.productos
  for select using (
    public.is_active_user() and (activo = true or public.is_admin())
  );

-- INSERT: admin o vendedor con la bandera puede_crear_productos.
-- UPDATE/DELETE: sólo admin.
drop policy if exists productos_mutation_admin on public.productos;
drop policy if exists productos_insert_allowed on public.productos;
drop policy if exists productos_update_admin on public.productos;
drop policy if exists productos_delete_admin on public.productos;

create policy productos_insert_allowed on public.productos
  for insert with check (public.can_create_products());

create policy productos_update_admin on public.productos
  for update using (public.is_admin()) with check (public.is_admin());

create policy productos_delete_admin on public.productos
  for delete using (public.is_admin());

-- ── clientes ────────────────────────────────────────────────
-- No existe política de INSERT: sólo la RPC confirmar_factura
-- (SECURITY DEFINER) puede crear clientes.
drop policy if exists clientes_select_authenticated on public.clientes;
drop policy if exists clientes_insert_authenticated on public.clientes;
drop policy if exists clientes_update_admin on public.clientes;

create policy clientes_select_authenticated on public.clientes
  for select using (public.is_active_user());

create policy clientes_update_admin on public.clientes
  for update using (public.is_admin()) with check (public.is_admin());

-- ── facturas ────────────────────────────────────────────────
drop policy if exists facturas_select_role on public.facturas;
create policy facturas_select_role on public.facturas
  for select using (
    public.is_active_user()
    and (
      public.is_admin()
      or (vendedor_id = auth.uid() and estado <> 'anulada')
    )
  );

drop policy if exists facturas_insert_rpc_block on public.facturas;
create policy facturas_insert_rpc_block on public.facturas
  for insert with check (false);

drop policy if exists facturas_update_only_admin_print on public.facturas;
create policy facturas_update_only_admin_print on public.facturas
  for update using (public.is_admin())
  with check (
    public.is_admin()
    and estado in ('pendiente_impresion', 'impresa', 'anulada')
  );

-- ── items_factura ───────────────────────────────────────────
drop policy if exists items_factura_select_role on public.items_factura;
create policy items_factura_select_role on public.items_factura
  for select using (
    exists (
      select 1 from public.facturas f
      where f.id = items_factura.factura_id
        and (public.is_admin() or f.vendedor_id = auth.uid())
    )
  );

drop policy if exists items_factura_insert_rpc_block on public.items_factura;
create policy items_factura_insert_rpc_block on public.items_factura
  for insert with check (false);

-- ── movimientos_stock ───────────────────────────────────────
drop policy if exists movimientos_select_role on public.movimientos_stock;
create policy movimientos_select_role on public.movimientos_stock
  for select using (
    public.is_active_user()
    and (public.is_admin() or usuario_id = auth.uid())
  );

drop policy if exists movimientos_insert_admin on public.movimientos_stock;
create policy movimientos_insert_admin on public.movimientos_stock
  for insert with check (public.is_admin());

-- ── negocio ─────────────────────────────────────────────────
drop policy if exists negocio_select_authenticated on public.negocio;
create policy negocio_select_authenticated on public.negocio
  for select using (public.is_active_user());

drop policy if exists negocio_update_admin on public.negocio;
create policy negocio_update_admin on public.negocio
  for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists negocio_insert_admin on public.negocio;
create policy negocio_insert_admin on public.negocio
  for insert with check (public.is_admin());

-- ── negocio_mensajes ────────────────────────────────────────
drop policy if exists negocio_mensajes_select_authenticated on public.negocio_mensajes;
create policy negocio_mensajes_select_authenticated on public.negocio_mensajes
  for select using (public.is_active_user());

drop policy if exists negocio_mensajes_insert_admin on public.negocio_mensajes;
create policy negocio_mensajes_insert_admin on public.negocio_mensajes
  for insert with check (public.is_admin());

drop policy if exists negocio_mensajes_update_admin on public.negocio_mensajes;
create policy negocio_mensajes_update_admin on public.negocio_mensajes
  for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists negocio_mensajes_delete_admin on public.negocio_mensajes;
create policy negocio_mensajes_delete_admin on public.negocio_mensajes
  for delete using (public.is_admin());


-- ============================================================
-- 8. PERMISOS
-- ============================================================
-- Las funciones auxiliares necesitan ser ejecutables por cualquier
-- rol: las evalúan las políticas RLS, también para usuarios anónimos
-- (devuelven false, no hay fuga de datos).
grant execute on function public.is_admin()             to public;
grant execute on function public.is_active_user()       to public;
grant execute on function public.can_create_products()  to public;

-- Las RPC de negocio sólo para usuarios autenticados.
-- (los REVOKE/GRANT ya se aplicaron junto a cada función)

-- Función obsoleta: nunca se invocaba desde la aplicación.
drop function if exists public.current_user_role();


-- ============================================================
-- 9. REALTIME
-- ============================================================
-- El Centro de Escritura/Impresión escucha INSERTs de facturas.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'facturas'
  ) then
    alter publication supabase_realtime add table public.facturas;
  end if;
exception
  when undefined_object then null;   -- la publicación no existe en este entorno
end $$;


-- ============================================================
-- 10. SEED
-- ============================================================
-- Idempotente y con id fijo: garantiza una sola fila de negocio,
-- de modo que los .single() de la aplicación no fallen nunca.

insert into public.negocio (id, nombre)
values ('00000000-0000-0000-0000-000000000001'::uuid, 'Mi Negocio')
on conflict (id) do nothing;

insert into public.negocio_mensajes (negocio_id, tipo, orden, texto)
select n.id, 'encabezado'::public.negocio_mensaje_tipo, 1, '¡Gracias por su compra!'
from public.negocio n
where not exists (
  select 1 from public.negocio_mensajes nm
  where nm.negocio_id = n.id and nm.tipo = 'encabezado'
);

insert into public.negocio_mensajes (negocio_id, tipo, orden, texto)
select n.id, 'cierre'::public.negocio_mensaje_tipo, 1, 'Gracias por su compra'
from public.negocio n
where not exists (
  select 1 from public.negocio_mensajes nm
  where nm.negocio_id = n.id and nm.tipo = 'cierre'
);

-- ============================================================
-- FIN DEL BASELINE
-- ============================================================
