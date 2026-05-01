"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useInvoiceCart, useInvoiceTotals } from "@/store/use-invoice-cart";
import { calcItemSubtotal, formatCOP } from "@/lib/invoice-calculations";
import { TIPO_DESCUENTO } from "@/lib/constants";
import { SkuInput } from "@/components/ui/sku-input";
import { NumberField } from "@/components/ui/number-field";
import { ClienteAutocomplete } from "@/components/facturas/cliente-autocomplete";

type ProductoCatalog = {
  id: string;
  nombre: string;
  sku_code: string;
  precio_venta: number;
  stock_actual: number;
};

type NuevaFacturaClientProps = {
  productos: ProductoCatalog[];
};

export function NuevaFacturaClient({ productos }: NuevaFacturaClientProps) {
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

  const [searchQuery, setSearchQuery] = useState("");
  const [skuSearch, setSkuSearch] = useState("");
  const [showCatalogModal, setShowCatalogModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [clienteId, setClienteId] = useState<string | null>(null);
  const [clienteNombre, setClienteNombre] = useState("Consumidor final");
  const [clienteIdentificacion, setClienteIdentificacion] = useState("22222");
  const [clienteNit, setClienteNit] = useState("");
  const [clienteEmail, setClienteEmail] = useState("");
  const [clienteTelefono, setClienteTelefono] = useState("");
  const [clienteDireccion, setClienteDireccion] = useState("");

  const filteredProductos = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return productos;
    return productos.filter(
      (p) => p.nombre.toLowerCase().includes(q) || p.sku_code.toLowerCase().includes(q),
    );
  }, [productos, searchQuery]);

  const fetchProductoBySkuOrAdd = async (skuCode: string) => {
    const normalized = skuCode.trim();
    if (!normalized) return;

    const local = productos.find((p) => p.sku_code.toLowerCase() === normalized.toLowerCase());
    if (local) {
      addOrIncrementItem({
        productoId: local.id,
        nombre: local.nombre,
        skuCode: local.sku_code,
        precioUnitario: Number(local.precio_venta),
      });
      setSkuSearch("");
      return;
    }

    const { data, error: fetchError } = await supabase
      .from("productos")
      .select("id,nombre,sku_code,precio_venta")
      .eq("sku_code", normalized)
      .eq("activo", true)
      .single();

    if (fetchError || !data) {
      setError("Producto no encontrado.");
      return;
    }

    addOrIncrementItem({
      productoId: data.id,
      nombre: data.nombre,
      skuCode: data.sku_code,
      precioUnitario: Number(data.precio_venta),
    });
    setSkuSearch("");
    setError(null);
  };

  const handleSelectCliente = (c: {
    id: string;
    nombre: string;
    identificacion: string;
    nit: string | null;
    email: string | null;
    telefono: string | null;
    direccion: string | null;
  }) => {
    setClienteId(c.id);
    setClienteNombre(c.nombre);
    setClienteIdentificacion(c.identificacion);
    setClienteNit(c.nit ?? "");
    setClienteEmail(c.email ?? "");
    setClienteTelefono(c.telefono ?? "");
    setClienteDireccion(c.direccion ?? "");
  };

  const submitFactura = async (guardarSinImprimir: boolean) => {
    if (!items.length) {
      setError("Debes agregar al menos un producto.");
      return;
    }
    if (!clienteNombre.trim() || !clienteIdentificacion.trim()) {
      setError("Nombre e identificación del cliente son obligatorios.");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    const payload: Record<string, unknown> = {
      items: items.map((item: any) => ({
        producto_id: item.productoId,
        cantidad: item.cantidad,
        descuento_item: item.descuentoItem,
        tipo_descuento_item: item.tipoDescuentoItem,
      })),
      descuento_global_tipo: descuentoGlobalTipo,
      descuento_global_valor: descuentoGlobalValor,
      guardar_sin_imprimir: guardarSinImprimir,
    };

    if (clienteId) {
      payload.cliente_id = clienteId;
    } else {
      payload.cliente = {
        nombre: clienteNombre.trim() || "Consumidor final",
        identificacion: clienteIdentificacion.trim() || "22222",
        nit: clienteNit.trim() || null,
        email: clienteEmail.trim() || null,
        telefono: clienteTelefono.trim() || null,
        direccion: clienteDireccion.trim() || null,
      };
    }

    const { data, error: rpcError } = await supabase.rpc("confirmar_factura", { payload });

    if (rpcError) {
      setLoading(false);
      setError(rpcError.message);
      return;
    }

    const result = data as { id: string; numero_factura: number };
    clear();
    setClienteId(null);
    setClienteNombre("Consumidor final");
    setClienteIdentificacion("22222");
    setClienteNit("");
    setClienteEmail("");
    setClienteTelefono("");
    setClienteDireccion("");
    setLoading(false);
    setSuccess(
      guardarSinImprimir
        ? `Factura #${result.numero_factura} guardada correctamente.`
        : `Factura #${result.numero_factura} enviada a impresión.`,
    );
  };

  if (!hasHydrated) {
    return <p className="text-sm text-slate-600">Cargando...</p>;
  }

  const catalogGrid = (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <div className="flex-1">
          <SkuInput
            value={skuSearch}
            onChange={(v) => { setSkuSearch(v); setSearchQuery(v); }}
            onDetected={fetchProductoBySkuOrAdd}
            placeholder="Buscar por nombre o SKU..."
          />
        </div>
        <button
          type="button"
          onClick={() => fetchProductoBySkuOrAdd(skuSearch)}
          className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          Añadir
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {filteredProductos.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() =>
              addOrIncrementItem({
                productoId: p.id,
                nombre: p.nombre,
                skuCode: p.sku_code,
                precioUnitario: Number(p.precio_venta),
              })
            }
            className="rounded-lg border border-slate-200 bg-white p-2 text-left transition hover:border-emerald-400 hover:shadow-sm active:scale-95"
          >
            <p className="truncate text-xs font-semibold text-slate-900">{p.nombre}</p>
            <p className="mt-0.5 truncate text-[10px] text-slate-500">{p.sku_code}</p>
            <p className="mt-1 text-xs font-medium text-emerald-700">{formatCOP(Number(p.precio_venta))}</p>
            <p className={`text-[10px] ${p.stock_actual <= 0 ? "text-rose-600" : "text-slate-400"}`}>
              Stock: {p.stock_actual}
            </p>
          </button>
        ))}
        {filteredProductos.length === 0 ? (
          <p className="col-span-full py-6 text-center text-sm text-slate-400">Sin resultados.</p>
        ) : null}
      </div>
    </div>
  );

  const invoicePanel = (
    <div className="flex flex-col gap-3">
      <h2 className="text-base font-semibold text-slate-900">Factura Actual</h2>

      {success ? <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</p> : null}
      {error ? <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}

      <div className="rounded-xl border border-slate-200 bg-white p-3">
        <p className="mb-2 text-xs font-medium text-slate-700">Datos del cliente</p>
        <ClienteAutocomplete
          onSelect={handleSelectCliente}
          nombre={clienteNombre}
          onNombreChange={(v) => { setClienteNombre(v); setClienteId(null); }}
          identificacion={clienteIdentificacion}
          onIdentificacionChange={(v) => { setClienteIdentificacion(v); setClienteId(null); }}
          nit={clienteNit}
          onNitChange={setClienteNit}
          email={clienteEmail}
          onEmailChange={setClienteEmail}
          telefono={clienteTelefono}
          onTelefonoChange={setClienteTelefono}
          direccion={clienteDireccion}
          onDireccionChange={setClienteDireccion}
        />
      </div>

      {items.length > 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white">
          <table className="min-w-full text-xs">
            <thead className="bg-slate-50 text-left">
              <tr>
                <th className="px-2 py-1.5">Producto</th>
                <th className="px-2 py-1.5 text-right">Cant.</th>
                <th className="px-2 py-1.5 text-right">Desc.</th>
                <th className="px-2 py-1.5 text-right">Subtotal</th>
                <th className="px-2 py-1.5"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item: any) => (
                <tr key={item.productoId} className="border-t border-slate-100">
                  <td className="px-2 py-1.5">
                    <p className="max-w-[100px] truncate font-medium">{item.nombre}</p>
                    <p className="text-slate-400">{formatCOP(item.precioUnitario)}</p>
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    <NumberField
                      value={item.cantidad}
                      min={1}
                      onChange={(v) => updateItem(item.productoId, { cantidad: v })}
                      className="w-12 rounded border border-slate-300 px-1 py-0.5 text-right text-xs"
                    />
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <select
                        value={item.tipoDescuentoItem}
                        onChange={(e) =>
                          updateItem(item.productoId, { tipoDescuentoItem: e.target.value as "porcentaje" | "valor" })
                        }
                        className="rounded border border-slate-300 px-1 py-0.5 text-xs"
                      >
                        <option value={TIPO_DESCUENTO.VALOR}>$</option>
                        <option value={TIPO_DESCUENTO.PORCENTAJE}>%</option>
                      </select>
                      <NumberField
                        value={item.descuentoItem}
                        min={0}
                        onChange={(v) => updateItem(item.productoId, { descuentoItem: v })}
                        className="w-14 rounded border border-slate-300 px-1 py-0.5 text-right text-xs"
                      />
                    </div>
                  </td>
                  <td className="px-2 py-1.5 text-right font-medium">
                    {formatCOP(
                      calcItemSubtotal({
                        productoId: item.productoId,
                        nombre: item.nombre,
                        skuCode: item.skuCode,
                        precioUnitario: item.precioUnitario,
                        cantidad: item.cantidad,
                        descuentoItem: item.descuentoItem,
                        tipoDescuentoItem: item.tipoDescuentoItem,
                      }),
                    )}
                  </td>
                  <td className="px-2 py-1.5">
                    <button
                      type="button"
                      onClick={() => removeItem(item.productoId)}
                      className="rounded bg-rose-100 px-1.5 py-0.5 text-[10px] text-rose-700"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-slate-300 py-6 text-center text-sm text-slate-400">
          Sin productos. Haz clic en una tarjeta o escanea un código.
        </p>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-3">
        <p className="mb-2 text-xs font-medium text-slate-700">Descuento global</p>
        <div className="flex gap-2">
          <select
            value={descuentoGlobalTipo}
            onChange={(e) => setDescuentoGlobalTipo(e.target.value as "porcentaje" | "valor")}
            className="rounded border border-slate-300 px-2 py-1.5 text-sm"
          >
            <option value={TIPO_DESCUENTO.VALOR}>Valor $</option>
            <option value={TIPO_DESCUENTO.PORCENTAJE}>Porcentaje %</option>
          </select>
          <NumberField
            value={descuentoGlobalValor}
            min={0}
            onChange={setDescuentoGlobalValor}
            className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
          />
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm">
        <div className="flex justify-between">
          <span className="text-slate-600">Subtotal</span>
          <span>{formatCOP(totals.subtotal)}</span>
        </div>
        {totals.descuentoTotal > 0 ? (
          <div className="flex justify-between text-rose-600">
            <span>Descuento</span>
            <span>-{formatCOP(totals.descuentoTotal)}</span>
          </div>
        ) : null}
        <div className="mt-1 flex justify-between border-t border-slate-200 pt-1 font-bold">
          <span>Total</span>
          <span>{formatCOP(totals.total)}</span>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          disabled={!items.length || loading}
          onClick={() => submitFactura(true)}
          className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 disabled:opacity-60 hover:bg-slate-50"
        >
          {loading ? "..." : "Guardar"}
        </button>
        <button
          type="button"
          disabled={!items.length || loading}
          onClick={() => submitFactura(false)}
          className="flex-1 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60 hover:bg-slate-800"
        >
          {loading ? "Procesando..." : "Guardar e imprimir"}
        </button>
      </div>
    </div>
  );

  return (
    <>
      <div className="mb-4">
        <h1 className="text-2xl font-bold">Nueva factura</h1>
        <p className="text-sm text-slate-600">Selecciona productos del catálogo o escanea el código.</p>
      </div>

      {/* Desktop: 2 columns */}
      <div className="hidden lg:grid lg:grid-cols-[1fr_400px] lg:gap-4">
        <div className="min-h-0 overflow-y-auto">{catalogGrid}</div>
        <div className="sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-4">
          {invoicePanel}
        </div>
      </div>

      {/* Mobile: stack + FAB */}
      <div className="lg:hidden space-y-4">
        {invoicePanel}
      </div>

      {/* FAB mobile */}
      <button
        type="button"
        onClick={() => setShowCatalogModal(true)}
        className="fixed bottom-6 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-600 text-2xl text-white shadow-lg lg:hidden"
        aria-label="Ver catálogo de productos"
      >
        🏪
      </button>

      {/* Catalog modal (mobile) */}
      {showCatalogModal ? (
        <div className="fixed inset-0 z-50 flex flex-col bg-white lg:hidden">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <h2 className="font-semibold">Catálogo de productos</h2>
            <button
              type="button"
              onClick={() => setShowCatalogModal(false)}
              className="rounded-md border border-slate-300 px-2 py-1 text-xs"
            >
              Cerrar ✕
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">{catalogGrid}</div>
        </div>
      ) : null}
    </>
  );
}
