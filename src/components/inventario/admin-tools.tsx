"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { SkuInput } from "@/components/ui/sku-input";
import { ImportCsvModal } from "@/components/inventario/import-csv-modal";

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

type AdminToolsProps = {
  productos: ProductoRow[];
};

export function AdminTools({ productos }: AdminToolsProps) {
  const router = useRouter();
  const supabase = createClient();

  const [nombre, setNombre] = useState("");
  const [sku, setSku] = useState("");
  const [precio, setPrecio] = useState(0);
  const [costo, setCosto] = useState(0);
  const [utilidad, setUtilidad] = useState(0);
  const [stock, setStock] = useState(0);
  const [minimo, setMinimo] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loadingAction, setLoadingAction] = useState<"create" | null>(null);
  const [openPanel, setOpenPanel] = useState<"create" | null>(null);
  const [showImport, setShowImport] = useState(false);

  const onCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!nombre.trim() || !sku.trim()) {
      setError("Nombre y SKU son obligatorios.");
      return;
    }

    if (precio < 0 || stock < 0 || minimo < 0) {
      setError("Precio, stock y mínimo no pueden ser negativos.");
      return;
    }

    setLoadingAction("create");

    const { error: createError } = await supabase.from("productos").insert({
      nombre: nombre.trim(),
      sku_code: sku.trim(),
      precio_venta: precio,
      precio_costo: costo,
      stock_actual: stock,
      minimo_stock: minimo,
      activo: true,
    });

    if (createError) {
      setLoadingAction(null);
      setError(createError.message);
      return;
    }

    setNombre("");
    setSku("");
    setPrecio(0);
    setCosto(0);
    setUtilidad(0);
    setStock(0);
    setMinimo(0);
    setSuccess("Producto creado correctamente.");
    setLoadingAction(null);
    setOpenPanel(null);
    router.refresh();
  };

  const isOpen = (panel: "create") => openPanel === panel;

  const togglePanel = (panel: "create") => {
    setOpenPanel((current) => (current === panel ? null : panel));
    setError(null);
    setSuccess(null);
  };

  const panelTitle: Record<"create", string> = {
    create: "Crear producto",
  };

  const handleCreateCostoChange = (v: number) => {
    setCosto(v);
    if (v > 0) setPrecio(Math.round(v * (1 + utilidad / 100)));
  };
  const handleCreatePrecioChange = (v: number) => {
    setPrecio(v);
    if (costo > 0) setUtilidad(Math.round(((v - costo) / costo) * 100 * 10) / 10);
  };
  const handleCreateUtilidadChange = (v: number) => {
    setUtilidad(v);
    if (costo > 0) setPrecio(Math.round(costo * (1 + v / 100)));
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => togglePanel("create")}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
        >
          ➕ Crear producto
        </button>
        <button
          type="button"
          onClick={() => setShowImport(true)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
        >
          📤 Importar CSV
        </button>
      </div>

      {showImport ? <ImportCsvModal onClose={() => setShowImport(false)} /> : null}

      {success ? <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</p> : null}
      {error ? <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}

      {openPanel ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
          onClick={() => setOpenPanel(null)}
        >
          <div
            className="w-full max-w-2xl space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900">{panelTitle[openPanel]}</h3>
              <button
                type="button"
                onClick={() => setOpenPanel(null)}
                className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
              >
                Cerrar ✕
              </button>
            </div>

            {success ? <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</p> : null}
            {error ? <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}

            {isOpen("create") ? (
              <form onSubmit={onCreate} className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="space-y-1 text-xs text-slate-600">
                    <span>Nombre *</span>
                    <input
                      value={nombre}
                      onChange={(event) => setNombre(event.target.value)}
                      placeholder="Ej: Arroz 1kg"
                      required
                      className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm focus:border-emerald-500 focus:outline-none"
                    />
                  </label>
                  <label className="space-y-1 text-xs text-slate-600">
                    <span>SKU *</span>
                    <SkuInput value={sku} onChange={setSku} placeholder="Ej: ARZ-001" required />
                  </label>
                </div>
                <p className="text-xs font-medium text-slate-500">Precios (campos sincronizados)</p>
                <div className="grid gap-3 sm:grid-cols-3">
                  <label className="space-y-1 text-xs text-slate-600">
                    <span>Costo</span>
                    <input
                      type="number"
                      min={0}
                      value={costo}
                      onChange={(event) => handleCreateCostoChange(Number(event.target.value))}
                      placeholder="0"
                      className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm focus:border-emerald-500 focus:outline-none"
                    />
                  </label>
                  <label className="space-y-1 text-xs text-slate-600">
                    <span>Utilidad %</span>
                    <input
                      type="number"
                      min={0}
                      step={0.1}
                      value={utilidad}
                      onChange={(event) => handleCreateUtilidadChange(Number(event.target.value))}
                      placeholder="0"
                      className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm focus:border-emerald-500 focus:outline-none"
                    />
                  </label>
                  <label className="space-y-1 text-xs text-slate-600">
                    <span>Precio de venta *</span>
                    <input
                      type="number"
                      min={0}
                      value={precio}
                      onChange={(event) => handleCreatePrecioChange(Number(event.target.value))}
                      placeholder="0"
                      required
                      className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm focus:border-emerald-500 focus:outline-none"
                    />
                  </label>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="space-y-1 text-xs text-slate-600">
                    <span>Stock inicial *</span>
                    <input
                      type="number"
                      min={0}
                      value={stock}
                      onChange={(event) => setStock(Number(event.target.value))}
                      placeholder="0"
                      required
                      className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm focus:border-emerald-500 focus:outline-none"
                    />
                  </label>
                  <label className="space-y-1 text-xs text-slate-600">
                    <span>Stock mínimo *</span>
                    <input
                      type="number"
                      min={0}
                      value={minimo}
                      onChange={(event) => setMinimo(Number(event.target.value))}
                      placeholder="0"
                      required
                      className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm focus:border-emerald-500 focus:outline-none"
                    />
                  </label>
                </div>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={loadingAction === "create"}
                    className="rounded bg-slate-900 px-4 py-1.5 text-sm text-white disabled:opacity-60"
                  >
                    {loadingAction === "create" ? "Creando..." : "Crear producto"}
                  </button>
                </div>
              </form>
            ) : null}

          </div>
        </div>
      ) : null}
    </div>
  );
}
