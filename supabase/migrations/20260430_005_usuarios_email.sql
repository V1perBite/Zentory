alter table public.usuarios
  add column if not exists email text;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
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
  set
    nombre = excluded.nombre,
    email  = excluded.email;

  return new;
end;
$$;
