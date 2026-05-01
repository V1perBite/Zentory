"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatCOP } from "@/lib/invoice-calculations";
import { KardexModal } from "@/components/inventario/kardex-modal";
import { SkuInput } from "@/components/ui/sku-input";
import { NumberField } from "@/components/ui/number-field";
import { Search, Edit2, Archive, Trash2, Package, Tag, TrendingUp, AlertTriangle } from "lucide-react";

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
  const [deleteConfirm, setDeleteConfirm] = useState<ProductoRow | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
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

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    setDeleteLoading(true);
    setError(null);
    const { error: err } = await supabase
      .from("productos")
      .delete()
      .eq("id", deleteConfirm.id);
    setDeleteLoading(false);
    if (err) { setError(err.message); return; }
    setSuccess(`"${deleteConfirm.nombre}" eliminado.`);
    setDeleteConfirm(null);
    router.refresh();
  };

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

      <div className="mb-4">
        <SkuInput
          value={search}
          onChange={setSearch}
          onDetected={setSearch}
          placeholder="Buscar por nombre o SKU..."
          className="w-full sm:max-w-md"
        />
      </div>

      {/* Vista Móvil (Tarjetas) */}
      <div className="grid gap-3 md:hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 py-12 px-4 text-center">
            <Search className="h-10 w-10 text-slate-400 mb-3" />
            <p className="text-sm font-medium text-slate-600">Sin resultados para &quot;{search}&quot;</p>
            <p className="text-xs text-slate-500 mt-1">Intenta con otro término o SKU</p>
          </div>
        ) : null}
        {filtered.map((p) => {
          const low = p.stock_actual <= p.minimo_stock;
          return (
            <div key={p.id} className="relative overflow-hidden rounded-2xl bg-white p-4 shadow-sm border border-slate-200">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h4 className="truncate font-bold text-slate-900">{p.nombre}</h4>
                  <div className="mt-1 flex items-center gap-1.5 text-xs font-medium text-slate-500">
                    <Tag className="h-3.5 w-3.5" />
                    <span className="truncate">{p.sku_code}</span>
                  </div>
                </div>
                <div className={`flex shrink-0 items-center justify-center rounded-xl px-2.5 py-1 ${low ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}>
                  <Package className="mr-1.5 h-4 w-4" />
                  <span className="font-bold text-lg leading-none">{p.stock_actual}</span>
                  {low && <AlertTriangle className="ml-1.5 h-4 w-4" />}
                </div>
              </div>
              
              <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Precio</p>
                  <p className="mt-0.5 text-sm font-bold text-slate-900">{formatCOP(Number(p.precio_venta))}</p>
                </div>
                {isAdmin && (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Costo</p>
                    <p className="mt-0.5 text-sm font-medium text-slate-700">{formatCOP(Number(p.precio_costo))}</p>
                  </div>
                )}
              </div>

              {isAdmin && (
                <div className="mt-4 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openMovimiento(p)}
                    className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-indigo-50 text-sm font-semibold text-indigo-700 active:bg-indigo-100"
                  >
                    <Archive className="h-4 w-4" />
                    Kardex
                  </button>
                  <button
                    type="button"
                    onClick={() => openEdit(p)}
                    className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-slate-100 text-sm font-semibold text-slate-700 active:bg-slate-200"
                  >
                    <Edit2 className="h-4 w-4" />
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteConfirm(p)}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-600 active:bg-rose-100"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Vista Desktop (Tabla) */}
      <div className="hidden md:block overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50/80 text-left">
            <tr>
              <th className="px-4 py-3 font-semibold text-slate-700">Producto</th>
              <th className="px-4 py-3 font-semibold text-slate-700">SKU</th>
              <th className="px-4 py-3 font-semibold text-slate-700">Precio</th>
              {isAdmin ? <th className="px-4 py-3 font-semibold text-slate-700">Costo</th> : null}
              {isAdmin ? <th className="px-4 py-3 font-semibold text-slate-700">Stock</th> : null}
              {isAdmin ? <th className="px-4 py-3 font-semibold text-slate-700">Utilidad</th> : <th className="px-4 py-3 font-semibold text-slate-700">Estado</th>}
              {isAdmin ? <th className="px-4 py-3 font-semibold text-slate-700">Acciones</th> : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length === 0 ? (
            <tr><td colSpan={isAdmin ? 7 : 4} className="px-4 py-12 text-center text-sm text-slate-500">
              <Search className="mx-auto h-8 w-8 text-slate-300 mb-2" />
              Sin resultados para &quot;{search}&quot;
            </td></tr>
          ) : null}
          {filtered.map((p) => {
              const low = p.stock_actual <= p.minimo_stock;
              const utilidad =
                Number(p.precio_costo) > 0
                  ? `${(((Number(p.precio_venta) - Number(p.precio_costo)) / Number(p.precio_costo)) * 100).toFixed(1)}%`
                  : "-";
              return (
                <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-4 py-3 font-bold text-slate-900">{p.nombre}</td>
                  <td className="px-4 py-3 font-medium text-slate-500">{p.sku_code}</td>
                  <td className="px-4 py-3 font-semibold">{formatCOP(Number(p.precio_venta))}</td>
                  {isAdmin ? (
                    <td className="px-4 py-3 text-slate-600">{formatCOP(Number(p.precio_costo))}</td>
                  ) : null}
                  {isAdmin ? (
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-bold ${low ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}>
                        {p.stock_actual}
                        {low && <AlertTriangle className="h-3.5 w-3.5" />}
                      </span>
                    </td>
                  ) : null}
                  {isAdmin ? (
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 font-medium text-slate-600">
                        <TrendingUp className="h-3.5 w-3.5 text-slate-400" />
                        {utilidad}
                      </span>
                    </td>
                  ) : (
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-lg px-2 py-1 text-xs font-bold ${p.activo ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                        {p.activo ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                  )}
                  {isAdmin ? (
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openEdit(p)}
                          className="flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 hover:text-indigo-600"
                        >
                          <Edit2 className="h-3.5 w-3.5" /> Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => openMovimiento(p)}
                          className="flex h-8 items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 text-xs font-semibold text-indigo-700 shadow-sm hover:bg-indigo-100 hover:text-indigo-800"
                        >
                          <Archive className="h-3.5 w-3.5" /> Kardex
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteConfirm(p)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-rose-600 shadow-sm hover:bg-rose-100 hover:text-rose-700"
                        >
                          <Trash2 className="h-4 w-4" />
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
                  <NumberField value={editCosto} min={0} onChange={handleEditCosto} className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm focus:outline-none" />
                </label>
                <label className="space-y-1 text-xs text-slate-600">
                  <span>Utilidad %</span>
                  <NumberField value={editUtilidad} min={0} step={0.1} onChange={handleEditUtilidad} className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm focus:outline-none" />
                </label>
                <label className="space-y-1 text-xs text-slate-600">
                  <span>Precio venta *</span>
                  <NumberField value={editPrecio} min={0} onChange={handleEditPrecio} required className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm focus:outline-none" />
                </label>
              </div>
              <label className="block space-y-1 text-xs text-slate-600">
                <span>Stock mínimo</span>
                <NumberField value={editMinimo} min={0} onChange={setEditMinimo} className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm focus:outline-none" />
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
                    <NumberField
                      value={movCantidad}
                      min={1}
                      onChange={setMovCantidad}
                      required
                      className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm focus:border-emerald-500 focus:outline-none"
                    />
                  </label>
                  {movModal.tipo === "entrada" ? (
                    <label className="block space-y-1 text-xs text-slate-600">
                      <span>Costo unitario</span>
                      <NumberField
                        value={movCosto}
                        min={0}
                        onChange={setMovCosto}
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

      {deleteConfirm ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
          onClick={() => !deleteLoading && setDeleteConfirm(null)}
        >
          <div
            className="w-full max-w-sm space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-semibold text-slate-900">Eliminar producto</h3>
                <p className="mt-0.5 text-sm text-slate-600">
                  ¿Eliminar <span className="font-medium">&quot;{deleteConfirm.nombre}&quot;</span>?
                </p>
              </div>
              <button
                type="button"
                disabled={deleteLoading}
                onClick={() => setDeleteConfirm(null)}
                className="rounded border border-slate-300 px-2 py-1 text-xs disabled:opacity-40"
              >
                ✕
              </button>
            </div>
            <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">
              ⚠️ Esta acción es permanente. El historial de movimientos del producto se conservará.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                disabled={deleteLoading}
                onClick={() => setDeleteConfirm(null)}
                className="rounded border border-slate-300 px-3 py-1.5 text-sm disabled:opacity-40 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={deleteLoading}
                onClick={handleDelete}
                className="rounded bg-rose-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60 hover:bg-rose-700"
              >
                {deleteLoading ? "Eliminando..." : "Sí, eliminar"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
