-- ============================================================
-- 20260924_011_anulacion_auditoria.sql
--
-- Propósito:
--   1. Añade columnas de auditoría a facturas:
--        fecha_anulacion, usuario_anulacion_id.
--   2. Trigger BEFORE UPDATE OR DELETE que impide modificar
--      o borrar físicamente cualquier factura ya anulada.
--   3. Ajusta la política RLS para que los vendedores no lean
--      facturas anuladas (solo admin).
--   4. Reemplaza anular_factura(uuid, text) con una versión
--      reforzada que:
--        · Valida rol admin.
--        · Valida motivo en el servidor (trim ≥ 10 chars).
--        · Usa FOR UPDATE sobre la fila de la factura para
--          serializar accesos concurrentes (evita race condition).
--        · Ordena el loop por producto_id para que dos
--          transacciones concurrentes bloqueen los productos
--          en el mismo orden y no generen deadlocks.
--        · Obtiene el costo_unitario del movimiento de salida
--          original con DISTINCT ON para reutilizar el costo
--          histórico (no el precio_costo actual del producto).
--        · Graba fecha_anulacion y usuario_anulacion_id.
-- ============================================================


-- ── 1. Nuevas columnas de auditoría ──────────────────────────
-- razon_anulacion ya existe desde la migración 010.
ALTER TABLE public.facturas
  ADD COLUMN IF NOT EXISTS fecha_anulacion      timestamptz,
  ADD COLUMN IF NOT EXISTS usuario_anulacion_id uuid
    REFERENCES public.usuarios(id);

CREATE INDEX IF NOT EXISTS idx_facturas_anuladas_fecha
  ON public.facturas(fecha_anulacion DESC)
  WHERE estado = 'anulada';


-- ── 2. Trigger: bloquea UPDATE y DELETE en facturas anuladas ──
-- No lleva SECURITY DEFINER porque no necesita elevar privilegios;
-- solo debe rechazar la operación o propagarla.
-- Para UPDATE evalúa OLD.estado (estado ANTES del cambio),
-- por lo que el UPDATE dentro de anular_factura pasa correctamente
-- (en ese momento OLD.estado aún no es 'anulada').
-- Para DELETE evalúa OLD directamente y retorna OLD al bloquear.
CREATE OR REPLACE FUNCTION public.bloquear_modificacion_anulada()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.estado = 'anulada' THEN
      RAISE EXCEPTION
        'No se puede eliminar una factura anulada (id: %)', OLD.id;
    END IF;
    RETURN OLD;
  END IF;

  -- TG_OP = 'UPDATE'
  IF OLD.estado = 'anulada' THEN
    RAISE EXCEPTION
      'No se puede modificar una factura ya anulada (id: %)', OLD.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bloquear_modificacion_anulada ON public.facturas;
CREATE TRIGGER trg_bloquear_modificacion_anulada
  BEFORE UPDATE OR DELETE ON public.facturas
  FOR EACH ROW
  EXECUTE FUNCTION public.bloquear_modificacion_anulada();


-- ── 3. RLS: solo admin puede leer facturas anuladas ──────────
DROP POLICY IF EXISTS facturas_select_role ON public.facturas;
CREATE POLICY facturas_select_role ON public.facturas
  FOR SELECT USING (
    public.is_admin()
    OR (vendedor_id = auth.uid() AND estado <> 'anulada')
  );

-- La política de UPDATE existente ya limita los campos; el trigger
-- agrega la protección de integridad sobre el estado.
-- Actualizamos el WITH CHECK para permitir 'anulada' como estado
-- resultante (el RPC SECURITY DEFINER lo escribe directamente,
-- pero la política se evalúa de todas formas en algunas versiones).
DROP POLICY IF EXISTS facturas_update_only_admin_print ON public.facturas;
CREATE POLICY facturas_update_only_admin_print ON public.facturas
  FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());


-- ── 4. RPC anular_factura ─────────────────────────────────────
-- DROP primero; esto elimina también todos los ACLs existentes.
-- El REVOKE + GRANT al final del bloque es lo único necesario.
DROP FUNCTION IF EXISTS public.anular_factura(uuid, text);

CREATE OR REPLACE FUNCTION public.anular_factura(
  p_factura_id uuid,
  p_razon      text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item       RECORD;
  v_factura    RECORD;
  v_motivo     TEXT;
  v_user_id    uuid := auth.uid();
  v_razon_trim TEXT := trim(p_razon);
BEGIN
  -- ── Validar rol admin ──────────────────────────────────────
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Solo un administrador puede anular facturas';
  END IF;

  -- ── Validar motivo en el servidor ─────────────────────────
  -- El cliente también valida, pero esta es la barrera definitiva.
  IF v_razon_trim IS NULL OR length(v_razon_trim) < 10 THEN
    RAISE EXCEPTION
      'El motivo de anulación debe tener al menos 10 caracteres';
  END IF;

  -- ── FOR UPDATE: serializa accesos concurrentes ────────────
  -- Si dos admins intentan anular la misma factura al mismo tiempo,
  -- el segundo queda en espera hasta que el primero confirme.
  -- La verificación de estado a continuación detecta la doble anulación.
  SELECT id, numero_factura, estado
  INTO v_factura
  FROM public.facturas
  WHERE id = p_factura_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Factura no encontrada';
  END IF;

  IF v_factura.estado = 'anulada' THEN
    RAISE EXCEPTION 'La factura ya se encuentra anulada';
  END IF;

  v_motivo := 'Devolución por anulación de factura #'
              || v_factura.numero_factura::text;

  -- ── Revertir stock ────────────────────────────────────────
  -- DISTINCT ON (fi.producto_id): si por algún motivo existieran
  -- varios movimientos de salida del mismo producto en la misma
  -- factura, tomamos solo el más reciente.
  -- ORDER BY fi.producto_id: dos transacciones concurrentes que
  -- anulen facturas con productos comunes siempre adquieren los
  -- locks de producto en el mismo orden, eliminando el riesgo de
  -- deadlock.
  FOR v_item IN
    SELECT DISTINCT ON (fi.producto_id)
      fi.producto_id,
      fi.cantidad,
      ms.costo_unitario        -- costo histórico al momento de la venta
    FROM public.items_factura fi
    LEFT JOIN public.movimientos_stock ms
      ON  ms.factura_id  = fi.factura_id
      AND ms.producto_id = fi.producto_id
      AND ms.tipo        = 'salida'
    WHERE fi.factura_id = p_factura_id
    ORDER BY fi.producto_id, ms.created_at DESC
  LOOP
    UPDATE public.productos
    SET stock_actual = stock_actual + v_item.cantidad
    WHERE id = v_item.producto_id;

    INSERT INTO public.movimientos_stock (
      producto_id, tipo, cantidad, motivo,
      factura_id, usuario_id, costo_unitario
    ) VALUES (
      v_item.producto_id,
      'entrada',
      v_item.cantidad,
      v_motivo,
      p_factura_id,
      v_user_id,
      v_item.costo_unitario    -- preserva el costo histórico
    );
  END LOOP;

  -- ── Marcar como anulada con auditoría completa ────────────
  -- En este punto OLD.estado (evaluado por el trigger) aún es el
  -- estado previo (no 'anulada'), por lo que el trigger permite
  -- este UPDATE. Un segundo intento habría sido rechazado arriba
  -- por la verificación explícita del estado + el FOR UPDATE.
  UPDATE public.facturas
  SET
    estado               = 'anulada',
    razon_anulacion      = v_razon_trim,
    fecha_anulacion      = now(),
    usuario_anulacion_id = v_user_id
  WHERE id = p_factura_id;
END;
$$;

-- Permisos estrictos: solo 'authenticated' puede invocar la función.
-- 'anon' y PUBLIC quedan sin acceso.
REVOKE ALL ON FUNCTION public.anular_factura(uuid, text)
  FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.anular_factura(uuid, text)
  TO authenticated;
