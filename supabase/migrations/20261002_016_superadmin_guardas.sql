-- ============================================================
-- 20261002_016_superadmin_guardas.sql
--
-- Guardas del rol superadmin (depende de 015, que añade el valor al
-- enum public.user_role).
--
--   1. is_admin() reconoce 'superadmin' → TODAS las policies RLS que
--      usan is_admin() quedan actualizadas de una vez.
--   2. usuarios_update_admin: ningún admin ajeno puede tocar la fila
--      superadmin (sólo ella misma).
--   3. Trigger trg_proteger_superadmin: la BD se protege sola aunque
--      el acceso sea directo con service_role o SQL:
--        · no permite un segundo superadmin;
--        · no permite quitarle el rol ni desactivarlo;
--        - no permite eliminarlo (tampoco vía cascade desde auth.users).
--   4. auditoria_registrar(): admite USUARIO_MODIFICADO / USUARIO_ELIMINADO
--      vía RPC (los cambios de contraseña no tocan ninguna tabla, así que
--      ningún trigger los ve).
--   5. Promueve a superadmin a la cuenta única autorizada.
--
-- Idempotente: se puede ejecutar más de una vez.
-- ============================================================

-- ── 1. is_admin() ──────────────────────────────────────────
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
    where u.id = auth.uid()
      and u.rol in ('admin', 'superadmin')
      and u.activo = true
  );
$$;

-- ── 2. RLS: la fila superadmin sólo es editable por sí misma ──
drop policy if exists usuarios_update_admin on public.usuarios;
create policy usuarios_update_admin on public.usuarios
for update
using (public.is_admin() and (id = auth.uid() or rol <> 'superadmin'))
with check (public.is_admin() and (id = auth.uid() or rol <> 'superadmin'));

-- ── 3. Trigger de protección ───────────────────────────────
create or replace function public.proteger_superadmin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.rol = 'superadmin' and exists (
      select 1 from public.usuarios u
      where u.rol = 'superadmin' and u.id <> new.id
    ) then
      raise exception 'Sólo puede existir un superadmin en el sistema';
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if new.rol = 'superadmin'
       and old.rol <> 'superadmin'
       and exists (
      select 1 from public.usuarios u
      where u.rol = 'superadmin' and u.id <> new.id
    ) then
      raise exception 'Sólo puede existir un superadmin en el sistema';
    end if;

    if old.rol = 'superadmin' and new.rol <> 'superadmin' then
      raise exception 'No se puede quitar el rol superadmin a la cuenta protegida';
    end if;

    if old.rol = 'superadmin' and new.activo = false then
      raise exception 'La cuenta superadmin no puede desactivarse';
    end if;

    return new;
  end if;

  if tg_op = 'DELETE' then
    if old.rol = 'superadmin' then
      raise exception 'No se puede eliminar la cuenta superadmin';
    end if;
    return old;
  end if;

  return null;
end;
$$;

drop trigger if exists trg_proteger_superadmin on public.usuarios;
create trigger trg_proteger_superadmin
  before insert or update or delete on public.usuarios
  for each row execute procedure public.proteger_superadmin();

-- ── 4. auditoria_registrar(): whitelist ampliada ───────────
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

  -- Los eventos de tablas los escriben los triggers; aquí sólo se
  -- registran los que no tienen fila asociada (login, logout, creación,
  -- cambio de contraseña —que no toca ninguna tabla— y exportaciones).
  if upper(p_accion) not in (
    'LOGIN', 'LOGOUT', 'LOGIN_FALLIDO', 'USUARIO_CREADO',
    'USUARIO_MODIFICADO', 'USUARIO_ELIMINADO', 'EXPORTACION_AUDITORIA'
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

-- ── 5. Cuenta superadmin autorizada ────────────────────────
-- Se ejecuta después de crear el trigger: pasa porque todavía no existe
-- ningún superadmin. Si se repite, es un no-op (el rol ya es correcto).
update public.usuarios
   set rol = 'superadmin'
 where lower(email) = 'davidromerogocel@gmail.com'
   and rol <> 'superadmin';
