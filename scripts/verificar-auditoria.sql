-- ============================================================
-- scripts/verificar-auditoria.sql
--
-- Verifica que el sistema de auditoría (migración 014) quedó bien
-- instalado. Ejecutar en el SQL Editor de Supabase.
--
-- Cada comprobación imprime "OK: ..." o lanza "FALLO: ...".
-- La sección final hace una prueba de humo real y termina en
-- ROLLBACK: no deja ningún dato ni ningún evento.
-- ============================================================

-- ── 1. Esquema: permisos de usuarios, tabla e índices ───────
do $$
declare
  n integer;
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'usuarios'
      and column_name = 'puede_ver_auditoria'
  ) then
    raise exception 'FALLO: falta usuarios.puede_ver_auditoria';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'usuarios'
      and column_name = 'puede_exportar_auditoria'
  ) then
    raise exception 'FALLO: falta usuarios.puede_exportar_auditoria';
  end if;
  raise notice 'OK: permisos de auditoría en public.usuarios';

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'usuarios'
      and column_name = 'ultima_ip'
  ) then
    raise exception 'FALLO: falta usuarios.ultima_ip';
  end if;
  raise notice 'OK: usuarios.ultima_ip';

  if to_regclass('public.auditoria_eventos') is null then
    raise exception 'FALLO: no existe la tabla public.auditoria_eventos';
  end if;
  raise notice 'OK: tabla public.auditoria_eventos';

  select count(*) into n from pg_indexes
   where schemaname = 'public' and tablename = 'auditoria_eventos'
     and indexname like 'idx_auditoria%';
  if n < 7 then
    raise exception 'FALLO: se esperaban 7 índices de auditoría y hay %', n;
  end if;
  raise notice 'OK: 7 índices de auditoría';
end $$;

-- ── 2. Triggers de captura en las 6 tablas ──────────────────
do $$
declare
  t text;
  trg text;
  ok boolean;
begin
  foreach t in array array[
    'productos', 'clientes', 'facturas', 'movimientos_stock', 'usuarios', 'negocio'
  ] loop
    trg := 'trg_auditoria_' || case when t = 'movimientos_stock'
                                     then 'movimientos' else t end;
    select exists (
      select 1 from pg_trigger
      where tgrelid = ('public.' || t)::regclass
        and tgname = trg
        and not tgisinternal
    ) into ok;
    if not ok then
      raise exception 'FALLO: falta el trigger % sobre %', trg, t;
    end if;
    raise notice 'OK: trigger % en %', trg, t;
  end loop;
end $$;

-- ── 3. RLS: sólo lectura autorizada, sin escritura ──────────
do $$
begin
  if not exists (
    select 1 from pg_class
    where oid = 'public.auditoria_eventos'::regclass
      and relrowsecurity
  ) then
    raise exception 'FALLO: RLS no está habilitado en auditoria_eventos';
  end if;
  raise notice 'OK: RLS habilitado en auditoria_eventos';

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'auditoria_eventos'
      and cmd = 'SELECT'
  ) then
    raise exception 'FALLO: falta la policy de SELECT de auditoría';
  end if;
  raise notice 'OK: policy de SELECT en auditoria_eventos';

  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'auditoria_eventos'
      and cmd in ('INSERT', 'UPDATE', 'DELETE')
  ) then
    raise exception 'FALLO: existe una policy de escritura en auditoria_eventos';
  end if;
  raise notice 'OK: sin policies de escritura en auditoria_eventos';
end $$;

-- ── 4. Funciones, helpers y grants ──────────────────────────
do $$
declare
  f_registrar  oid;
  f_insertar   oid;
  f_ip         oid;
begin
  select oid into f_registrar from pg_proc
   where pronamespace = 'public'::regnamespace and proname = 'auditoria_registrar';
  if f_registrar is null then
    raise exception 'FALLO: falta la función auditoria_registrar()';
  end if;
  if not has_function_privilege('authenticated', f_registrar, 'execute') then
    raise exception 'FALLO: authenticated no puede ejecutar auditoria_registrar()';
  end if;
  if not has_function_privilege('anon', f_registrar, 'execute') then
    raise exception 'FALLO: anon no puede ejecutar auditoria_registrar() (LOGIN_FALLIDO se perdería)';
  end if;
  raise notice 'OK: grants de auditoria_registrar()';

  select oid into f_insertar from pg_proc
   where pronamespace = 'public'::regnamespace and proname = 'auditoria_insertar';
  if f_insertar is null then
    raise exception 'FALLO: falta la función auditoria_insertar()';
  end if;
  if has_function_privilege('authenticated', f_insertar, 'execute') then
    raise exception 'FALLO: authenticated puede ejecutar auditoria_insertar() directamente';
  end if;
  if has_function_privilege('anon', f_insertar, 'execute') then
    raise exception 'FALLO: anon puede ejecutar auditoria_insertar() directamente';
  end if;
  raise notice 'OK: auditoria_insertar() sólo para el dueño (triggers)';

  select oid into f_ip from pg_proc
   where pronamespace = 'public'::regnamespace and proname = 'auditoria_registrar_ip';
  if f_ip is null then
    raise exception 'FALLO: falta la función auditoria_registrar_ip()';
  end if;
  if not has_function_privilege('authenticated', f_ip, 'execute') then
    raise exception 'FALLO: authenticated no puede ejecutar auditoria_registrar_ip()';
  end if;
  raise notice 'OK: grants de auditoria_registrar_ip()';

  if not exists (
    select 1 from pg_proc
    where pronamespace = 'public'::regnamespace
      and proname in ('puede_ver_auditoria', 'puede_exportar_auditoria')
  ) then
    raise exception 'FALLO: faltan los helpers de permiso de auditoría';
  end if;
  raise notice 'OK: helpers puede_ver_auditoria() / puede_exportar_auditoria()';
end $$;

-- ── 5. Prueba de humo real (todo se revierte con ROLLBACK) ──
begin;

do $$
declare
  v_id     uuid;
  v_prev   jsonb;
  v_nue    jsonb;
  v_evento uuid;
  n        integer;
  total    integer;
begin
  -- 5.1 INSERT genera exactamente un evento
  insert into public.productos
    (nombre, sku_code, precio_venta, precio_costo, stock_actual, minimo_stock, activo)
  values
    ('Producto de prueba de auditoría', 'AUD-TEST-001', 1000, 500, 0, 0, true)
  returning id into v_id;

  select count(*) into n
    from public.auditoria_eventos
   where entidad = 'PRODUCTO' and entidad_id = v_id;
  if n <> 1 then
    raise exception 'FALLO: se esperaba 1 evento PRODUCTO_CREADO y hay %', n;
  end if;
  raise notice 'OK: el INSERT genera PRODUCTO_CREADO';

  -- 5.2 UPDATE con cambio registra el diff exacto ANTES/DESPUÉS
  update public.productos set precio_venta = 1500 where id = v_id;

  select count(*) into n
    from public.auditoria_eventos
   where entidad = 'PRODUCTO' and entidad_id = v_id;
  if n <> 2 then
    raise exception 'FALLO: se esperaban 2 eventos (alta + cambio de precio) y hay %', n;
  end if;

  select valores_previos, valores_nuevos into v_prev, v_nue
    from public.auditoria_eventos
   where entidad = 'PRODUCTO' and entidad_id = v_id
     and accion = 'PRODUCTO_PRECIO_MODIFICADO';

  if v_prev is null then
    raise exception 'FALLO: no se registró el evento PRODUCTO_PRECIO_MODIFICADO';
  end if;
  if coalesce((v_prev ->> 'precio_venta')::numeric, -1) <> 1000
     or coalesce((v_nue ->> 'precio_venta')::numeric, -1) <> 1500 then
    raise exception 'FALLO: diff de precio_venta incorrecto: % -> %', v_prev, v_nue;
  end if;
  raise notice 'OK: precio_venta registrado exacto (1000 -> 1500)';

  -- 5.3 UPDATE sin cambios no genera evento
  select count(*) into total
    from public.auditoria_eventos
   where entidad = 'PRODUCTO' and entidad_id = v_id;

  update public.productos set nombre = nombre where id = v_id;

  select count(*) into n
    from public.auditoria_eventos
   where entidad = 'PRODUCTO' and entidad_id = v_id;
  if n <> total then
    raise exception 'FALLO: un UPDATE sin cambios generó un evento extra (% -> %)', total, n;
  end if;
  raise notice 'OK: un UPDATE sin cambios no genera evento';

  -- 5.4 Inmutabilidad: ni UPDATE ni DELETE dejan pasar
  select id into v_evento
    from public.auditoria_eventos
   where entidad = 'PRODUCTO' and entidad_id = v_id
     and accion = 'PRODUCTO_PRECIO_MODIFICADO';

  begin
    update public.auditoria_eventos set descripcion = 'hacked' where id = v_evento;
    raise exception 'FALLO: se pudo modificar un evento de auditoría';
  exception when raise_exception then
    if sqlerrm like 'FALLO:%' then raise; end if;
    raise notice 'OK: UPDATE sobre auditoría rechazado (%)', left(sqlerrm, 60);
  end;

  begin
    delete from public.auditoria_eventos where id = v_evento;
    raise exception 'FALLO: se pudo borrar un evento de auditoría';
  exception when raise_exception then
    if sqlerrm like 'FALLO:%' then raise; end if;
    raise notice 'OK: DELETE sobre auditoría rechazado (%)', left(sqlerrm, 60);
  end;

  -- 5.5 La RPC sólo admite su lista blanca y exige sesión
  begin
    perform public.auditoria_registrar('PRODUCTO_MODIFICADO', 'PRODUCTOS', 'PRODUCTO');
    raise exception 'FALLO: la RPC aceptó una acción que escriben los triggers';
  exception when raise_exception then
    if sqlerrm like 'FALLO:%' then raise; end if;
    raise notice 'OK: lista blanca de auditoria_registrar() (%)', left(sqlerrm, 70);
  end;

  raise notice 'OK: prueba de humo completada';
end $$;

-- 5.6 Con sesión simulada: LOGIN_FALLIDO y rechazo del resto de acciones
do $$
declare
  v_user uuid;
begin
  select id into v_user from public.usuarios order by created_at limit 1;
  if v_user is null then
    raise notice 'AVISO: no hay usuarios, se omite la prueba con sesión';
    return;
  end if;

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_user, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_user::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  begin
    perform public.auditoria_registrar(
      'LOGIN_FALLIDO', 'USUARIOS', 'USUARIO',
      null, 'prueba@auditoria.test', 'Prueba de auditoría', null, null, null, '127.0.0.1', null);
    raise notice 'OK: LOGIN_FALLIDO registrado con sesión (se revierte con el ROLLBACK)';
  exception when others then
    raise notice 'AVISO: LOGIN_FALLIDO rechazado (%)', sqlerrm;
  end;

  begin
    perform public.auditoria_registrar('LOGIN', 'USUARIOS', 'USUARIO');
    raise notice 'OK: LOGIN admitido con sesión (se revierte con el ROLLBACK)';
  exception when others then
    raise notice 'AVISO: LOGIN rechazado (%)', sqlerrm;
  end;
end $$;

rollback;

select 'OK: rollback aplicado, la prueba no dejó datos ni eventos' as resultado;

-- ── 6. La operación de negocio real también queda auditada ──
-- Repite una venta con confirmar_factura() y comprueba los eventos
-- de factura y de kardex. Todo termina en ROLLBACK.
begin;

do $$
declare
  v_user    uuid;
  v_prod    record;
  v_stock0  integer;
  v_cant    integer := 1;
  n_base    integer;
  n_fact    integer;
  n_mov     integer;
  n_mov2    integer;
  n_anul    integer;
  v_factura uuid;
  v_motivo  text;
  v_prev    jsonb;
  v_nue     jsonb;
begin
  select id into v_user from public.usuarios
   where activo = true
   order by (rol = 'admin') desc, created_at
   limit 1;

  if v_user is null then
    raise notice 'AVISO: no hay usuarios activos, se omite la prueba de negocio';
    return;
  end if;

  select id, stock_actual into v_prod
    from public.productos
   where activo = true and stock_actual > 0
   order by stock_actual desc
   limit 1;

  if not found then
    raise notice 'AVISO: no hay productos con stock, se omite la prueba de negocio';
    return;
  end if;

  v_stock0 := v_prod.stock_actual;

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_user, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_user::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  select count(*) into n_base from public.auditoria_eventos;

  perform public.confirmar_factura(jsonb_build_object(
    'cliente', jsonb_build_object('nombre', 'Cliente de prueba de auditoría',
                                  'identificacion', '99999999999'),
    'items', jsonb_build_array(jsonb_build_object(
      'producto_id', v_prod.id, 'cantidad', v_cant)),
    'descuento_global_tipo', 'valor',
    'descuento_global_valor', 0
  ));

  select count(*) into n_fact from public.auditoria_eventos
   where accion = 'FACTURA_CREADA' and usuario_id = v_user;
  if n_fact <> 1 then
    raise exception 'FALLO: no se registró FACTURA_CREADA con el usuario real (hay %)', n_fact;
  end if;
  raise notice 'OK: confirmar_factura() genera FACTURA_CREADO con el usuario real';

  select count(*) into n_mov from public.auditoria_eventos
   where entidad = 'MOVIMIENTO' and modulo = 'INVENTARIO';
  if n_mov < 1 then
    raise exception 'FALLO: la venta no generó eventos de kardex';
  end if;
  raise notice 'OK: la venta genera eventos de kardex (%)', n_mov;

  select valores_previos, valores_nuevos into v_prev, v_nue
    from public.auditoria_eventos
   where entidad = 'MOVIMIENTO' and valores_previos ? 'stock_actual'
   limit 1;

  if v_prev is null or v_prev ->> 'stock_actual' is null
     or v_nue ->> 'stock_actual' is null then
    raise exception 'FALLO: el evento de kardex no trae stock antes/después: % -> %', v_prev, v_nue;
  end if;
  if (v_prev ->> 'stock_actual')::integer <> (v_nue ->> 'stock_actual')::integer + v_cant then
    raise exception 'FALLO: stock antes/después incoherente: % -> %', v_prev, v_nue;
  end if;
  if (v_nue ->> 'stock_actual')::integer <> v_stock0 - v_cant then
    raise exception 'FALLO: stock final esperado % y obtenido %',
      v_stock0 - v_cant, v_nue ->> 'stock_actual';
  end if;
  raise notice 'OK: kardex con stock antes (%) -> después (%)',
    v_prev ->> 'stock_actual', v_nue ->> 'stock_actual';

  if (select count(*) from public.auditoria_eventos) <= n_base then
    raise exception 'FALLO: la venta no añadió eventos de auditoría';
  end if;
  raise notice 'OK: la venta real queda auditada por completo';

  -- 6.x Anulación: la acción y el motivo también quedan registrados
  if not exists (select 1 from public.usuarios where id = v_user and rol = 'admin') then
    raise notice 'AVISO: no hay admin, se omite la prueba de anulación';
    return;
  end if;

  select id into v_factura from public.facturas
   order by created_at desc limit 1;

  perform public.anular_factura(v_factura, 'Prueba de auditoría: anulación');

  select count(*) into n_anul from public.auditoria_eventos
   where accion = 'ANULACION_FACTURA';
  if n_anul <> 1 then
    raise exception 'FALLO: no se registró ANULACION_FACTURA (hay %)', n_anul;
  end if;

  select motivo into v_motivo
    from public.auditoria_eventos
   where accion = 'ANULACION_FACTURA';
  if coalesce(v_motivo, '') <> 'Prueba de auditoría: anulación' then
    raise exception 'FALLO: el motivo de la anulación no se capturó (%)', v_motivo;
  end if;
  raise notice 'OK: ANULACION_FACTURA registrada con su motivo';

  select count(*) into n_mov2 from public.auditoria_eventos
   where entidad = 'MOVIMIENTO';
  if n_mov2 <= n_mov then
    raise exception 'FALLO: anular la factura no generó eventos de kardex';
  end if;
  raise notice 'OK: anulación también auditada (kardex % -> %)', n_mov, n_mov2;
end $$;

rollback;


