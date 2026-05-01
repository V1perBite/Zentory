alter table public.negocio
  add column if not exists email text;

do $$
begin
  create type public.negocio_mensaje_tipo as enum ('encabezado', 'cierre');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.negocio_mensajes (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocio(id) on delete cascade,
  tipo public.negocio_mensaje_tipo not null,
  orden integer not null default 0,
  texto text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_negocio_mensajes_negocio_tipo_orden
  on public.negocio_mensajes(negocio_id, tipo, orden, created_at);

alter table public.negocio_mensajes enable row level security;

drop policy if exists negocio_mensajes_select_authenticated on public.negocio_mensajes;
create policy negocio_mensajes_select_authenticated on public.negocio_mensajes
  for select using (auth.uid() is not null);

drop policy if exists negocio_mensajes_insert_admin on public.negocio_mensajes;
create policy negocio_mensajes_insert_admin on public.negocio_mensajes
  for insert with check (public.is_admin());

drop policy if exists negocio_mensajes_update_admin on public.negocio_mensajes;
create policy negocio_mensajes_update_admin on public.negocio_mensajes
  for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists negocio_mensajes_delete_admin on public.negocio_mensajes;
create policy negocio_mensajes_delete_admin on public.negocio_mensajes
  for delete using (public.is_admin());

insert into public.negocio_mensajes (negocio_id, tipo, orden, texto)
select n.id, 'cierre'::public.negocio_mensaje_tipo, 1, n.mensaje_agradecimiento
from public.negocio n
where coalesce(trim(n.mensaje_agradecimiento), '') <> ''
  and not exists (
    select 1
    from public.negocio_mensajes nm
    where nm.negocio_id = n.id and nm.tipo = 'cierre'
  );
