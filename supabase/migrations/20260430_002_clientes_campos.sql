alter table public.clientes
  add column if not exists nit text,
  add column if not exists email text;
