-- ============================================================
-- 20261001_014_auditoria.sql
--
-- Sistema centralizado de auditoría (QUIÉN / QUÉ / CUÁNDO / SOBRE QUÉ /
-- VALOR ANTERIOR → VALOR NUEVO / MOTIVO).
--
-- Diseño:
--   * Una sola tabla inmutable: public.auditoria_eventos.
--   * Un solo punto de escritura para eventos de tablas:
--       public.auditoria_trigger()  →  public.auditoria_insertar()
--     (triggers AFTER en productos, clientes, facturas, movimientos_stock,
--      usuarios y negocio: registran OLD/NEW exactos, sin round-trips extra
--      desde el cliente y también en escrituras directas con anon key).
--   * Un RPC para los eventos que NO tienen fila en una tabla
--     (LOGIN, LOGIN_FALLIDO, LOGOUT, USUARIO_CREADO, EXPORTACION):
--       public.auditoria_registrar(...)  →  public.auditoria_insertar()
--   * La app usa auditService (src/lib/audit.ts) que llama a esos RPC.
--
-- Seguridad:
--   * RLS: SELECT solo con puede_ver_auditoria(); sin policy de
--     UPDATE/DELETE/INSERT para los roles de la app.
--   * Trigger BEFORE UPDATE OR DELETE que lanza excepción (inmutable,
--     mismo patrón que trg_bloquear_modificacion_anulada de la 011).
--   * auditoria_sanear() elimina claves sensibles de los jsonb.
--
-- Idempotente: se puede ejecutar más de una vez.
-- ============================================================

-- ── 1. Permisos en usuarios + IP de la sesión ───────────────
alter table public.usuarios
  add column if not exists puede_ver_auditoria     boolean not null default false,
  add column if not exists puede_exportar_auditoria boolean not null default false,
  add column if not exists ultima_ip               text;

-- ── 2. Tabla de auditoría ───────────────────────────────────
create table if not exists public.auditoria_eventos (
  id               uuid primary key default gen_random_uuid(),
  usuario_id       uuid references public.usuarios (id) on delete set null,
  usuario_nombre   text,
  usuario_email    text,
  accion           text not null,
  modulo           text not null,
  entidad          text not null,
  entidad_id       uuid,
  entidad_ref      text,
  descripcion      text,
  ip               text,
  valores_previos  jsonb,
  valores_nuevos   jsonb,
  motivo           text,
  correccion_de    uuid references public.auditoria_eventos (id),
  metadata         jsonb,
  created_at       timestamptz not null default clock_timestamp()
);

-- Una misma transacción (p. ej. confirmar_factura) genera varios eventos:
-- con now() todos compartirían instante y el orden del listado sería
-- aleatorio, así que cada evento lleva su propio reloj.
alter table public.auditoria_eventos
  alter column created_at set default clock_timestamp();

comment on table public.auditoria_eventos is
  'Historial inmutable de eventos de auditoría. Nunca se actualiza ni se borra.';
comment on column public.auditoria_eventos.correccion_de is
  'Si un administrador corrige un evento, se crea un NUEVO registro que apunta al original.';

create index if not exists idx_auditoria_created_at    on public.auditoria_eventos (created_at desc);
create index if not exists idx_auditoria_usuario       on public.auditoria_eventos (usuario_id, created_at desc);
create index if not exists idx_auditoria_accion        on public.auditoria_eventos (accion, created_at desc);
create index if not exists idx_auditoria_modulo        on public.auditoria_eventos (modulo, created_at desc);
create index if not exists idx_auditoria_entidad       on public.auditoria_eventos (entidad, entidad_id, created_at desc);
create index if not exists idx_auditoria_entidad_ref   on public.auditoria_eventos (entidad_ref);
create index if not exists idx_auditoria_correccion    on public.auditoria_eventos (correccion_de);

-- ── 3. Helpers de permiso (mismo patrón que is_admin()) ────
create or replace function public.puede_ver_auditoria()
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.is_admin() or exists (
    select 1 from public.usuarios u
    where u.id = auth.uid() and u.activo = true and u.puede_ver_auditoria = true
  );
$$;

create or replace function public.puede_exportar_auditoria()
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.is_admin() or exists (
    select 1 from public.usuarios u
    where u.id = auth.uid() and u.activo = true and u.puede_exportar_auditoria = true
  );
$$;

grant execute on function public.puede_ver_auditoria()     to public;
grant execute on function public.puede_exportar_auditoria() to public;

-- ── 4. RLS: solo lectura autorizada ────────────────────────
alter table public.auditoria_eventos enable row level security;

drop policy if exists auditoria_select_autorizada on public.auditoria_eventos;
create policy auditoria_select_autorizada on public.auditoria_eventos
  for select to authenticated
  using (public.puede_ver_auditoria());

-- La app no inserta, actualiza ni borra: solo las funciones SECURITY DEFINER
-- (propietarias de la tabla) escriben. El UPDATE/DELETE queda bloqueado.
revoke insert, update, delete on public.auditoria_eventos from anon, authenticated;

-- ── 5. Inmutabilidad total (ni service_role) ───────────────
create or replace function public.bloquear_modificacion_auditoria()
returns trigger
language plpgsql set search_path = public
as $$
begin
  raise exception
    'La auditoría es inmutable: no se puede % el evento %', lower(tg_op), old.id;
end;
$$;

drop trigger if exists trg_auditoria_inmutable on public.auditoria_eventos;
create trigger trg_auditoria_inmutable
  before update or delete on public.auditoria_eventos
  for each row execute procedure public.bloquear_modificacion_auditoria();

-- ── 6. Sanitización: nunca guardar contraseñas/tokens/tarjetas ──
create or replace function public.auditoria_sanear(p jsonb)
returns jsonb
language plpgsql immutable
as $$
declare
  v jsonb := p;
  k text;
begin
  if v is null or jsonb_typeof(v) <> 'object' then
    return v;
  end if;

  for k in select jsonb_object_keys(v) loop
    if k ~* '(password|contrase|token|secret|api_?key|card|tarjeta|cvv|pan$)' then
      v := v - k;
    end if;
  end loop;

  return v;
end;
$$;

-- ── 7. Punto único de escritura ────────────────────────────
create or replace function public.auditoria_insertar(
  p_usuario_id      uuid,
  p_usuario_nombre  text,
  p_usuario_email   text,
  p_accion          text,
  p_modulo          text,
  p_entidad         text,
  p_entidad_id      uuid,
  p_entidad_ref     text,
  p_descripcion     text,
  p_ip              text,
  p_valores_previos jsonb,
  p_valores_nuevos  jsonb,
  p_motivo          text,
  p_metadata        jsonb
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_id   uuid;
  v_ip   text;
  v_prev jsonb := public.auditoria_sanear(p_valores_previos);
  v_nue  jsonb := public.auditoria_sanear(p_valores_nuevos);
begin
  v_ip := coalesce(
    nullif(trim(p_ip), ''),
    (select u.ultima_ip from public.usuarios u where u.id = p_usuario_id)
  );

  insert into public.auditoria_eventos (
    usuario_id, usuario_nombre, usuario_email,
    accion, modulo, entidad, entidad_id, entidad_ref,
    descripcion, ip, valores_previos, valores_nuevos, motivo, metadata
  ) values (
    p_usuario_id, p_usuario_nombre, p_usuario_email,
    p_accion, p_modulo, p_entidad, p_entidad_id, p_entidad_ref,
    nullif(trim(p_descripcion), ''), v_ip, v_prev, v_nue,
    nullif(trim(p_motivo), ''), public.auditoria_sanear(p_metadata)
  )
  returning id into v_id;

  return v_id;
end;
$$;

-- Solo el dueño (postgres) puede ejecutarla: los roles de la app
-- llegan vía auditoria_registrar() o vía triggers.
revoke all on function public.auditoria_insertar(uuid, text, text, text, text,
  text, uuid, text, text, text, jsonb, jsonb, text, jsonb) from public;
revoke all on function public.auditoria_insertar(uuid, text, text, text, text,
  text, uuid, text, text, text, jsonb, jsonb, text, jsonb) from anon;
revoke all on function public.auditoria_insertar(uuid, text, text, text, text,
  text, uuid, text, text, text, jsonb, jsonb, text, jsonb) from authenticated;

-- ── 8. RPC de la aplicación (eventos sin fila en una tabla) ─
-- Lista blanca: los eventos de tablos los escriben los triggers.
create or replace function public.auditoria_registrar(
  p_accion          text,
  p_modulo          text,
  p_entidad         text,
  p_entidad_id      uuid  default null,
  p_entidad_ref     text  default null,
  p_descripcion     text  default null,
  p_valores_previos jsonb default null,
  p_valores_nuevos  jsonb default null,
  p_motivo          text  default null,
  p_ip              text  default null,
  p_metadata        jsonb default null
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_actor  uuid  := auth.uid();
  v_nombre text;
  v_email  text;
begin
  if p_accion is null or p_modulo is null or p_entidad is null then
    raise exception 'Auditoría: acción, módulo y entidad son obligatorios';
  end if;

  -- Sin sesión sólo se admiten eventos de autenticación (login fallido).
  if v_actor is null and upper(p_accion) <> 'LOGIN_FALLIDO' then
    raise exception 'Auditoría: no hay usuario autenticado';
  end if;

  if upper(p_accion) not in (
    'LOGIN', 'LOGOUT', 'LOGIN_FALLIDO', 'USUARIO_CREADO', 'EXPORTACION_AUDITORIA'
  ) then
    raise exception 'Auditoría: acción % registrada por trigger, no por RPC', p_accion;
  end if;

  if v_actor is not null then
    select u.nombre, u.email into v_nombre, v_email
    from public.usuarios u where u.id = v_actor;
  end if;

  return public.auditoria_insertar(
    v_actor, coalesce(v_nombre, p_entidad_ref), v_email,
    upper(p_accion), upper(p_modulo), upper(p_entidad),
    p_entidad_id, p_entidad_ref, p_descripcion, p_ip,
    p_valores_previos, p_valores_nuevos, p_motivo, p_metadata
  );
end;
$$;

revoke all on function public.auditoria_registrar(text, text, text, uuid, text,
  text, jsonb, jsonb, text, text, jsonb) from public;
revoke all on function public.auditoria_registrar(text, text, text, uuid, text,
  text, jsonb, jsonb, text, text, jsonb) from anon;
grant execute on function public.auditoria_registrar(text, text, text, uuid, text,
  text, jsonb, jsonb, text, text, jsonb) to authenticated;
-- LOGIN_FALLIDO se registra desde el formulario de login: en ese momento no
-- hay sesión, así que el cuerpo de la función limita el rol anon a esa única
-- acción (cualquier otra la rechaza con una excepción).
grant execute on function public.auditoria_registrar(text, text, text, uuid, text,
  text, jsonb, jsonb, text, text, jsonb) to anon;

-- ── 9. IP de la sesión actual (para los triggers) ──────────
create or replace function public.auditoria_registrar_ip(p_ip text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_uuid uuid := auth.uid();
  v_ip   text := nullif(trim(p_ip), '');
begin
  if v_uuid is null then
    return;
  end if;

  update public.usuarios
     set ultima_ip = v_ip
   where id = v_uuid
     and ultima_ip is distinct from v_ip;
end;
$$;

revoke all on function public.auditoria_registrar_ip(text) from public;
revoke all on function public.auditoria_registrar_ip(text) from anon;
grant execute on function public.auditoria_registrar_ip(text) to authenticated;

-- ── 10. Utilidades de descripción legible ──────────────────
create or replace function public.auditoria_etiqueta(p_campo text)
returns text
language sql immutable
as $$
  select case p_campo
    when 'nombre'            then 'Nombre'
    when 'email'             then 'Email'
    when 'rol'               then 'Rol'
    when 'activo'            then 'Activo'
    when 'sku_code'          then 'Código'
    when 'precio_venta'      then 'Precio de venta'
    when 'precio_costo'      then 'Precio de costo'
    when 'stock_actual'      then 'Stock actual'
    when 'minimo_stock'      then 'Stock mínimo'
    when 'identificacion'    then 'Identificación'
    when 'nit'               then 'NIT'
    when 'telefono'          then 'Teléfono'
    when 'direccion'         then 'Dirección'
    when 'estado'            then 'Estado'
    when 'subtotal'          then 'Subtotal'
    when 'descuento_total'   then 'Descuento total'
    when 'total'             then 'Total'
    when 'razon_anulacion'   then 'Motivo de anulación'
    when 'fecha_anulacion'   then 'Fecha de anulación'
    when 'puede_crear_productos'      then 'Permiso: crear productos'
    when 'puede_ver_auditoria'        then 'Permiso: ver auditoría'
    when 'puede_exportar_auditoria'   then 'Permiso: exportar auditoría'
    else p_campo
  end;
$$;

create or replace function public.auditoria_texto(p_valor jsonb)
returns text
language plpgsql immutable
as $$
begin
  if p_valor is null then
    return '—';
  end if;
  if jsonb_typeof(p_valor) = 'string' then
    return case when nullif(p_valor #>> '{}', '') is null
                then '—'
                else p_valor #>> '{}' end;
  end if;
  if jsonb_typeof(p_valor) = 'null' then
    return '—';
  end if;
  if jsonb_typeof(p_valor) = 'boolean' then
    return case when (p_valor #>> '{}') = 'true' then 'Sí' else 'No' end;
  end if;
  return p_valor #>> '{}';
end;
$$;

-- ── 11. Trigger central: captura OLD/NEW de todas las tablas ──
create or replace function public.auditoria_trigger()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_actor    uuid  := auth.uid();
  v_nombre   text;
  v_email    text;
  v_modulo   text;
  v_entidad  text;
  v_accion   text;
  v_ref      text;
  v_motivo   text;
  v_desc     text;
  v_prev     jsonb;
  v_nue      jsonb;
  v_meta     jsonb;
  v_old      jsonb;
  v_new      jsonb;
  v_ignore   text[] := array[]::text[];
  v_stock    integer;
  v_delta    integer;
  v_campo    text;
  v_prod_nom text;
begin
  -- ── módulo, entidad y columnas que no interesan ──
  case tg_table_name
    when 'productos' then
      v_modulo := 'PRODUCTOS'; v_entidad := 'PRODUCTO';
      v_ignore := array['id', 'created_at', 'stock_actual'];
      v_ref := case when tg_op = 'DELETE'
                    then to_jsonb(old) ->> 'sku_code'
                    else to_jsonb(new) ->> 'sku_code' end;

    when 'clientes' then
      v_modulo := 'FACTURACION'; v_entidad := 'CLIENTE';
      v_ignore := array['id', 'created_at'];
      v_ref := case when tg_op = 'DELETE'
                    then to_jsonb(old) ->> 'identificacion'
                    else to_jsonb(new) ->> 'identificacion' end;

    when 'facturas' then
      v_modulo := 'FACTURACION'; v_entidad := 'FACTURA';
      v_ignore := array['id', 'created_at'];
      v_ref := 'N° ' || case when tg_op = 'DELETE'
                             then to_jsonb(old) ->> 'numero_factura'
                             else to_jsonb(new) ->> 'numero_factura' end;

    when 'movimientos_stock' then
      v_modulo := 'INVENTARIO'; v_entidad := 'MOVIMIENTO';
      v_ignore := array['id', 'created_at'];

    when 'usuarios' then
      v_modulo := 'USUARIOS'; v_entidad := 'USUARIO';
      v_ignore := array['id', 'created_at', 'ultima_ip'];
      v_ref := case when tg_op = 'DELETE'
                    then to_jsonb(old) ->> 'email'
                    else to_jsonb(new) ->> 'email' end;

    when 'negocio' then
      v_modulo := 'CONFIGURACION'; v_entidad := 'NEGOCIO';
      v_ignore := array['id', 'updated_at'];
      v_ref := case when tg_op = 'DELETE'
                    then to_jsonb(old) ->> 'nombre'
                    else to_jsonb(new) ->> 'nombre' end;

    else
      return case when tg_op = 'DELETE' then old else new end;
  end case;

  -- Perfil del usuario que ejecuta la operación.
  if v_actor is not null then
    select u.nombre, u.email into v_nombre, v_email
    from public.usuarios u where u.id = v_actor;
  end if;

  -- Filas creadas por service_role (trigger handle_new_auth_user) no tienen
  -- actor: esos eventos los registra la app con el usuario real que los creó.
  if v_actor is null and tg_table_name = 'usuarios' then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if tg_op = 'DELETE' then
    v_old := to_jsonb(old);
  elsif tg_op = 'INSERT' then
    v_new := to_jsonb(new);
  else
    v_old := to_jsonb(old);
    v_new := to_jsonb(new);
  end if;

  -- ── por tabla: acción, motivo y valores ──
  case tg_table_name

    when 'productos' then
      if tg_op = 'INSERT' then
        v_accion := 'PRODUCTO_CREADO';
        v_prev := null;
        v_nue  := v_new - v_ignore;
        v_desc := 'Producto creado: ' || coalesce(v_new ->> 'nombre', v_ref);
      elsif tg_op = 'DELETE' then
        v_accion := 'PRODUCTO_ELIMINADO';
        v_prev := v_old - v_ignore;
        v_nue  := null;
        v_desc := 'Producto eliminado: ' || coalesce(v_old ->> 'nombre', v_ref);
      else
        if (v_old ->> 'precio_venta') is distinct from (v_new ->> 'precio_venta') then
          v_accion := 'PRODUCTO_PRECIO_MODIFICADO';
        elsif (v_old ->> 'sku_code') is distinct from (v_new ->> 'sku_code') then
          v_accion := 'PRODUCTO_CODIGO_MODIFICADO';
        elsif (v_old ->> 'precio_costo') is distinct from (v_new ->> 'precio_costo') then
          v_accion := 'PRODUCTO_COSTO_MODIFICADO';
        elsif (v_old ->> 'activo') is distinct from (v_new ->> 'activo') then
          v_accion := 'PRODUCTO_ESTADO_MODIFICADO';
        else
          v_accion := 'PRODUCTO_MODIFICADO';
        end if;
      end if;

    when 'clientes' then
      if tg_op = 'INSERT' then
        v_accion := 'CLIENTE_CREADO';
        v_prev := null;
        v_nue  := v_new - v_ignore;
        v_desc := 'Cliente creado: ' || coalesce(v_new ->> 'nombre', v_ref);
      elsif tg_op = 'DELETE' then
        v_accion := 'CLIENTE_ELIMINADO';
        v_prev := v_old - v_ignore;
        v_nue  := null;
        v_desc := 'Cliente eliminado: ' || coalesce(v_old ->> 'nombre', v_ref);
      else
        v_accion := 'CLIENTE_MODIFICADO';
      end if;

    when 'facturas' then
      if tg_op = 'INSERT' then
        v_accion := 'FACTURA_CREADA';
        v_prev := null;
        v_nue  := v_new - v_ignore;
        v_desc := 'Factura ' || (v_new ->> 'numero_factura')
               || ' creada · Total ' || coalesce((v_new ->> 'total'), '0')
               || ' (' || (v_new ->> 'estado') || ')';
        v_meta := jsonb_build_object(
          'numero_factura', (v_new ->> 'numero_factura')::bigint,
          'total',          (v_new ->> 'total')::numeric,
          'estado',         v_new ->> 'estado',
          'cliente_id',     v_new ->> 'cliente_id',
          'vendedor_id',    v_new ->> 'vendedor_id'
        );
      elsif tg_op = 'DELETE' then
        v_accion := 'FACTURA_ELIMINADA';
        v_prev := v_old - v_ignore;
        v_nue  := null;
        v_desc := 'Factura ' || (v_old ->> 'numero_factura') || ' eliminada';
      else
        if (v_old ->> 'estado') is distinct from (v_new ->> 'estado') then
          if (v_new ->> 'estado') = 'anulada' then
            v_accion := 'ANULACION_FACTURA';
            v_motivo := v_new ->> 'razon_anulacion';
          elsif (v_new ->> 'estado') = 'impresa' then
            v_accion := 'FACTURA_IMPRESA';
          else
            v_accion := 'FACTURA_MODIFICADA';
          end if;
        elsif (v_old ->> 'descuento_total') is distinct from (v_new ->> 'descuento_total') then
          v_accion := 'DESCUENTO_APLICADO';
        else
          v_accion := 'FACTURA_MODIFICADA';
        end if;
      end if;

    when 'movimientos_stock' then
      -- Sólo INSERT: el kardex no se modifica.
      v_accion := case
        when lower(new.motivo) like 'devoluci%'            then 'DEVOLUCION'
        when lower(new.motivo) ~* '(inventario f|conteo)'  then 'INVENTARIO_FISICO'
        when new.tipo = 'entrada'                          then 'ENTRADA_MERCANCIA'
        when new.tipo = 'ajuste'                           then 'AJUSTE_INVENTARIO'
        when lower(new.motivo) ~* '(da.|vencid|rotu|averiad|inservible)' then 'PRODUCTO_DANADO'
        when lower(new.motivo) ~* 'perdid'                 then 'PERDIDA'
        when lower(new.motivo) ~* 'merma'                  then 'MERMA'
        else 'SALIDA_MERCANCIA'
      end;
      v_motivo := new.motivo;

      select p.stock_actual, p.sku_code, p.nombre
        into v_stock, v_ref, v_prod_nom
      from public.productos p
      where p.id = new.producto_id;

      -- Las tres RPC (confirmar_factura, ajustar_stock_manual,
      -- anular_factura) actualizan el stock ANTES de insertar el
      -- movimiento, así que el valor anterior es exacto.
      if new.tipo in ('entrada', 'salida') and v_stock is not null then
        v_delta := case when new.tipo = 'entrada' then new.cantidad else -new.cantidad end;
        v_prev := jsonb_build_object('stock_actual', v_stock - v_delta);
        v_nue  := jsonb_build_object('stock_actual', v_stock);
      end if;

      v_desc := initcap(new.tipo::text) || ' de ' || new.cantidad || ' × '
             || coalesce(v_prod_nom, 'producto')
             || case when v_ref is null then '' else ' (' || v_ref || ')' end
             || case when v_stock is null or v_delta is null then ''
                     else ' · Stock: ' || (v_stock - v_delta) || ' → ' || v_stock end;

      v_meta := jsonb_build_object(
        'producto_id',       new.producto_id,
        'producto_nombre',   v_prod_nom,
        'sku_code',          v_ref,
        'cantidad',          new.cantidad,
        'tipo',              new.tipo,
        'factura_id',        new.factura_id,
        'costo_unitario',    new.costo_unitario,
        'stock_resultante',  v_stock
      );

    when 'usuarios' then
      if tg_op = 'INSERT' then
        v_accion := 'USUARIO_CREADO';
        v_prev := null;
        v_nue  := v_new - v_ignore;
        v_desc := 'Usuario creado: ' || coalesce(v_new ->> 'nombre', v_ref);
      elsif tg_op = 'DELETE' then
        v_accion := 'USUARIO_ELIMINADO';
        v_prev := v_old - v_ignore;
        v_nue  := null;
        v_desc := 'Usuario eliminado: ' || coalesce(v_old ->> 'nombre', v_ref);
      elsif (v_old ->> 'rol') is distinct from (v_new ->> 'rol') then
        v_accion := 'ROL_CAMBIADO';
      elsif (v_old ->> 'activo') is distinct from (v_new ->> 'activo') then
        v_accion := case when (v_new ->> 'activo') = 'true'
                         then 'USUARIO_ACTIVADO' else 'USUARIO_DESACTIVADO' end;
      elsif (v_old ->> 'puede_crear_productos')      is distinct from (v_new ->> 'puede_crear_productos')
        or (v_old ->> 'puede_ver_auditoria')         is distinct from (v_new ->> 'puede_ver_auditoria')
        or (v_old ->> 'puede_exportar_auditoria')    is distinct from (v_new ->> 'puede_exportar_auditoria')
      then
        v_accion := 'PERMISO_CAMBIADO';
      else
        v_accion := 'USUARIO_MODIFICADO';
      end if;

    when 'negocio' then
      if tg_op = 'INSERT' then
        v_accion := 'CONFIGURACION_CREADA';
        v_prev := null;
        v_nue  := v_new - v_ignore;
        v_desc := 'Configuración del negocio creada';
      elsif tg_op = 'DELETE' then
        v_accion := 'CONFIGURACION_ELIMINADA';
        v_prev := v_old - v_ignore;
        v_nue  := null;
        v_desc := 'Configuración del negocio eliminada';
      else
        v_accion := 'CONFIGURACION_MODIFICADA';
      end if;

    else
      return case when tg_op = 'DELETE' then old else new end;
  end case;

  -- ── UPDATE: diff columna a columna (si no cambió nada, no registra) ──
  if tg_op = 'UPDATE' then
    v_prev := '{}'::jsonb;
    v_nue  := '{}'::jsonb;

    for v_campo in select jsonb_object_keys(v_old) loop
      if not (v_ignore @> array[v_campo])
         and (v_old -> v_campo) is distinct from (v_new -> v_campo) then
        v_prev := v_prev || jsonb_build_object(v_campo, v_old -> v_campo);
        v_nue  := v_nue  || jsonb_build_object(v_campo, v_new -> v_campo);
      end if;
    end loop;

    if v_prev = '{}'::jsonb then
      return new;
    end if;

    select string_agg(
             public.auditoria_etiqueta(t.k) || ': '
             || public.auditoria_texto(v_old -> t.k) || ' → '
             || public.auditoria_texto(v_new -> t.k),
             ' · ' order by t.k
           )
      into v_desc
    from jsonb_object_keys(v_prev) as t(k);
  end if;

  -- ── registro ──
  begin
    perform public.auditoria_insertar(
      v_actor, coalesce(v_nombre, 'sistema'), v_email,
      v_accion, v_modulo, v_entidad,
      (((case when tg_op = 'DELETE' then v_old else v_new end) ->> 'id')::uuid),
      v_ref, v_desc, null,
      v_prev, v_nue, v_motivo, v_meta
    );
  exception when others then
    raise warning 'auditoria: no se pudo registrar % sobre % (%)',
      v_accion, tg_table_name, sqlerrm;
  end;

  return case when tg_op = 'DELETE' then old else new end;

exception when others then
  -- La auditoría nunca debe romper la operación de negocio.
  raise warning 'auditoria: error en trigger de % (%)', tg_table_name, sqlerrm;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

-- ── 12. Triggers de captura ─────────────────────────────────
drop trigger if exists trg_auditoria_productos on public.productos;
create trigger trg_auditoria_productos
  after insert or update or delete on public.productos
  for each row execute procedure public.auditoria_trigger();

drop trigger if exists trg_auditoria_clientes on public.clientes;
create trigger trg_auditoria_clientes
  after insert or update or delete on public.clientes
  for each row execute procedure public.auditoria_trigger();

drop trigger if exists trg_auditoria_facturas on public.facturas;
create trigger trg_auditoria_facturas
  after insert or update or delete on public.facturas
  for each row execute procedure public.auditoria_trigger();

drop trigger if exists trg_auditoria_movimientos on public.movimientos_stock;
create trigger trg_auditoria_movimientos
  after insert on public.movimientos_stock
  for each row execute procedure public.auditoria_trigger();

drop trigger if exists trg_auditoria_usuarios on public.usuarios;
create trigger trg_auditoria_usuarios
  after insert or update or delete on public.usuarios
  for each row execute procedure public.auditoria_trigger();

drop trigger if exists trg_auditoria_negocio on public.negocio;
create trigger trg_auditoria_negocio
  after insert or update or delete on public.negocio
  for each row execute procedure public.auditoria_trigger();
