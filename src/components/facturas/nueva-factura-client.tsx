"use client";

import { useMemo, useState } from "react";
import { BarcodeScanner } from "@/components/facturas/barcode-scanner";
import { createClient } from "@/lib/supabase/client";
import { TIPO_DESCUENTO } from "@/lib/constants";
import { useInvoiceCart, useInvoiceTotals } from "@/store/use-invoice-cart";
import { calcItemSubtotal } from "@/lib/invoice-calculations";

type ProductoLookup = {
  id: string;
  nombre: string;
  sku_code: string;
  precio_venta: number;
};

export function NuevaFacturaClient() {
  const supabase = useMemo(() => createClient(), []);
  const {
    items,
    addOrIncrementItem,
    updateItem,
    removeItem,
    descuentoGlobalTipo,
    descuentoGlobalValor,
    setDescuentoGlobalTipo,
    setDescuentoGlobalValor,
    clear,
    hasHydrated,
  } = useInvoiceCart();
  const totals = useInvoiceTotals();

  const [skuManual, setSkuManual] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [clienteNombre, setClienteNombre] = useState("Consumidor final");
  const [clienteIdentificacion, setClienteIdentificacion] = useState("N/A");
  const [clienteTelefono, setClienteTelefono] = useState("");
  const [clienteDireccion, setClienteDireccion] = useState("");

  const fetchProducto = async (skuCode: string) => {
    const normalizedSku = skuCode.trim();
    if (!normalizedSku) return;

    const { data, error: fetchError } = await supabase
      .from("productos")
      .select("id,nombre,sku_code,precio_venta")
      .eq("sku_code", normalizedSku)
      .eq("activo", true)
      .single();

    if (fetchError || !data) {
      setError("Producto no encontrado o inactivo.");
      return;
    }

    const producto = data as ProductoLookup;

    addOrIncrementItem({
      productoId: producto.id,
      nombre: producto.nombre,
      skuCode: producto.sku_code,
      precioUnitario: Number(producto.precio_venta),
    });

    setSkuManual("");
    setError(null);
    setSuccess(null);
  };

  const submitFactura = async () => {
    if (!items.length) return;

    setLoading(true);
    setError(null);
    setSuccess(null);

    const payload = {
      cliente: {
        nombre: clienteNombre.trim() || "Consumidor final",
        identificacion: clienteIdentificacion.trim() || "N/A",
        telefono: clienteTelefono.trim() || null,
        direccion: clienteDireccion.trim() || null,
      },
      items: items.map((item) => ({
        producto_id: item.productoId,
        cantidad: item.cantidad,
        descuento_item: item.descuentoItem,
        tipo_descuento_item: item.tipoDescuentoItem,
      })),
      descuento_global_tipo: descuentoGlobalTipo,
      descuento_global_valor: descuentoGlobalValor,
    };

    const { error: rpcError } = await supabase.rpc("confirmar_factura", {
      payload,
    });

    if (rpcError) {
      setLoading(false);
      setError(rpcError.message);
      return;
    }

    clear();
    setLoading(false);
    setSuccess("Factura creada y enviada a impresión.");
  };

  if (!hasHydrated) {
    return <p className="text-sm text-slate-600">Cargando carrito...</p>;
  }

  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Nueva factura</h1>
        <p className="text-sm text-slate-600">Escanea o ingresa SKU y ajusta descuentos por ítem y global.</p>
      </div>

      <BarcodeScanner onDetected={fetchProducto} />

      <div className="grid gap-2 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2">
        <input
          value={clienteNombre}
          onChange={(event) => setClienteNombre(event.target.value)}
          placeholder="Nombre cliente"
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        <input
          value={clienteIdentificacion}
          onChange={(event) => setClienteIdentificacion(event.target.value)}
          placeholder="Identificación"
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        <input
          value={clienteTelefono}
          onChange={(event) => setClienteTelefono(event.target.value)}
          placeholder="Teléfono (opcional)"
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        <input
          value={clienteDireccion}
          onChange={(event) => setClienteDireccion(event.target.value)}
          placeholder="Dirección (opcional)"
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex gap-2">
          <input
            value={skuManual}
            onChange={(event) => setSkuManual(event.target.value)}
            placeholder="SKU manual"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={() => fetchProducto(skuManual)}
            className="rounded-md bg-slate-900 px-3 py-2 text-sm text-white"
          >
            Añadir
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-3 py-2 text-left">Producto</th>
              <th className="px-3 py-2 text-left">Cantidad</th>
              <th className="px-3 py-2 text-left">Desc. tipo</th>
              <th className="px-3 py-2 text-left">Desc. valor</th>
              <th className="px-3 py-2 text-left">Precio</th>
              <th className="px-3 py-2 text-left">Subtotal ítem</th>
              <th className="px-3 py-2 text-left">Acción</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.productoId} className="border-t border-slate-100">
                <td className="px-3 py-2">{item.nombre}</td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    min={1}
                    value={item.cantidad}
                    onChange={(event) =>
                      updateItem(item.productoId, {
                        cantidad: Number(event.target.value),
                      })
                    }
                    className="w-20 rounded border border-slate-300 px-2 py-1"
                  />
                </td>
                <td className="px-3 py-2">
                  <select
                    value={item.tipoDescuentoItem}
                    onChange={(event) =>
                      updateItem(item.productoId, {
                        tipoDescuentoItem: event.target.value as "porcentaje" | "valor",
                      })
                    }
                    className="rounded border border-slate-300 px-2 py-1"
                  >
                    <option value={TIPO_DESCUENTO.VALOR}>Valor</option>
                    <option value={TIPO_DESCUENTO.PORCENTAJE}>%</option>
                  </select>
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    min={0}
                    value={item.descuentoItem}
                    onChange={(event) =>
                      updateItem(item.productoId, {
                        descuentoItem: Number(event.target.value),
                      })
                    }
                    className="w-24 rounded border border-slate-300 px-2 py-1"
                  />
                </td>
                <td className="px-3 py-2">${item.precioUnitario.toFixed(2)}</td>
                <td className="px-3 py-2">
                  ${
                    calcItemSubtotal({
                      productoId: item.productoId,
                      nombre: item.nombre,
                      skuCode: item.skuCode,
                      precioUnitario: item.precioUnitario,
                      cantidad: item.cantidad,
                      descuentoItem: item.descuentoItem,
                      tipoDescuentoItem: item.tipoDescuentoItem,
                    }).toFixed(2)
                  }
                </td>
                <td className="px-3 py-2">
                  <button
                    type="button"
                    onClick={() => removeItem(item.productoId)}
                    className="rounded bg-rose-100 px-2 py-1 text-rose-700"
                  >
                    Quitar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span>Tipo descuento global</span>
          <select
            value={descuentoGlobalTipo}
            onChange={(event) => setDescuentoGlobalTipo(event.target.value as "porcentaje" | "valor")}
            className="w-full rounded-md border border-slate-300 px-2 py-2"
          >
            <option value={TIPO_DESCUENTO.VALOR}>Valor</option>
            <option value={TIPO_DESCUENTO.PORCENTAJE}>Porcentaje</option>
          </select>
        </label>

        <label className="space-y-1 text-sm">
          <span>Descuento global</span>
          <input
            type="number"
            min={0}
            value={descuentoGlobalValor}
            onChange={(event) => setDescuentoGlobalValor(Number(event.target.value))}
            className="w-full rounded-md border border-slate-300 px-2 py-2"
          />
        </label>

        <div className="text-sm">
          <p>Subtotal: ${totals.subtotal.toFixed(2)}</p>
          <p>Descuento global: ${totals.descuentoTotal.toFixed(2)}</p>
          <p className="font-semibold">Total: ${totals.total.toFixed(2)}</p>
        </div>

        <button
          type="button"
          disabled={!items.length || loading}
          onClick={submitFactura}
          className="self-end rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {loading ? "Procesando..." : "Imprimir factura"}
        </button>
      </div>

      {success ? <p className="text-sm text-emerald-700">{success}</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </section>
  );
}
