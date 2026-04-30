"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type ParsedProducto = {
  nombre: string;
  sku_code: string;
  precio_venta: number;
  precio_costo: number;
  stock_actual: number;
  minimo_stock: number;
  _error?: string;
};

type ImportCsvModalProps = {
  onClose: () => void;
};

const COL_ALIASES: Record<string, keyof ParsedProducto> = {
  nombre: "nombre",
  name: "nombre",
  producto: "nombre",
  descripcion: "nombre",
  sku: "sku_code",
  sku_code: "sku_code",
  codigo: "sku_code",
  "código": "sku_code",
  referencia: "sku_code",
  ref: "sku_code",
  precio_venta: "precio_venta",
  precio: "precio_venta",
  "precio de venta": "precio_venta",
  "precio venta": "precio_venta",
  pvp: "precio_venta",
  precio_costo: "precio_costo",
  costo: "precio_costo",
  "precio costo": "precio_costo",
  "costo unitario": "precio_costo",
  pc: "precio_costo",
  stock_actual: "stock_actual",
  stock: "stock_actual",
  cantidad: "stock_actual",
  existencia: "stock_actual",
  existencias: "stock_actual",
  minimo_stock: "minimo_stock",
  minimo: "minimo_stock",
  "stock minimo": "minimo_stock",
  "stock mínimo": "minimo_stock",
  min: "minimo_stock",
};

function parseCsv(text: string): ParsedProducto[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  const delimiter = lines[0].includes(";") ? ";" : ",";
  const rawHeaders = lines[0].split(delimiter).map((h) =>
    h.trim().replace(/^["']|["']$/g, "").toLowerCase(),
  );

  const mapped = rawHeaders.map((h) => COL_ALIASES[h] ?? null);

  return lines.slice(1).filter((l) => l.trim()).map((line) => {
    const values = line.split(delimiter).map((v) =>
      v.trim().replace(/^["']|["']$/g, ""),
    );
    const row: Partial<ParsedProducto> = {};
    mapped.forEach((field, i) => {
      if (!field) return;
      const raw = values[i] ?? "";
      if (field === "nombre" || field === "sku_code") {
        (row[field] as string) = raw;
      } else {
        (row[field] as number) = parseFloat(raw.replace(",", ".")) || 0;
      }
    });

    const nombre = row.nombre?.trim() ?? "";
    const sku_code = row.sku_code?.trim() ?? "";
    let _error: string | undefined;
    if (!nombre) _error = "Falta nombre";
    else if (!sku_code) _error = "Falta SKU";

    return {
      nombre,
      sku_code,
      precio_venta: row.precio_venta ?? 0,
      precio_costo: row.precio_costo ?? 0,
      stock_actual: row.stock_actual ?? 0,
      minimo_stock: row.minimo_stock ?? 0,
      _error,
    };
  });
}

const TEMPLATE_HEADERS = "nombre,sku_code,precio_venta,precio_costo,stock_actual,minimo_stock";
const TEMPLATE_EXAMPLE = "Arroz 1kg,ARZ-001,5000,3500,50,10\nAceite 900ml,ACE-001,8500,6000,30,5";

export function ImportCsvModal({ onClose }: ImportCsvModalProps) {
  const router = useRouter();
  const supabase = createClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [rows, setRows] = useState<ParsedProducto[]>([]);
  const [fileName, setFileName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setError(null);
    setSuccess(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const parsed = parseCsv(text);
      if (parsed.length === 0) {
        setError("No se encontraron filas. Verifica que el archivo tenga encabezados en la primera fila.");
      }
      setRows(parsed);
    };
    reader.readAsText(file, "UTF-8");
  };

  const validRows = rows.filter((r) => !r._error);
  const invalidRows = rows.filter((r) => r._error);

  const handleImport = async () => {
    if (validRows.length === 0) return;
    setLoading(true);
    setError(null);
    setProgress({ done: 0, total: validRows.length });

    const BATCH = 50;
    let inserted = 0;

    for (let i = 0; i < validRows.length; i += BATCH) {
      const batch = validRows.slice(i, i + BATCH).map(({ _error: _e, ...p }) => ({
        ...p,
        activo: true,
      }));
      const { error: insertError } = await supabase.from("productos").insert(batch);
      if (insertError) {
        setError(`Error en lote ${Math.floor(i / BATCH) + 1}: ${insertError.message}`);
        setLoading(false);
        setProgress(null);
        return;
      }
      inserted += batch.length;
      setProgress({ done: inserted, total: validRows.length });
    }

    setLoading(false);
    setProgress(null);
    setSuccess(`✅ ${inserted} productos importados correctamente.`);
    setRows([]);
    setFileName("");
    if (fileRef.current) fileRef.current.value = "";
    router.refresh();
  };

  const downloadTemplate = () => {
    const blob = new Blob([TEMPLATE_HEADERS + "\n" + TEMPLATE_EXAMPLE], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "plantilla_productos.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 pt-12"
      onClick={() => !loading && onClose()}
    >
      <div
        className="w-full max-w-3xl space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold">Importar productos desde CSV</h3>
            <p className="text-xs text-slate-500">
              Soporta archivos Excel exportados como CSV (coma o punto y coma como separador).
            </p>
          </div>
          <button
            type="button"
            disabled={loading}
            onClick={onClose}
            className="rounded-md border border-slate-300 px-2 py-1 text-xs disabled:opacity-40"
          >
            Cerrar ✕
          </button>
        </div>

        {/* Template download */}
        <div className="flex items-center gap-3 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2.5">
          <span className="text-xl">📄</span>
          <div className="flex-1 text-xs text-blue-800">
            <p className="font-medium">¿Primera vez?</p>
            <p>Descarga la plantilla, rellénala en Excel y expórtala como CSV antes de importar.</p>
          </div>
          <button
            type="button"
            onClick={downloadTemplate}
            className="shrink-0 rounded border border-blue-300 bg-white px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50"
          >
            Descargar plantilla
          </button>
        </div>

        {/* Columnas reconocidas */}
        <details className="rounded-lg border border-slate-200 text-xs">
          <summary className="cursor-pointer px-3 py-2 font-medium text-slate-600">
            Nombres de columna aceptados
          </summary>
          <div className="grid grid-cols-2 gap-x-6 px-3 pb-3 pt-1 text-slate-500 sm:grid-cols-3">
            <div><span className="font-medium">Nombre:</span> nombre, producto, descripcion, name</div>
            <div><span className="font-medium">SKU:</span> sku, sku_code, codigo, referencia, ref</div>
            <div><span className="font-medium">Precio venta:</span> precio_venta, precio, pvp</div>
            <div><span className="font-medium">Precio costo:</span> precio_costo, costo</div>
            <div><span className="font-medium">Stock:</span> stock_actual, stock, cantidad</div>
            <div><span className="font-medium">Mínimo:</span> minimo_stock, minimo, min</div>
          </div>
        </details>

        {/* File picker */}
        <div className="flex items-center gap-3">
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border-2 border-dashed border-slate-300 px-4 py-3 hover:border-emerald-400 hover:bg-emerald-50">
            <span className="text-lg">📂</span>
            <span className="text-sm text-slate-600">
              {fileName || "Seleccionar archivo CSV"}
            </span>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={handleFile}
              disabled={loading}
            />
          </label>
          {rows.length > 0 && (
            <span className="text-xs text-slate-500">
              {rows.length} filas detectadas · {validRows.length} válidas
              {invalidRows.length > 0 ? ` · ${invalidRows.length} con error` : ""}
            </span>
          )}
        </div>

        {error ? (
          <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
        ) : null}
        {success ? (
          <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</p>
        ) : null}

        {/* Preview table */}
        {rows.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs font-medium text-slate-600">Vista previa (primeras 10 filas)</p>
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="min-w-full text-xs">
                <thead className="bg-slate-50 text-left">
                  <tr>
                    <th className="px-2 py-1.5">Estado</th>
                    <th className="px-2 py-1.5">Nombre</th>
                    <th className="px-2 py-1.5">SKU</th>
                    <th className="px-2 py-1.5 text-right">Precio venta</th>
                    <th className="px-2 py-1.5 text-right">Costo</th>
                    <th className="px-2 py-1.5 text-right">Stock</th>
                    <th className="px-2 py-1.5 text-right">Mínimo</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 10).map((r, i) => (
                    <tr key={i} className={`border-t border-slate-100 ${r._error ? "bg-rose-50" : ""}`}>
                      <td className="px-2 py-1.5">
                        {r._error ? (
                          <span className="text-rose-600">⚠ {r._error}</span>
                        ) : (
                          <span className="text-emerald-600">✓</span>
                        )}
                      </td>
                      <td className="px-2 py-1.5 font-medium">{r.nombre || "—"}</td>
                      <td className="px-2 py-1.5 text-slate-500">{r.sku_code || "—"}</td>
                      <td className="px-2 py-1.5 text-right">{r.precio_venta.toLocaleString()}</td>
                      <td className="px-2 py-1.5 text-right">{r.precio_costo.toLocaleString()}</td>
                      <td className="px-2 py-1.5 text-right">{r.stock_actual}</td>
                      <td className="px-2 py-1.5 text-right">{r.minimo_stock}</td>
                    </tr>
                  ))}
                  {rows.length > 10 ? (
                    <tr className="border-t border-slate-100">
                      <td colSpan={7} className="px-2 py-1.5 text-center text-slate-400">
                        … y {rows.length - 10} filas más
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            {progress ? (
              <div className="space-y-1">
                <div className="h-2 w-full overflow-hidden rounded bg-slate-100">
                  <div
                    className="h-full rounded bg-emerald-500 transition-all"
                    style={{ width: `${(progress.done / progress.total) * 100}%` }}
                  />
                </div>
                <p className="text-xs text-slate-500">
                  Importando {progress.done}/{progress.total}…
                </p>
              </div>
            ) : null}

            <div className="flex items-center justify-between">
              {invalidRows.length > 0 ? (
                <p className="text-xs text-amber-700">
                  ⚠ {invalidRows.length} fila(s) con error serán omitidas.
                </p>
              ) : (
                <span />
              )}
              <button
                type="button"
                disabled={loading || validRows.length === 0}
                onClick={handleImport}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60 hover:bg-emerald-700"
              >
                {loading
                  ? "Importando..."
                  : `Importar ${validRows.length} producto${validRows.length !== 1 ? "s" : ""}`}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
