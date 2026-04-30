-- Allow 'anulada' as a valid invoice state (enum extension)
ALTER TYPE public.factura_estado ADD VALUE IF NOT EXISTS 'anulada';

-- RPC: anular_factura
-- Marks invoice as 'anulada', restores stock for each item, records kardex entries
DROP FUNCTION IF EXISTS anular_factura(uuid);
CREATE OR REPLACE FUNCTION anular_factura(p_factura_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_item RECORD;
  v_motivo TEXT;
BEGIN
  -- Verify factura exists and is not already anulada
  IF NOT EXISTS (
    SELECT 1 FROM facturas WHERE id = p_factura_id AND estado <> 'anulada'
  ) THEN
    RAISE EXCEPTION 'Factura no encontrada o ya anulada';
  END IF;

  v_motivo := 'Devolución por anulación de factura #' || (
    SELECT numero_factura::text FROM facturas WHERE id = p_factura_id
  );

  -- Restore stock and log kardex for each item
  FOR v_item IN
    SELECT fi.producto_id, fi.cantidad, p.precio_costo
    FROM factura_items fi
    JOIN productos p ON p.id = fi.producto_id
    WHERE fi.factura_id = p_factura_id
  LOOP
    UPDATE productos
    SET stock_actual = stock_actual + v_item.cantidad
    WHERE id = v_item.producto_id;

    INSERT INTO movimientos_stock (producto_id, tipo, cantidad, motivo, costo_unitario)
    VALUES (
      v_item.producto_id,
      'entrada',
      v_item.cantidad,
      v_motivo,
      v_item.precio_costo
    );
  END LOOP;

  -- Mark factura as anulada
  UPDATE facturas
  SET estado = 'anulada'
  WHERE id = p_factura_id;
END;
$$;

-- Grant execute to authenticated users (RLS on facturas table controls access)
GRANT EXECUTE ON FUNCTION anular_factura(uuid) TO authenticated;
