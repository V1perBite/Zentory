-- Activar Realtime en la tabla facturas para que el Centro de Impresión
-- detecte automáticamente nuevas facturas sin necesidad de refrescar.
alter publication supabase_realtime add table facturas;
