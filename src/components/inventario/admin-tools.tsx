"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type ProductoRow = {
  id: string;
  nombre: string;
  sku_code: string;
  precio_venta: number;
  stock_actual: number;
  minimo_stock: number;
  activo: boolean;
};

type AdminToolsProps = {
  productos: ProductoRow[];
};

export function AdminTools({ productos }: AdminToolsProps) {
  const router = useRouter();
  const supabase = createClient();

  const [nombre, setNombre] = useState("");
  const [sku, setSku] = useState("");
  const [precio, setPrecio] = useState(0);
  const [stock, setStock] = useState(0);
  const [minimo, setMinimo] = useState(0);
  const [ajusteProducto, setAjusteProducto] = useState("");
  const [ajusteCantidad, setAjusteCantidad] = useState(0);
  const [motivo, setMotivo] = useState("ajuste_manual");
  const [editId, setEditId] = useState<string>("");
  const [editNombre, setEditNombre] = useState("");
  const [editSku, setEditSku] = useState("");
  const [editPrecio, setEditPrecio] = useState(0);
  const [editMinimo, setEditMinimo] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const onCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const { error: createError } = await supabase.from("productos").insert({
      nombre,
      sku_code: sku,
      precio_venta: precio,
      stock_actual: stock,
      minimo_stock: minimo,
      activo: true,
    });

    if (createError) {
      setError(createError.message);
      return;
    }

    setNombre("");
    setSku("");
    setPrecio(0);
    setStock(0);
    setMinimo(0);
    setSuccess("Producto creado correctamente.");
    router.refresh();
  };

  const onLoadForEdit = (productoId: string) => {
    const product = productos.find((p) => p.id === productoId);
    if (!product) return;

    setEditId(product.id);
    setEditNombre(product.nombre);
    setEditSku(product.sku_code);
    setEditPrecio(Number(product.precio_venta));
    setEditMinimo(Number(product.minimo_stock));
    setError(null);
    setSuccess(null);
  };

  const onUpdate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editId) {
      setError("Selecciona un producto para editar.");
      return;
    }

    setError(null);
    setSuccess(null);

    const { error: updateError } = await supabase
      .from("productos")
      .update({
        nombre: editNombre,
        sku_code: editSku,
        precio_venta: editPrecio,
        minimo_stock: editMinimo,
      })
      .eq("id", editId);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setSuccess("Producto actualizado correctamente.");
    router.refresh();
  };

  const onToggleActivo = async (producto: ProductoRow) => {
    setError(null);
    setSuccess(null);

    const { error: toggleError } = await supabase
      .from("productos")
      .update({ activo: !producto.activo })
      .eq("id", producto.id);

    if (toggleError) {
      setError(toggleError.message);
      return;
    }

    setSuccess(`Producto ${producto.activo ? "desactivado" : "activado"} correctamente.`);
    router.refresh();
  };

  const onAjustarStock = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!motivo.trim()) {
      setError("El motivo es obligatorio.");
      return;
    }

    const { error: rpcError } = await supabase.rpc("ajustar_stock_manual", {
      p_producto_id: ajusteProducto,
      p_cantidad: ajusteCantidad,
      p_motivo: motivo.trim(),
    });

    if (rpcError) {
      setError(rpcError.message);
      return;
    }

    setAjusteCantidad(0);
    setSuccess("Ajuste de stock registrado.");
    router.refresh();
  };

  return (
    <div className="space-y-4">
      <form onSubmit={onCreate} className="grid gap-2 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-5">
        <input
          value={nombre}
          onChange={(event) => setNombre(event.target.value)}
          placeholder="Nombre"
          required
          className="rounded border border-slate-300 px-2 py-1.5 text-sm"
        />
        <input
          value={sku}
          onChange={(event) => setSku(event.target.value)}
          placeholder="SKU"
          required
          className="rounded border border-slate-300 px-2 py-1.5 text-sm"
        />
        <input
          type="number"
          min={0}
          value={precio}
          onChange={(event) => setPrecio(Number(event.target.value))}
          placeholder="Precio"
          className="rounded border border-slate-300 px-2 py-1.5 text-sm"
        />
        <input
          type="number"
          min={0}
          value={stock}
          onChange={(event) => setStock(Number(event.target.value))}
          placeholder="Stock"
          className="rounded border border-slate-300 px-2 py-1.5 text-sm"
        />
        <div className="flex gap-2">
          <input
            type="number"
            min={0}
            value={minimo}
            onChange={(event) => setMinimo(Number(event.target.value))}
            placeholder="Mínimo"
            className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
          />
          <button type="submit" className="rounded bg-slate-900 px-3 py-1.5 text-sm text-white">
            Crear
          </button>
        </div>
      </form>

      <form onSubmit={onUpdate} className="grid gap-2 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-5">
        <select
          value={editId}
          onChange={(event) => onLoadForEdit(event.target.value)}
          className="rounded border border-slate-300 px-2 py-1.5 text-sm"
        >
          <option value="">Selecciona producto a editar</option>
          {productos.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre} ({p.sku_code})
            </option>
          ))}
        </select>
        <input
          value={editNombre}
          onChange={(event) => setEditNombre(event.target.value)}
          placeholder="Nombre"
          required
          className="rounded border border-slate-300 px-2 py-1.5 text-sm"
        />
        <input
          value={editSku}
          onChange={(event) => setEditSku(event.target.value)}
          placeholder="SKU"
          required
          className="rounded border border-slate-300 px-2 py-1.5 text-sm"
        />
        <input
          type="number"
          min={0}
          value={editPrecio}
          onChange={(event) => setEditPrecio(Number(event.target.value))}
          placeholder="Precio"
          className="rounded border border-slate-300 px-2 py-1.5 text-sm"
        />
        <div className="flex gap-2">
          <input
            type="number"
            min={0}
            value={editMinimo}
            onChange={(event) => setEditMinimo(Number(event.target.value))}
            placeholder="Mínimo"
            className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
          />
          <button type="submit" className="rounded bg-slate-900 px-3 py-1.5 text-sm text-white">
            Guardar
          </button>
        </div>
      </form>

      <form onSubmit={onAjustarStock} className="grid gap-2 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-4">
        <select
          value={ajusteProducto}
          onChange={(event) => setAjusteProducto(event.target.value)}
          required
          className="rounded border border-slate-300 px-2 py-1.5 text-sm"
        >
          <option value="">Selecciona producto</option>
          {productos.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre} ({p.sku_code})
            </option>
          ))}
        </select>
        <input
          type="number"
          value={ajusteCantidad}
          onChange={(event) => setAjusteCantidad(Number(event.target.value))}
          placeholder="Ajuste (+/-)"
          className="rounded border border-slate-300 px-2 py-1.5 text-sm"
        />
        <input
          value={motivo}
          onChange={(event) => setMotivo(event.target.value)}
          placeholder="Motivo"
          className="rounded border border-slate-300 px-2 py-1.5 text-sm"
        />
        <button type="submit" className="rounded bg-slate-900 px-3 py-1.5 text-sm text-white">
          Ajustar stock
        </button>
      </form>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <p className="mb-2 text-sm font-medium">Activar / desactivar producto</p>
        <div className="flex flex-wrap gap-2">
          {productos.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onToggleActivo(p)}
              className="rounded border border-slate-300 px-2 py-1 text-xs"
            >
              {p.nombre} → {p.activo ? "Desactivar" : "Activar"}
            </button>
          ))}
        </div>
      </div>

      {success ? <p className="text-sm text-emerald-700">{success}</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
