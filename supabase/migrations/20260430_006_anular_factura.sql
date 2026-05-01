-- Allow 'anulada' as a valid invoice state (enum extension)
ALTER TYPE public.factura_estado ADD VALUE IF NOT EXISTS 'anulada';

-- RPC: anular_factura
-- Marks invoice as 'anulada', restores stock for each item, records kardex entries
DROP FUNCTION IF EXISTS anular_factura(uuid);
CREATE OR REPLACE FUNCTION anular_factura(p_factura_id uuid)
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

  -- Verify factura exists and is not already anulada
  IF NOT EXISTS (
    SELECT 1 FROM public.facturas WHERE id = p_factura_id AND estado <> 'anulada'
  ) THEN
    RAISE EXCEPTION 'Factura no encontrada o ya anulada';
  END IF;

  v_motivo := 'Devolución por anulación de factura #' || (
    SELECT numero_factura::text FROM public.facturas WHERE id = p_factura_id
  );

  -- Restore stock and log kardex for each item
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
      producto_id,
      tipo,
      cantidad,
      motivo,
      factura_id,
      usuario_id,
      costo_unitario
    )
    VALUES (
      v_item.producto_id,
      'entrada',
      v_item.cantidad,
      v_motivo,
      p_factura_id,
      v_user_id,
      v_item.precio_costo
    );
  END LOOP;

  -- Mark factura as anulada
  UPDATE public.facturas
  SET estado = 'anulada'
  WHERE id = p_factura_id;
END;
$$;

-- Grant execute to authenticated users (RLS on facturas table controls access)
GRANT EXECUTE ON FUNCTION anular_factura(uuid) TO authenticated;
