-- Add puede_crear_productos flag to usuarios table
-- Allows vendedor role to temporarily create products (toggled by admin)
alter table public.usuarios
  add column puede_crear_productos boolean not null default false;
