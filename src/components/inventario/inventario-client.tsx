"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatCOP } from "@/lib/invoice-calculations";
import { KardexModal } from "@/components/inventario/kardex-modal";
import { SkuInput } from "@/components/ui/sku-input";

type ProductoRow = {
  id: string;
  nombre: string;
  sku_code: string;
  precio_venta: number;
  precio_costo: number;
  stock_actual: number;
  minimo_stock: number;
  activo: boolean;
};

type MovModal = { producto: ProductoRow; tipo: "entrada" | "salida" | null };

type InventarioClientProps = {
  productos: ProductoRow[];
  isAdmin: boolean;
};

export function InventarioClient({ productos, isAdmin }: InventarioClientProps) {
  const router = useRouter();
  const supabase = createClient();

  const [kardexProducto, setKardexProducto] = useState<ProductoRow | null>(null);

  const [movModal, setMovModal] = useState<MovModal | null>(null);
  const [movCantidad, setMovCantidad] = useState(1);
  const [movCosto, setMovCosto] = useState(0);
  const [movMotivo, setMovMotivo] = useState("");
  const [movLoading, setMovLoading] = useState(false);

  const [editModal, setEditModal] = useState<ProductoRow | null>(null);
  const [editNombre, setEditNombre] = useState("");
  const [editSku, setEditSku] = useState("");
  const [editPrecio, setEditPrecio] = useState(0);
  const [editCosto, setEditCosto] = useState(0);
  const [editUtilidad, setEditUtilidad] = useState(0);
  const [editMinimo, setEditMinimo] = useState(0);
  const [editLoading, setEditLoading] = useState(false);

  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const openEdit = (p: ProductoRow) => {
    const pc = Number(p.precio_costo);
    const pv = Number(p.precio_venta);
    setEditModal(p);
    setEditNombre(p.nombre);
    setEditSku(p.sku_code);
    setEditPrecio(pv);
    setEditCosto(pc);
    setEditUtilidad(pc > 0 ? Math.round(((pv - pc) / pc) * 100 * 10) / 10 : 0);
    setEditMinimo(Number(p.minimo_stock));
    setError(null);
    setSuccess(null);
  };

  const handleEditCosto = (v: number) => { setEditCosto(v); if (v > 0) setEditPrecio(Math.round(v * (1 + editUtilidad / 100))); };
  const handleEditPrecio = (v: number) => { setEditPrecio(v); if (editCosto > 0) setEditUtilidad(Math.round(((v - editCosto) / editCosto) * 100 * 10) / 10); };
  const handleEditUtilidad = (v: number) => { setEditUtilidad(v); if (editCosto > 0) setEditPrecio(Math.round(editCosto * (1 + v / 100))); };

  const onSaveEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editModal) return;
    setEditLoading(true);
    setError(null);
    const { error: err } = await supabase
      .from("productos")
      .update({ nombre: editNombre.trim(), sku_code: editSku.trim(), precio_venta: editPrecio, precio_costo: editCosto, minimo_stock: editMinimo })
      .eq("id", editModal.id);
    setEditLoading(false);
    if (err) { setError(err.message); return; }
    setSuccess("Producto actualizado.");
    setEditModal(null);
    router.refresh();
  };

  const openMovimiento = (p: ProductoRow) => {
    setMovModal({ producto: p, tipo: null });
    setMovCantidad(1);
    setMovCosto(0);
    setMovMotivo("");
    setError(null);
    setSuccess(null);
  };

  const onSubmitMovimiento = async (e: FormEvent) => {
    e.preventDefault();
    if (!movModal?.tipo) return;
    if (movCantidad <= 0) { setError("La cantidad debe ser mayor a 0."); return; }
    if (!movMotivo.trim()) { setError("La referencia es obligatoria."); return; }
    setMovLoading(true);
    setError(null);
    const cantidad = movModal.tipo === "salida" ? -movCantidad : movCantidad;
    const params: Record<string, unknown> = { p_producto_id: movModal.producto.id, p_cantidad: cantidad, p_motivo: movMotivo.trim() };
    if (movModal.tipo === "entrada" && movCosto > 0) params.p_costo_unitario = movCosto;
    const { error: err } = await supabase.rpc("ajustar_stock_manual", params);
    setMovLoading(false);
    if (err) { setError(err.message); return; }
    setSuccess(movModal.tipo === "entrada" ? "Entrada registrada." : "Salida registrada.");
    setMovModal(null);
    router.refresh();
  };

  const filtered = search.trim()
    ? productos.filter(
        (p) =>
          p.nombre.toLowerCase().includes(search.toLowerCase()) ||
          p.sku_code.toLowerCase().includes(search.toLowerCase()),
      )
    : productos;

  return (
    <>
      {success ? <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</p> : null}

      <div className="mb-3">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre o SKU..."
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none sm:max-w-xs"
        />
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="px-3 py-2">Producto</th>
              <th className="px-3 py-2">SKU</th>
              <th className="px-3 py-2">Precio</th>
              {isAdmin ? <th className="px-3 py-2">Stock</th> : null}
              {isAdmin ? <th className="px-3 py-2">Utilidad</th> : <th className="px-3 py-2">Estado</th>}
              {isAdmin ? <th className="px-3 py-2">Acciones</th> : null}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
            <tr><td colSpan={isAdmin ? 6 : 4} className="px-3 py-6 text-center text-sm text-slate-400">Sin resultados para &quot;{search}&quot;</td></tr>
          ) : null}
          {filtered.map((p) => {
              const low = p.stock_actual <= p.minimo_stock;
              const utilidad =
                Number(p.precio_costo) > 0
                  ? `${(((Number(p.precio_venta) - Number(p.precio_costo)) / Number(p.precio_costo)) * 100).toFixed(1)}%`
                  : "-";
              return (
                <tr key={p.id} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-medium">{p.nombre}</td>
                  <td className="px-3 py-2 text-slate-500">{p.sku_code}</td>
                  <td className="px-3 py-2">{formatCOP(Number(p.precio_venta))}</td>
                  {isAdmin ? (
                    <td className="px-3 py-2">
                      <span className={low ? "font-semibold text-amber-700" : ""}>{p.stock_actual}</span>
                      {low ? <span className="ml-1 text-xs">⚠️</span> : null}
                    </td>
                  ) : null}
                  {isAdmin ? (
                    <td className="px-3 py-2 text-slate-600">{utilidad}</td>
                  ) : (
                    <td className="px-3 py-2">
                      <span className={p.activo ? "rounded bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700" : "rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-500"}>
                        {p.activo ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                  )}
                  {isAdmin ? (
                    <td className="px-3 py-2">
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEdit(p)}
                          className="rounded border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-700 hover:bg-slate-50"
                        >
                          ✏️ Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => openMovimiento(p)}
                          className="rounded border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700 hover:bg-emerald-100"
                        >
                          📦 Kardex
                        </button>
                      </div>
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {editModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={() => setEditModal(null)}>
          <div className="w-full max-w-lg space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold">Editar: {editModal.nombre}</h3>
              <button type="button" onClick={() => setEditModal(null)} className="rounded border border-slate-300 px-2 py-1 text-xs">Cerrar ✕</button>
            </div>
            {error ? <p className="rounded bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
            <form onSubmit={onSaveEdit} className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1 text-xs text-slate-600">
                  <span>Nombre *</span>
                  <input value={editNombre} onChange={(e) => setEditNombre(e.target.value)} required className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm focus:border-emerald-500 focus:outline-none" />
                </label>
                <label className="space-y-1 text-xs text-slate-600">
                  <span>SKU *</span>
                  <SkuInput value={editSku} onChange={setEditSku} required />
                </label>
              </div>
              <p className="text-xs font-medium text-slate-500">Precios (sincronizados)</p>
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="space-y-1 text-xs text-slate-600">
                  <span>Costo</span>
                  <input type="number" min={0} value={editCosto} onChange={(e) => handleEditCosto(Number(e.target.value))} className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm focus:outline-none" />
                </label>
                <label className="space-y-1 text-xs text-slate-600">
                  <span>Utilidad %</span>
                  <input type="number" min={0} step={0.1} value={editUtilidad} onChange={(e) => handleEditUtilidad(Number(e.target.value))} className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm focus:outline-none" />
                </label>
                <label className="space-y-1 text-xs text-slate-600">
                  <span>Precio venta *</span>
                  <input type="number" min={0} value={editPrecio} onChange={(e) => handleEditPrecio(Number(e.target.value))} required className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm focus:outline-none" />
                </label>
              </div>
              <label className="block space-y-1 text-xs text-slate-600">
                <span>Stock mínimo</span>
                <input type="number" min={0} value={editMinimo} onChange={(e) => setEditMinimo(Number(e.target.value))} className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm focus:outline-none" />
              </label>
              <div className="flex justify-end">
                <button type="submit" disabled={editLoading} className="rounded bg-slate-900 px-4 py-1.5 text-sm text-white disabled:opacity-60">
                  {editLoading ? "Guardando..." : "Guardar cambios"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {movModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={() => setMovModal(null)}>
          <div className="w-full max-w-md space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold">Kardex</h3>
                <p className="text-xs text-slate-500">{movModal.producto.nombre} · Stock actual: {movModal.producto.stock_actual}</p>
              </div>
              <button type="button" onClick={() => setMovModal(null)} className="rounded border border-slate-300 px-2 py-1 text-xs">Cerrar ✕</button>
            </div>

            {error ? <p className="rounded bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}

            {!movModal.tipo ? (
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setMovModal({ ...movModal, tipo: "entrada" })}
                  className="flex flex-col items-center gap-1.5 rounded-xl border-2 border-emerald-300 bg-emerald-50 px-4 py-5 text-emerald-800 hover:bg-emerald-100"
                >
                  <span className="text-2xl">📥</span>
                  <span className="font-semibold text-sm">Registrar entrada</span>
                  <span className="text-xs text-emerald-600">Aumenta el stock</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMovModal({ ...movModal, tipo: "salida" })}
                  className="flex flex-col items-center gap-1.5 rounded-xl border-2 border-rose-200 bg-rose-50 px-4 py-5 text-rose-800 hover:bg-rose-100"
                >
                  <span className="text-2xl">📤</span>
                  <span className="font-semibold text-sm">Registrar salida</span>
                  <span className="text-xs text-rose-600">Disminuye el stock</span>
                </button>
              </div>
            ) : (
              <form onSubmit={onSubmitMovimiento} className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <span className={movModal.tipo === "entrada" ? "text-emerald-700" : "text-rose-700"}>
                    {movModal.tipo === "entrada" ? "📥 Entrada" : "📤 Salida"}
                  </span>
                  <button type="button" onClick={() => setMovModal({ ...movModal, tipo: null })} className="ml-auto text-xs font-normal text-slate-500 underline">
                    Cambiar
                  </button>
                </div>
                <div className={movModal.tipo === "entrada" ? "grid gap-3 sm:grid-cols-2" : ""}>
                  <label className="block space-y-1 text-xs text-slate-600">
                    <span>Cantidad *</span>
                    <input
                      type="number"
                      min={1}
                      value={movCantidad}
                      onChange={(e) => setMovCantidad(Number(e.target.value))}
                      required
                      className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm focus:border-emerald-500 focus:outline-none"
                    />
                  </label>
                  {movModal.tipo === "entrada" ? (
                    <label className="block space-y-1 text-xs text-slate-600">
                      <span>Costo unitario</span>
                      <input
                        type="number"
                        min={0}
                        value={movCosto}
                        onChange={(e) => setMovCosto(Number(e.target.value))}
                        placeholder="0"
                        className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm focus:outline-none"
                      />
                    </label>
                  ) : null}
                </div>
                <label className="block space-y-1 text-xs text-slate-600">
                  <span>Referencia *</span>
                  <input
                    value={movMotivo}
                    onChange={(e) => setMovMotivo(e.target.value)}
                    placeholder={movModal.tipo === "entrada" ? "Ej: Factura proveedor #123" : "Ej: Vencimiento, daño, uso interno"}
                    required
                    className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm focus:border-emerald-500 focus:outline-none"
                  />
                </label>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={movLoading}
                    className={`rounded px-4 py-1.5 text-sm text-white disabled:opacity-60 ${movModal.tipo === "entrada" ? "bg-emerald-700 hover:bg-emerald-800" : "bg-rose-600 hover:bg-rose-700"}`}
                  >
                    {movLoading ? "Registrando..." : movModal.tipo === "entrada" ? "Registrar entrada" : "Registrar salida"}
                  </button>
                </div>
              </form>
            )}

            <div className="border-t border-slate-100 pt-2">
              <button
                type="button"
                onClick={() => { const p = movModal.producto; setMovModal(null); setKardexProducto(p); }}
                className="text-xs text-slate-500 underline hover:text-slate-700"
              >
                📊 Ver historial de movimientos
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {kardexProducto ? (
        <KardexModal
          productoId={kardexProducto.id}
          nombreProducto={kardexProducto.nombre}
          onClose={() => setKardexProducto(null)}
        />
      ) : null}
    </>
  );
}
