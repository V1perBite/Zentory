-- Agregar columna razon_anulacion a facturas
ALTER TABLE public.facturas ADD COLUMN IF NOT EXISTS razon_anulacion text;

-- Actualizar RPC anular_factura para aceptar p_razon
DROP FUNCTION IF EXISTS anular_factura(uuid);
CREATE OR REPLACE FUNCTION anular_factura(p_factura_id uuid, p_razon text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item RECORD;
  v_motivo TEXT;
  v_user_id uuid := auth.uid();
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Solo admin puede anular facturas';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.facturas WHERE id = p_factura_id AND estado <> 'anulada'
  ) THEN
    RAISE EXCEPTION 'Factura no encontrada o ya anulada';
  END IF;

  v_motivo := 'Devolución por anulación de factura #' || (
    SELECT numero_factura::text FROM public.facturas WHERE id = p_factura_id
  );

  FOR v_item IN
    SELECT fi.producto_id, fi.cantidad, p.precio_costo
    FROM public.items_factura fi
    JOIN public.productos p ON p.id = fi.producto_id
    WHERE fi.factura_id = p_factura_id
  LOOP
    UPDATE public.productos
    SET stock_actual = stock_actual + v_item.cantidad
    WHERE id = v_item.producto_id;

    INSERT INTO public.movimientos_stock (
      producto_id, tipo, cantidad, motivo, factura_id, usuario_id, costo_unitario
    ) VALUES (
      v_item.producto_id, 'entrada', v_item.cantidad, v_motivo, p_factura_id, v_user_id, v_item.precio_costo
    );
  END LOOP;

  UPDATE public.facturas
  SET estado = 'anulada', razon_anulacion = p_razon
  WHERE id = p_factura_id;
END;
$$;

GRANT EXECUTE ON FUNCTION anular_factura(uuid, text) TO authenticated;
