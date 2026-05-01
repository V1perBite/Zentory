"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useInvoiceCart, useInvoiceTotals } from "@/store/use-invoice-cart";
import { calcItemSubtotal, formatCOP } from "@/lib/invoice-calculations";
import { TIPO_DESCUENTO } from "@/lib/constants";
import { SkuInput } from "@/components/ui/sku-input";
import { NumberField } from "@/components/ui/number-field";
import { ClienteAutocomplete } from "@/components/facturas/cliente-autocomplete";
import { Trash2, Printer, Save, ShoppingCart, Search, PackageSearch, Tag, ChevronDown } from "lucide-react";

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
    <div className="flex h-full flex-col gap-4">
      <div className="flex gap-2">
        <div className="flex-1">
          <SkuInput
            value={skuSearch}
            onChange={(v) => { setSkuSearch(v); setSearchQuery(v); }}
            onDetected={fetchProductoBySkuOrAdd}
            placeholder="Buscar o escanear SKU..."
            className="w-full shadow-sm"
          />
        </div>
        <button
          type="button"
          onClick={() => fetchProductoBySkuOrAdd(skuSearch)}
          className="flex items-center justify-center rounded-xl bg-indigo-600 px-4 text-sm font-bold text-white shadow-sm hover:bg-indigo-700 active:scale-95 transition-all"
        >
          Añadir
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-3">
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
            className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200 bg-white p-3 text-left shadow-sm transition-all hover:border-indigo-300 hover:shadow-md active:scale-95"
          >
            <div className="mb-2">
              <p className="line-clamp-2 text-xs font-bold leading-tight text-slate-900 group-hover:text-indigo-700">{p.nombre}</p>
              <div className="mt-1.5 flex items-center gap-1 text-[10px] font-medium text-slate-500">
                <Tag className="h-3 w-3" />
                <span className="truncate">{p.sku_code}</span>
              </div>
            </div>
            <div className="mt-auto border-t border-slate-100 pt-2">
              <p className="text-sm font-bold text-indigo-700">{formatCOP(Number(p.precio_venta))}</p>
              <p className={`mt-0.5 text-[10px] font-semibold uppercase tracking-wider ${p.stock_actual <= 0 ? "text-rose-600" : "text-emerald-600"}`}>
                Stock: {p.stock_actual}
              </p>
            </div>
          </button>
        ))}
        {filteredProductos.length === 0 ? (
          <div className="col-span-full py-12 text-center text-slate-400">
            <PackageSearch className="mx-auto h-12 w-12 mb-3 text-slate-300" />
            <p className="text-sm font-medium">Sin resultados</p>
          </div>
        ) : null}
      </div>
    </div>
  );

  const invoicePanel = (
    <div className="flex h-full flex-col gap-4">
      {success ? <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700 border border-emerald-100">{success}</p> : null}
      {error ? <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 border border-rose-100">{error}</p> : null}

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">Datos del cliente</p>
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

      <div className="flex-1 min-h-0 space-y-3 pb-32 lg:pb-0">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Carrito de Compra ({items.length})
          </p>
          {items.length > 0 && (
            <button
              type="button"
              onClick={clear}
              className="text-xs font-medium text-rose-600 underline hover:text-rose-700"
            >
              Vaciar
            </button>
          )}
        </div>

        {items.length > 0 ? (
          <div className="space-y-3">
            {items.map((item: any) => (
              <div key={item.productoId} className="relative rounded-2xl border border-slate-200 bg-white p-3 shadow-sm transition-all hover:border-slate-300">
                <div className="pr-8">
                  <h4 className="font-bold text-slate-900 leading-tight">{item.nombre}</h4>
                  <div className="mt-1 flex items-center gap-2 text-xs font-medium text-slate-500">
                    <Tag className="h-3 w-3" />
                    <span>{item.skuCode}</span>
                    <span className="text-slate-300">•</span>
                    <span>{formatCOP(item.precioUnitario)} c/u</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => removeItem(item.productoId)}
                  className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>

                <div className="mt-3 flex flex-wrap items-end justify-between gap-3 border-t border-slate-100 pt-3">
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-500 uppercase">Cant.</span>
                      <NumberField
                        value={item.cantidad}
                        min={1}
                        onChange={(v) => updateItem(item.productoId, { cantidad: v })}
                        className="w-16 rounded-xl border border-slate-300 px-2 py-1.5 text-center font-bold text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                      />
                    </label>

                    <div className="flex items-center gap-1 rounded-xl border border-slate-300 bg-white overflow-hidden focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500">
                      <div className="relative">
                        <select
                          value={item.tipoDescuentoItem}
                          onChange={(e) =>
                            updateItem(item.productoId, { tipoDescuentoItem: e.target.value as "porcentaje" | "valor" })
                          }
                          className="appearance-none bg-slate-50 border-r border-slate-300 py-1.5 pl-2 pr-6 text-xs font-semibold text-slate-700 outline-none cursor-pointer"
                        >
                          <option value={TIPO_DESCUENTO.VALOR}>$</option>
                          <option value={TIPO_DESCUENTO.PORCENTAJE}>%</option>
                        </select>
                        <ChevronDown className="absolute right-1.5 top-1/2 h-3 w-3 -translate-y-1/2 pointer-events-none text-slate-400" />
                      </div>
                      <NumberField
                        value={item.descuentoItem}
                        min={0}
                        onChange={(v) => updateItem(item.productoId, { descuentoItem: v })}
                        className="w-16 px-2 py-1.5 text-right font-bold text-slate-900 outline-none placeholder:font-normal"
                        placeholder="Desc."
                      />
                    </div>
                  </div>

                  <div className="text-right ml-auto">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Subtotal</p>
                    <p className="text-base font-bold text-indigo-700 leading-none mt-0.5">
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
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 py-12 px-4">
            <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-indigo-50 text-indigo-200">
              <ShoppingCart className="h-8 w-8" />
            </div>
            <p className="text-center text-sm font-medium text-slate-500">
              El carrito está vacío.<br />Agrega productos del catálogo o escanea.
            </p>
          </div>
        )}

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">Descuento Global</p>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <select
                value={descuentoGlobalTipo}
                onChange={(e) => setDescuentoGlobalTipo(e.target.value as "porcentaje" | "valor")}
                className="w-full appearance-none rounded-xl border border-slate-300 bg-white py-2 pl-3 pr-8 text-sm font-semibold text-slate-700 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 cursor-pointer"
              >
                <option value={TIPO_DESCUENTO.VALOR}>Valor $</option>
                <option value={TIPO_DESCUENTO.PORCENTAJE}>Porcentaje %</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 pointer-events-none text-slate-400" />
            </div>
            <NumberField
              value={descuentoGlobalValor}
              min={0}
              onChange={setDescuentoGlobalValor}
              className="w-1/2 rounded-xl border border-slate-300 px-3 py-2 text-right font-bold text-slate-900 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>
      </div>

      {/* FIXED FOOTER (Mobile Sticky / Desktop Normal) */}
      <div className="fixed bottom-0 left-0 right-0 z-40 lg:relative lg:z-auto bg-white border-t border-slate-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] lg:shadow-sm lg:border lg:rounded-2xl p-4 flex flex-col gap-3">
        <div className="flex justify-between items-end">
          <div>
            <div className="flex items-center gap-2 text-sm text-slate-500 font-medium mb-0.5">
              <span>Subtotal:</span>
              <span>{formatCOP(totals.subtotal)}</span>
            </div>
            {totals.descuentoTotal > 0 && (
              <div className="flex items-center gap-2 text-sm text-rose-500 font-medium mb-0.5">
                <span>Descuento:</span>
                <span>-{formatCOP(totals.descuentoTotal)}</span>
              </div>
            )}
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mt-1">Total a cobrar</p>
          </div>
          <div className="text-right">
            <span className="text-3xl font-black tracking-tight text-indigo-700">{formatCOP(totals.total)}</span>
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            disabled={!items.length || loading}
            onClick={() => submitFactura(true)}
            className="flex h-14 flex-[0.7] items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white font-bold text-slate-700 shadow-sm disabled:opacity-50 active:bg-slate-50"
          >
            <Save className="h-5 w-5" />
            <span className="hidden sm:inline">Guardar</span>
          </button>
          <button
            type="button"
            disabled={!items.length || loading}
            onClick={() => submitFactura(false)}
            className="flex h-14 flex-1 items-center justify-center gap-2 rounded-xl bg-indigo-600 font-bold text-white shadow-sm disabled:opacity-50 hover:bg-indigo-700 active:scale-[0.98] transition-transform"
          >
            <Printer className="h-5 w-5" />
            <span>{loading ? "Cobrando..." : "COBRAR E IMPRIMIR"}</span>
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col lg:flex-row lg:gap-6">
      {/* Desktop: Catálogo Izquierda */}
      <div className="hidden lg:flex lg:w-[55%] flex-col bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
        <div className="mb-5 flex items-center gap-3 border-b border-slate-100 pb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
            <PackageSearch className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900">Catálogo de productos</h1>
            <p className="text-xs font-medium text-slate-500">Busca o escanea SKU para agregar al carrito</p>
          </div>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto pr-2 custom-scrollbar">
          {catalogGrid}
        </div>
      </div>

      {/* Desktop & Mobile: Carrito (Derecha o Full) */}
      <div className="flex-1 flex flex-col min-h-0 lg:w-[45%]">
        <div className="lg:hidden mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-black text-slate-900">Nueva Venta</h1>
            <p className="text-xs font-medium text-slate-500">Punto de pago</p>
          </div>
        </div>
        {invoicePanel}
      </div>

      {/* FAB Mobile Catalog */}
      <button
        type="button"
        onClick={() => setShowCatalogModal(true)}
        className="fixed bottom-[110px] right-4 z-50 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-xl lg:hidden active:scale-95 transition-transform"
        aria-label="Ver catálogo"
      >
        <PackageSearch className="h-6 w-6" />
      </button>

      {/* Modal Mobile Catalog */}
      {showCatalogModal ? (
        <div className="fixed inset-0 z-50 flex flex-col bg-slate-50 lg:hidden">
          <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-4 shadow-sm">
            <div className="flex items-center gap-2">
              <PackageSearch className="h-5 w-5 text-indigo-600" />
              <h2 className="font-bold text-slate-900 text-lg">Catálogo</h2>
            </div>
            <button
              type="button"
              onClick={() => setShowCatalogModal(false)}
              className="flex h-8 items-center rounded-lg border border-slate-300 bg-white px-3 text-xs font-bold text-slate-700 shadow-sm active:bg-slate-100"
            >
              Cerrar
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">{catalogGrid}</div>
        </div>
      ) : null}
    </div>
  );
}
