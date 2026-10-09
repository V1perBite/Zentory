"use client";

import { useMemo, useState, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useInvoiceCart, useInvoiceTotals } from "@/store/use-invoice-cart";
import { calcItemSubtotal, formatCOP } from "@/lib/invoice-calculations";
import { TIPO_DESCUENTO } from "@/lib/constants";
import { SkuInput } from "@/components/ui/sku-input";
import { NumberField } from "@/components/ui/number-field";
import { ClienteAutocomplete } from "@/components/facturas/cliente-autocomplete";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Trash2, Printer, Save, ShoppingCart, PackageSearch, Tag, ChevronDown } from "lucide-react";
import Link from "next/link";
import { isAdminRole } from "@/lib/permissions";

type ProductoCatalog = {
  id: string;
  nombre: string;
  sku_code: string;
  precio_venta: number;
  stock_actual: number;
};

type NuevaFacturaClientProps = {
  productos: ProductoCatalog[];
  rol: string;
};

export function NuevaFacturaClient({ productos, rol }: NuevaFacturaClientProps) {
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
  const [ultimaFactura, setUltimaFactura] = useState<{
    id: string;
    numero: number;
    aImpresion: boolean;
  } | null>(null);

  type FlyParticle = { id: number; x: number; y: number; label: string };
  const [flyParticles, setFlyParticles] = useState<FlyParticle[]>([]);
  const flyCounter = useRef(0);

  const triggerFlyAnimation = useCallback((e: React.MouseEvent, label: string) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const startX = rect.left + rect.width / 2;
    const startY = rect.top + rect.height / 2;
    const id = ++flyCounter.current;
    setFlyParticles((prev) => [...prev, { id, x: startX, y: startY, label }]);
    setTimeout(() => {
      setFlyParticles((prev) => prev.filter((p) => p.id !== id));
    }, 700);
  }, []);

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
    setUltimaFactura(null);

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

    const result = data as { id: string; numero_factura: number } | null;
    if (!result?.id || !result.numero_factura) {
      setLoading(false);
      setError("La factura no se confirmó: el servidor no devolvió el número de factura.");
      return;
    }

    clear();
    setClienteId(null);
    setClienteNombre("Consumidor final");
    setClienteIdentificacion("22222");
    setClienteNit("");
    setClienteEmail("");
    setClienteTelefono("");
    setClienteDireccion("");
    setLoading(false);
    setUltimaFactura({
      id: result.id,
      numero: result.numero_factura,
      aImpresion: !guardarSinImprimir,
    });
    setSuccess(
      guardarSinImprimir
        ? `Factura #${result.numero_factura} guardada correctamente.`
        : `Factura #${result.numero_factura} enviada a impresión.`,
    );
  };

  if (!hasHydrated) {
    return (
      <div className="space-y-4">
        <PageHeader title="Nueva venta" subtitle="Punto de pago" />
        <div className="flex flex-col gap-6 lg:flex-row">
          <div className="hidden flex-1 flex-col gap-3 lg:flex">
            <Skeleton className="h-10 w-56" />
            <div className="grid grid-cols-3 gap-3">
              {Array.from({ length: 9 }).map((_, i) => (
                <Skeleton key={i} className="h-28 rounded-2xl" />
              ))}
            </div>
          </div>
          <div className="flex flex-1 flex-col gap-4">
            <Skeleton className="h-40 rounded-2xl" />
            <Skeleton className="h-64 rounded-2xl" />
            <Skeleton className="h-32 rounded-2xl" />
          </div>
        </div>
      </div>
    );
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
        <Button
          type="button"
          onClick={() => fetchProductoBySkuOrAdd(skuSearch)}
          className="rounded-xl px-4 font-bold"
        >
          Añadir
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-3">
        {filteredProductos.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={(e) => {
              triggerFlyAnimation(e, p.nombre);
              addOrIncrementItem({
                productoId: p.id,
                nombre: p.nombre,
                skuCode: p.sku_code,
                precioUnitario: Number(p.precio_venta),
              });
            }}
            className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-border bg-card p-3 text-left shadow-soft transition-all hover:border-primary/40 hover:shadow-lift active:scale-95"
          >
            <div className="mb-2">
              <p className="line-clamp-2 text-xs font-bold leading-tight text-foreground group-hover:text-primary">{p.nombre}</p>
              <div className="mt-1.5 flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
                <Tag className="h-3 w-3" />
                <span className="truncate">{p.sku_code}</span>
              </div>
            </div>
            <div className="mt-auto border-t border-border/60 pt-2">
              <p className="text-sm font-bold text-primary">{formatCOP(Number(p.precio_venta))}</p>
              <p className={`mt-0.5 text-[10px] font-semibold uppercase tracking-wider ${p.stock_actual <= 0 ? "text-rose-600" : "text-emerald-600"}`}>
                Stock: {p.stock_actual}
              </p>
            </div>
          </button>
        ))}
        {filteredProductos.length === 0 ? (
          <div className="col-span-full py-12 text-center text-muted-foreground/70">
            <PackageSearch className="mx-auto h-12 w-12 mb-3 text-muted-foreground/50" />
            <p className="text-sm font-medium">Sin resultados</p>
          </div>
        ) : null}
      </div>
    </div>
  );

  const invoicePanel = (
    <div className="flex flex-col gap-4 lg:h-full">
      {success ? (
        <div
          role="status"
          className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800"
        >
          <p>{success}</p>
          {ultimaFactura ? (
            <div className="mt-2 flex flex-wrap gap-4 text-xs font-semibold">
              <Link
                href={`/historial/${ultimaFactura.id}`}
                className="underline underline-offset-2 hover:text-emerald-900"
              >
                Ver factura #{ultimaFactura.numero}
              </Link>
              {ultimaFactura.aImpresion && isAdminRole(rol) ? (
                <Link
                  href="/imprimir"
                  className="underline underline-offset-2 hover:text-emerald-900"
                >
                  Ir al centro de impresión
                </Link>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
      {error ? (
        <p
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700"
        >
          {error}
        </p>
      ) : null}

      <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
        <p className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Datos del cliente</p>
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

      <div className="space-y-3 pb-48 lg:flex-1 lg:min-h-0 lg:overflow-y-auto lg:pb-0">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
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
              <div key={item.productoId} className="relative rounded-2xl border border-border bg-card p-3 shadow-soft transition-all hover:border-input">
                <div className="pr-8">
                  <h4 className="font-bold text-foreground leading-tight">{item.nombre}</h4>
                  <div className="mt-1 flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    <Tag className="h-3 w-3" />
                    <span>{item.skuCode}</span>
                    <span className="text-muted-foreground/50">•</span>
                    <span>{formatCOP(item.precioUnitario)} c/u</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => removeItem(item.productoId)}
                  className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground/70 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>

                <div className="mt-3 flex flex-wrap items-end justify-between gap-3 border-t border-border/60 pt-3">
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-muted-foreground uppercase">Cant.</span>
                      <NumberField
                        value={item.cantidad}
                        min={1}
                        onChange={(v) => updateItem(item.productoId, { cantidad: v })}
                        className="w-16 rounded-xl border border-input px-2 py-1.5 text-center font-bold text-foreground focus:border-ring focus:ring-1 focus:ring-ring outline-none"
                      />
                    </label>

                    <div className="flex items-center gap-1 rounded-xl border border-input bg-card overflow-hidden focus-within:border-ring focus-within:ring-1 focus-within:ring-ring">
                      <div className="relative">
                        <select
                          value={item.tipoDescuentoItem}
                          onChange={(e) =>
                            updateItem(item.productoId, { tipoDescuentoItem: e.target.value as "porcentaje" | "valor" })
                          }
                          className="appearance-none bg-accent/60 border-r border-input py-1.5 pl-2 pr-6 text-xs font-semibold text-foreground outline-none cursor-pointer"
                        >
                          <option value={TIPO_DESCUENTO.VALOR}>$</option>
                          <option value={TIPO_DESCUENTO.PORCENTAJE}>%</option>
                        </select>
                        <ChevronDown className="absolute right-1.5 top-1/2 h-3 w-3 -translate-y-1/2 pointer-events-none text-muted-foreground/70" />
                      </div>
                      <NumberField
                        value={item.descuentoItem}
                        min={0}
                        onChange={(v) => updateItem(item.productoId, { descuentoItem: v })}
                        className="w-16 px-2 py-1.5 text-right font-bold text-foreground outline-none placeholder:font-normal"
                        placeholder="Desc."
                      />
                    </div>
                  </div>

                  <div className="text-right ml-auto">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Subtotal</p>
                    <p className="text-base font-bold text-primary leading-none mt-0.5">
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
          <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-accent/40 py-12 px-4">
            <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary/30">
              <ShoppingCart className="h-8 w-8" />
            </div>
            <p className="text-center text-sm font-medium text-muted-foreground">
              El carrito está vacío.<br />Agrega productos del catálogo o escanea.
            </p>
          </div>
        )}

        <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
          <p className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Descuento Global</p>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <select
                value={descuentoGlobalTipo}
                onChange={(e) => setDescuentoGlobalTipo(e.target.value as "porcentaje" | "valor")}
                className="w-full appearance-none rounded-xl border border-input bg-card py-2 pl-3 pr-8 text-sm font-semibold text-foreground outline-none focus:border-ring focus:ring-1 focus:ring-ring cursor-pointer"
              >
                <option value={TIPO_DESCUENTO.VALOR}>Valor $</option>
                <option value={TIPO_DESCUENTO.PORCENTAJE}>Porcentaje %</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 pointer-events-none text-muted-foreground/70" />
            </div>
            <NumberField
              value={descuentoGlobalValor}
              min={0}
              onChange={setDescuentoGlobalValor}
              className="w-1/2 rounded-xl border border-input px-3 py-2 text-right font-bold text-foreground outline-none focus:border-ring focus:ring-1 focus:ring-ring"
            />
          </div>
        </div>
      </div>

      {/* FIXED FOOTER (Mobile Sticky / Desktop Normal) */}
      <div className="fixed bottom-0 left-0 right-0 z-40 lg:relative lg:z-auto bg-card border-t border-border shadow-[0_-4px_6px_-1px_rgba(15,23,42,0.06)] lg:shadow-sm lg:border lg:rounded-2xl p-4 flex flex-col gap-3">
        <div className="flex justify-between items-end">
          <div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground font-medium mb-0.5">
              <span>Subtotal:</span>
              <span>{formatCOP(totals.subtotal)}</span>
            </div>
            {totals.descuentoTotal > 0 && (
              <div className="flex items-center gap-2 text-sm text-rose-500 font-medium mb-0.5">
                <span>Descuento:</span>
                <span>-{formatCOP(totals.descuentoTotal)}</span>
              </div>
            )}
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mt-1">Total a cobrar</p>
          </div>
          <div className="text-right">
            <span className="text-3xl font-black tracking-tight text-primary">{formatCOP(totals.total)}</span>
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <Button
            type="button"
            variant="outline"
            disabled={!items.length || loading}
            onClick={() => submitFactura(true)}
            className="h-14 flex-[0.7] rounded-xl font-bold shadow-soft"
          >
            <Save className="mr-2 h-5 w-5" />
            <span className="hidden sm:inline">Guardar</span>
          </Button>
          <Button
            type="button"
            disabled={!items.length || loading}
            onClick={() => submitFactura(false)}
            className="h-14 flex-1 rounded-xl font-bold shadow-soft"
          >
            <Printer className="mr-2 h-5 w-5" />
            <span>{loading ? "Cobrando…" : "COBRAR E IMPRIMIR"}</span>
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Nueva venta"
        subtitle="Punto de pago"
        actions={
          <Button
            type="button"
            onClick={() => setShowCatalogModal(true)}
            className="rounded-xl shadow-soft lg:hidden"
          >
            <PackageSearch className="mr-2 h-4 w-4" />
            Catálogo
          </Button>
        }
      />

      <div className="flex flex-col lg:h-[calc(100vh-8rem)] lg:flex-row lg:gap-6">
      {/* Desktop: Catálogo Izquierda */}
      <div className="hidden lg:flex lg:w-[55%] flex-col bg-card rounded-2xl border border-border p-5 shadow-soft">
        <div className="mb-5 flex items-center gap-3 border-b border-border/60 pb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <PackageSearch className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">Catálogo de productos</h2>
            <p className="text-xs font-medium text-muted-foreground">Busca o escanea SKU para agregar al carrito</p>
          </div>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto pr-2 custom-scrollbar">
          {catalogGrid}
        </div>
      </div>

      {/* Desktop & Mobile: Carrito (Derecha o Full) */}
      <div className="flex flex-col lg:flex-1 lg:min-h-0 lg:w-[45%]">
        {invoicePanel}
      </div>

      {/* Fly-to-cart particles */}
      {flyParticles.map((p) => (
        <div
          key={p.id}
          className="pointer-events-none fixed z-[200] flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-bold text-white shadow-lg"
          style={{
            left: p.x,
            top: p.y,
            transform: "translate(-50%, -50%)",
            animation: "flyToCart 0.65s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards",
          }}
        >
          <ShoppingCart className="h-3 w-3" />
          <span className="max-w-[100px] truncate">{p.label}</span>
        </div>
      ))}

      {/* Modal Mobile Catalog */}
      {showCatalogModal ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="catalogo-movil-titulo"
          className="fixed inset-0 z-50 flex flex-col bg-background lg:hidden"
        >
          <div className="flex items-center justify-between border-b border-border bg-card px-4 py-4 shadow-soft">
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <PackageSearch className="h-5 w-5" />
              </span>
              <h2 id="catalogo-movil-titulo" className="text-lg font-bold text-foreground">
                Catálogo
              </h2>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowCatalogModal(false)}
              className="h-9 rounded-lg px-3 text-xs font-bold"
            >
              Cerrar
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">{catalogGrid}</div>
        </div>
      ) : null}
      </div>
    </div>
  );
}
