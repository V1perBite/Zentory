-- ============================================================
-- 018 — Auditoría de las exportaciones
-- ============================================================
-- Las exportaciones de inventario y de reportes no escriben en ninguna
-- tabla de negocio, así que su único registro posible es la RPC
-- auditoria_registrar(). Esa función tiene una lista blanca de acciones
-- (016) y rechaza con excepción cualquier código que no esté en ella.
--
-- Se amplía la lista con:
--   EXPORTACION_INVENTARIO  -> actions/inventario-export.ts (sólo admin)
--   EXPORTACION_REPORTE     -> actions/auditoria.ts:registrarExportacionReporte
--
-- Idempotente: CREATE OR REPLACE conserva los GRANT ya otorgados.

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

  -- Los eventos de tablas los escriben los triggers; la RPC sólo registra
  -- los que no tienen fila asociada (login, logout, creación, exportaciones).
  if upper(p_accion) not in (
    'LOGIN', 'LOGOUT', 'LOGIN_FALLIDO', 'USUARIO_CREADO',
    'USUARIO_MODIFICADO', 'USUARIO_ELIMINADO',
    'EXPORTACION_AUDITORIA', 'EXPORTACION_INVENTARIO', 'EXPORTACION_REPORTE'
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
