-- ============================================================
-- 019 — Módulo de facturas de compra (admin / superadmin)
-- ============================================================
-- Registro contable de las facturas que entra la empresa (proveedores):
-- cuándo se recibió, cuánto valió, quién la emitió y cuándo se pagó.
--
-- Es un registro de flujo de caja. NO toca productos, stock, kardex ni
-- precio_costo: las entradas de mercancía siguen manejándose por el
-- kardex con su costo_unitario.
--
-- Incluye la ampliación de la whitelist de auditoria_registrar() porque
-- la RPC sólo admite códigos listados y este módulo escribe desde
-- server actions (patrón de /admin/usuarios).
--
-- Idempotente: todo usa if not exists / create or replace.

-- ------------------------------------------------------------
-- 1) Tabla
-- ------------------------------------------------------------
create table if not exists public.facturas_compra (
  id              uuid primary key default gen_random_uuid(),
  empresa         text not null check (length(btrim(empresa)) > 0),
  numero_factura  text,
  concepto        text,
  valor           numeric(14,2) not null default 0 check (valor >= 0),
  fecha_recibida  date not null default current_date,
  fecha_pago      date,
  estado          text not null default 'pendiente'
                  check (estado in ('pendiente', 'parcial', 'pagada', 'anulada')),
  notas           text,
  creado_por      uuid default auth.uid() references public.usuarios (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint facturas_compra_pago_posterior check (
    fecha_pago is null or fecha_pago >= fecha_recibida
  )
);

comment on column public.facturas_compra.estado is
  'pendiente | parcial | pagada | anulada. Es la fuente de verdad del dashboard; fecha_pago es informativa.';

-- ------------------------------------------------------------
-- 2) Índices
-- ------------------------------------------------------------
create index if not exists idx_facturas_compra_fecha_recibida
  on public.facturas_compra (fecha_recibida desc, created_at desc);
create index if not exists idx_facturas_compra_estado
  on public.facturas_compra (estado) where estado in ('pendiente', 'parcial');
create index if not exists idx_facturas_compra_empresa
  on public.facturas_compra (lower(btrim(empresa)));

-- ------------------------------------------------------------
-- 3) RLS — sólo admin y superadmin
-- ------------------------------------------------------------
alter table public.facturas_compra enable row level security;

drop policy if exists facturas_compra_select_admin on public.facturas_compra;
create policy facturas_compra_select_admin on public.facturas_compra
  for select using (public.is_admin());

drop policy if exists facturas_compra_insert_admin on public.facturas_compra;
create policy facturas_compra_insert_admin on public.facturas_compra
  for insert with check (public.is_admin());

drop policy if exists facturas_compra_update_admin on public.facturas_compra;
create policy facturas_compra_update_admin on public.facturas_compra
  for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists facturas_compra_delete_admin on public.facturas_compra;
create policy facturas_compra_delete_admin on public.facturas_compra
  for delete using (public.is_admin());

-- ------------------------------------------------------------
-- 4) Whitelist de auditoria_registrar()
-- ------------------------------------------------------------
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
    'EXPORTACION_AUDITORIA', 'EXPORTACION_INVENTARIO', 'EXPORTACION_REPORTE',
    'COMPRA_CREADA', 'COMPRA_MODIFICADA', 'COMPRA_ELIMINADA',
    'EXPORTACION_COMPRA'
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
