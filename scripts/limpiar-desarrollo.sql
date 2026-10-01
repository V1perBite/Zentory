-- Limpieza de datos de desarrollo / prueba (2026-10-01)
-- Ejecutado por scripts (MCP Supabase execute_sql). Idempotente.
-- Borra:
--   * facturas N#1-N#20 (todas anuladas, abril-septiembre 2026) y sus
--     movimientos ligados (venta + devolución = efecto neto 0 en stock)
--   * movimientos sueltos de prueba (motivos 'prueba', 'dd', 'Home element', ...)
--   * productos de prueba sku 'z', '1001', '1002'
--   * revierte el efecto en stock de los movimientos de prueba obvios
begin;
do $limpia$
declare
  v_facturas uuid[] := array[
    '44ff36b7-f20c-488a-9d54-83a618d956ac',
    'a87e9911-f837-4c2c-b554-035736474087',
    '9753dfd0-9f48-4bd2-bfa9-b46608a41262',
    '7783a8ef-c8f3-4e2c-9b81-1f7ba5c42d96',
    'c1e85cf7-95b6-49c9-ab01-605ac7f61a63',
    '25246b12-74c7-442c-b1c9-498aea50d36c',
    '27366769-b192-408c-a634-ea47331fa948',
    '191e1dcf-6d9d-4b6b-8edc-8577078675b5',
    'a78a13c0-2073-439a-b3d9-38acc6786cdf',
    '5dd338e4-6e57-4e6b-9632-9233318a35ce',
    '28a7787d-4fb0-4951-ba53-57cb53f36cd5',
    'a952fa3c-e1de-45cc-a8fe-9ff7c0a2fb06',
    '6f2ee0c5-dd0c-4f41-b6a2-41b5d94c0dfc',
    '1ea5f75e-e81c-4b86-be5b-56964bbb0d6b',
    '430953b1-2777-49c3-917d-c22cb2bce32b',
    '449b13e1-691f-401d-bb55-81a32d572fff',
    '5d7c38f8-b714-44d8-b203-9050384e5bf3',
    'b6b3e284-5b6b-488d-9666-f9faefde293a',
    '4746ade5-bb0e-4512-9e3f-8feebf09111d',
    '49ddbf90-e611-4726-9351-c2826fe834c9'
  ]::uuid[];
begin
  alter table public.facturas
    disable trigger trg_bloquear_modificacion_anulada;

  delete from public.movimientos_stock
   where factura_id = any(v_facturas)
      or motivo in (
        'Stock correction for UI test',
        'prueba',
        'dd',
        'Home element',
        'Home elemnt',
        'Equivocación',
        'Factura #1',
        'Reajuste',
        'Factura #6034'
      );

  delete from public.facturas
   where id = any(v_facturas);

  delete from public.productos
   where sku_code in ('z', '1001', '1002');

  -- Revierte el efecto en stock de los movimientos de prueba obvios
  update public.productos set stock_actual = stock_actual - 3 where sku_code = '7707855212659';
  update public.productos set stock_actual = stock_actual - 3 where sku_code = '7707855213601';
  update public.productos set stock_actual = stock_actual + 3 where sku_code = '7891112334403';

  alter table public.facturas
    enable trigger trg_bloquear_modificacion_anulada;
end $limpia$;
commit;

-- Verificación
select
  (select count(*) from public.facturas)                          as facturas,
  (select count(*) from public.facturas where estado = 'anulada')  as anuladas,
  (select count(*) from public.items_factura)                      as items,
  (select count(*) from public.productos where sku_code in ('z','1001','1002')) as productos_prueba,
  (select count(*) from public.movimientos_stock where motivo in
      ('Stock correction for UI test','prueba','dd','Home element','Home elemnt',
       'Equivocación','Factura #1','Reajuste','Factura #6034'))     as mov_prueba,
  (select count(*) from public.movimientos_stock m
     join public.facturas f on f.id = m.factura_id
    where f.numero_factura <= 20)                                   as mov_facturas_borradas,
  (select stock_actual from public.productos where sku_code = '7707855212659') as olla_4_2l,
  (select stock_actual from public.productos where sku_code = '7707855213601') as olla_6l,
  (select stock_actual from public.productos where sku_code = '7891112334403') as sartenes;
