"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { anularFactura } from "@/app/actions/admin-facturas";
import { formatCOP } from "@/lib/invoice-calculations";
import { Search, Eye, XCircle, FileText, User, Calendar, Tag } from "lucide-react";

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
  cliente: string;
  vendedor: string;
  items: ItemResumen[];
};

type HistorialClientProps = {
  facturas: FacturaRow[];
  isAdmin: boolean;
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

export function HistorialClient({ facturas, isAdmin }: HistorialClientProps) {
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

      {/* Vista Móvil (Tarjetas) */}
      <div className="grid gap-3 md:hidden">
        {facturas.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 py-12 px-4 text-center">
            <Search className="h-10 w-10 text-slate-400 mb-3" />
            <p className="text-sm font-medium text-slate-600">No hay facturas con los filtros aplicados.</p>
          </div>
        ) : null}
        {facturas.map((f) => (
          <div
            key={f.id}
            className={`relative overflow-hidden rounded-2xl bg-white p-4 shadow-sm border border-slate-200 transition-opacity ${
              f.estado === "anulada" ? "opacity-60 bg-slate-50" : ""
            }`}
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3 mb-3">
              <div>
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-slate-400" />
                  <h4 className="font-bold text-slate-900">#{f.numero_factura}</h4>
                  <span className={ESTADO_BADGE[f.estado] ?? "text-xs text-slate-500 font-medium"}>
                    {ESTADO_LABEL[f.estado] ?? f.estado}
                  </span>
                </div>
                <div className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-slate-500">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>
                    {new Date(f.created_at).toLocaleString("es-CO", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Total</p>
                <p className="font-bold text-lg text-indigo-700 leading-none mt-0.5">{formatCOP(Number(f.total))}</p>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-slate-400 shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase text-slate-500">Cliente</p>
                  <p className="truncate text-sm font-medium text-slate-700">{f.cliente}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Tag className="h-4 w-4 text-slate-400 shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase text-slate-500">Vendedor</p>
                  <p className="truncate text-sm font-medium text-slate-700">{f.vendedor}</p>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <Link
                href={`/historial/${f.id}`}
                className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-slate-100 text-sm font-semibold text-slate-700 active:bg-slate-200"
              >
                <Eye className="h-4 w-4" />
                Ver Detalle
              </Link>
              {isAdmin && f.estado !== "anulada" ? (
                <button
                  type="button"
                  onClick={() => setConfirm(f)}
                  className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-rose-50 text-sm font-semibold text-rose-700 active:bg-rose-100"
                >
                  <XCircle className="h-4 w-4" />
                  Anular
                </button>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      {/* Vista Desktop (Tabla) */}
      <div className="hidden md:block overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50/80 text-left">
            <tr>
              <th className="px-4 py-3 font-semibold text-slate-700">N°</th>
              <th className="px-4 py-3 font-semibold text-slate-700">Fecha</th>
              <th className="px-4 py-3 font-semibold text-slate-700">Cliente</th>
              <th className="px-4 py-3 font-semibold text-slate-700">Vendedor</th>
              <th className="px-4 py-3 font-semibold text-slate-700">Subtotal</th>
              <th className="px-4 py-3 font-semibold text-slate-700">Desc.</th>
              <th className="px-4 py-3 font-semibold text-slate-700">Total</th>
              <th className="px-4 py-3 font-semibold text-slate-700">Estado</th>
              <th className="px-4 py-3 font-semibold text-slate-700">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {facturas.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center text-sm text-slate-500">
                  <Search className="mx-auto h-8 w-8 text-slate-300 mb-2" />
                  No hay facturas con los filtros aplicados.
                </td>
              </tr>
            ) : null}
            {facturas.map((f) => (
              <tr
                key={f.id}
                className={`hover:bg-slate-50/50 transition-colors ${f.estado === "anulada" ? "opacity-50" : ""}`}
              >
                <td className="px-4 py-3 font-bold text-slate-900">{f.numero_factura}</td>
                <td className="px-4 py-3 font-medium text-slate-500 whitespace-nowrap">
                  {new Date(f.created_at).toLocaleString("es-CO", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </td>
                <td className="px-4 py-3 font-medium">{f.cliente}</td>
                <td className="px-4 py-3 font-medium text-slate-600">{f.vendedor}</td>
                <td className="px-4 py-3">{formatCOP(Number(f.subtotal))}</td>
                <td className="px-4 py-3 text-slate-500">{formatCOP(Number(f.descuento_total))}</td>
                <td className="px-4 py-3 font-bold text-slate-900">{formatCOP(Number(f.total))}</td>
                <td className="px-4 py-3">
                  <span className={ESTADO_BADGE[f.estado] ?? "text-xs text-slate-500"}>
                    {ESTADO_LABEL[f.estado] ?? f.estado}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/historial/${f.id}`}
                      className="flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 hover:text-indigo-600"
                    >
                      <Eye className="h-3.5 w-3.5" /> Ver
                    </Link>
                    {isAdmin && f.estado !== "anulada" ? (
                      <button
                        type="button"
                        onClick={() => setConfirm(f)}
                        className="flex h-8 items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 text-xs font-semibold text-rose-700 shadow-sm hover:bg-rose-100 hover:text-rose-800"
                      >
                        <XCircle className="h-3.5 w-3.5" /> Anular
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
