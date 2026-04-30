create table if not exists public.negocio (
  id uuid primary key default gen_random_uuid(),
  nombre text not null default 'Mi Negocio',
  direccion text,
  telefono text,
  nit text,
  mensaje_agradecimiento text not null default 'Gracias por su compra',
  updated_at timestamptz not null default now()
);

alter table public.negocio enable row level security;

create policy negocio_select_authenticated on public.negocio
  for select using (auth.uid() is not null);

create policy negocio_update_admin on public.negocio
  for update using (public.is_admin()) with check (public.is_admin());

create policy negocio_insert_admin on public.negocio
  for insert with check (public.is_admin());

insert into public.negocio (nombre, mensaje_agradecimiento)
values ('Mi Negocio', 'Gracias por su compra')
on conflict do nothing;
