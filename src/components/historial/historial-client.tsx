"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { anularFactura } from "@/app/actions/admin-facturas";
import { formatCOP } from "@/lib/invoice-calculations";

type ItemResumen = {
  nombre: string;
  cantidad: number;
  subtotal: number;
};

type FacturaRow = {
  id: string;
  numero_factura: number;
  subtotal: number;
  descuento_total: number;
  total: number;
  estado: string;
  created_at: string;
  vendedor: string;
  items: ItemResumen[];
};

type HistorialClientProps = {
  facturas: FacturaRow[];
};

const ESTADO_BADGE: Record<string, string> = {
  pendiente_impresion: "rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-700",
  impresa: "rounded bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700",
  anulada: "rounded bg-slate-200 px-2 py-0.5 text-xs text-slate-500 line-through",
};

const ESTADO_LABEL: Record<string, string> = {
  pendiente_impresion: "Pendiente",
  impresa: "Impresa",
  anulada: "Anulada",
};

export function HistorialClient({ facturas }: HistorialClientProps) {
  const router = useRouter();
  const [confirm, setConfirm] = useState<FacturaRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAnular = async () => {
    if (!confirm) return;
    setLoading(true);
    setError(null);
    const result = await anularFactura(confirm.id);
    setLoading(false);
    if (result.error) {
      setError(result.error);
    } else {
      setConfirm(null);
      router.refresh();
    }
  };

  return (
    <>
      {error ? (
        <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="px-3 py-2">N°</th>
              <th className="px-3 py-2">Fecha</th>
              <th className="px-3 py-2">Vendedor</th>
              <th className="px-3 py-2">Subtotal</th>
              <th className="px-3 py-2">Desc.</th>
              <th className="px-3 py-2">Total</th>
              <th className="px-3 py-2">Estado</th>
              <th className="px-3 py-2">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {facturas.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-sm text-slate-400">
                  No hay facturas con los filtros aplicados.
                </td>
              </tr>
            ) : null}
            {facturas.map((f) => (
              <tr
                key={f.id}
                className={`border-t border-slate-100 ${f.estado === "anulada" ? "opacity-50" : ""}`}
              >
                <td className="px-3 py-2">{f.numero_factura}</td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {new Date(f.created_at).toLocaleString("es-CO", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </td>
                <td className="px-3 py-2">{f.vendedor}</td>
                <td className="px-3 py-2">{formatCOP(Number(f.subtotal))}</td>
                <td className="px-3 py-2">{formatCOP(Number(f.descuento_total))}</td>
                <td className="px-3 py-2 font-medium">{formatCOP(Number(f.total))}</td>
                <td className="px-3 py-2">
                  <span className={ESTADO_BADGE[f.estado] ?? "text-xs text-slate-500"}>
                    {ESTADO_LABEL[f.estado] ?? f.estado}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <div className="flex gap-1.5">
                    <Link
                      href={`/historial/${f.id}`}
                      className="rounded border border-slate-200 px-2 py-0.5 text-xs text-slate-700 hover:bg-slate-50"
                    >
                      Ver
                    </Link>
                    {f.estado !== "anulada" ? (
                      <button
                        type="button"
                        onClick={() => setConfirm(f)}
                        className="rounded border border-rose-200 bg-rose-50 px-2 py-0.5 text-xs text-rose-700 hover:bg-rose-100"
                      >
                        Anular
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {confirm ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
          onClick={() => !loading && setConfirm(null)}
        >
          <div
            className="w-full max-w-md space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-semibold text-slate-900">
                  Anular factura #{confirm.numero_factura}
                </h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  Esta acción restaurará el stock de los siguientes productos:
                </p>
              </div>
              <button
                type="button"
                disabled={loading}
                onClick={() => setConfirm(null)}
                className="rounded border border-slate-300 px-2 py-1 text-xs disabled:opacity-40"
              >
                ✕
              </button>
            </div>

            {error ? (
              <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
            ) : null}

            <div className="rounded-lg border border-slate-200 bg-slate-50">
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="px-3 py-2 text-left text-slate-600">Producto</th>
                    <th className="px-3 py-2 text-right text-slate-600">Cant.</th>
                    <th className="px-3 py-2 text-right text-slate-600">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {confirm.items.map((item, i) => (
                    <tr key={i} className="border-t border-slate-100">
                      <td className="px-3 py-1.5">{item.nombre}</td>
                      <td className="px-3 py-1.5 text-right">{item.cantidad}</td>
                      <td className="px-3 py-1.5 text-right">{formatCOP(item.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700">
              ⚠️ Esta acción es irreversible. Total a devolver:{" "}
              <span className="font-semibold">{formatCOP(Number(confirm.total))}</span>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                disabled={loading}
                onClick={() => setConfirm(null)}
                className="rounded border border-slate-300 px-3 py-1.5 text-sm disabled:opacity-40 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={handleAnular}
                className="rounded bg-rose-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60 hover:bg-rose-700"
              >
                {loading ? "Anulando..." : "Confirmar anulación"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
