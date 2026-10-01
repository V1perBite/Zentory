-- Generado por scripts/limpiar-prueba.js el 2026-10-01T19:41:18.587Z
-- Borra TODOS los datos marcados [PRUEBA] (clientes, productos, facturas,
-- items y movimientos). Idempotente.
begin;
do $limpia$
declare
  v_clientes  uuid[] := array['4af6b526-788e-4777-b07d-459d26bdf47e'::uuid, '720767f9-66e3-4687-84d8-d9e6cec7e80a'::uuid, 'cb0fcc24-4f04-45f8-93e2-6562a76dbbe9'::uuid]::uuid[];
  v_productos uuid[] := array['47fdaba2-0c8e-4636-8282-8f8e43830218'::uuid, '04a2e77d-cfca-4ccf-9ab1-2bb8506d0968'::uuid, 'e33cfc6d-f23b-47d6-b6bb-fd9179edaa5a'::uuid, '0c2164df-5c96-44a1-bf38-162f5c857f60'::uuid, '042be03c-f6f7-4dbd-a1ce-bff276f1dfb9'::uuid, 'b37f5f8c-6586-4dfc-80bc-023f9bff6d65'::uuid, '36182086-eb82-42ab-8df5-239ad3fdc6b9'::uuid, '22802e78-7a0e-4e7c-95cb-0f6191f2ba01'::uuid, '4fe55e85-d245-46e4-b0c1-c4f199d7a002'::uuid, 'e586a40c-de68-4157-9891-fc86625d0d93'::uuid]::uuid[];
  v_facturas  uuid[] := array['01d6d088-ad76-4a89-adef-afdf7c2839bf'::uuid, '21ce01fe-0a31-4609-aa73-e1aa03251e3e'::uuid, 'c02b8681-f254-4ca1-b993-62c28977d95a'::uuid, 'b05042bd-1d75-475c-bb97-57fa8f772a04'::uuid, 'a1fab7d4-6e85-4caf-ada3-94c8c0403129'::uuid, 'f633d754-ce40-4169-984f-e2fbb3417687'::uuid, '932fc1fc-f070-493c-b386-e6f23824e574'::uuid, 'e0a349e5-2645-4ee4-9185-e20ec7a5972d'::uuid, '95b3e159-4b88-4b04-9cbf-72bcd412c2c9'::uuid, 'c8d35adb-c468-4380-b6b5-5634726c6d95'::uuid, '6850c6e3-944e-41ec-a3d7-1c300e04b38b'::uuid, '70b16e6f-a7df-4af6-b5e1-07cb5a8acb5d'::uuid]::uuid[];
begin
  alter table public.facturas
    disable trigger trg_bloquear_modificacion_anulada;

  delete from public.movimientos_stock
   where motivo like '[PRUEBA]%'
      or factura_id = any(v_facturas)
      or producto_id = any(v_productos);

  delete from public.facturas
   where id = any(v_facturas)
      or cliente_id in (select id from public.clientes
                         where identificacion like 'PRUEBA-%');

  delete from public.productos
   where id = any(v_productos) or sku_code like 'PRUEBA-%';

  delete from public.clientes
   where id = any(v_clientes) or identificacion like 'PRUEBA-%';

  alter table public.facturas
    enable trigger trg_bloquear_modificacion_anulada;
end $limpia$;
commit;

-- Verificación: deben quedar 0 filas marcadas
select
  (select count(*) from public.clientes where identificacion like 'PRUEBA-%') as clientes_prueba,
  (select count(*) from public.productos where sku_code like 'PRUEBA-%') as productos_prueba,
  (select count(*) from public.movimientos_stock where motivo like '[PRUEBA]%') as movimientos_prueba,
  (select count(*) from public.facturas f
     join public.clientes c on c.id = f.cliente_id
    where c.identificacion like 'PRUEBA-%') as facturas_prueba;
