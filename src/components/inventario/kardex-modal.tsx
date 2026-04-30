"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatCOP } from "@/lib/invoice-calculations";

type MovimientoKardex = {
  id: string;
  tipo: string;
  cantidad: number;
  motivo: string;
  costo_unitario: number | null;
  factura_id: string | null;
  created_at: string;
};

type KardexRow = {
  id: string;
  fecha: string;
  tipo: string;
  referencia: string;
  costoUnitario: number;
  entradas: number;
  salidas: number;
  saldo: number;
  costoPromedio: number;
  valorInventario: number;
};

type KardexModalProps = {
  productoId: string;
  nombreProducto: string;
  onClose: () => void;
};

export function KardexModal({ productoId, nombreProducto, onClose }: KardexModalProps) {
  const supabase = useRef(createClient());
  const [movimientos, setMovimientos] = useState<MovimientoKardex[]>([]);
  const [loading, setLoading] = useState(true);
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");

  useEffect(() => {
    const fetchMovimientos = async () => {
      setLoading(true);
      const { data } = await supabase.current
        .from("movimientos_stock")
        .select("id,tipo,cantidad,motivo,costo_unitario,factura_id,created_at")
        .eq("producto_id", productoId)
        .order("created_at", { ascending: true });
      setMovimientos((data as MovimientoKardex[]) ?? []);
      setLoading(false);
    };
    void fetchMovimientos();
  }, [productoId]);

  const kardexRows = useMemo<KardexRow[]>(() => {
    let saldo = 0;
    let valorAcumulado = 0;

    return movimientos
      .filter((m) => {
        if (desde && m.created_at < desde) return false;
        if (hasta && m.created_at > hasta + "T23:59:59") return false;
        return true;
      })
      .map((m) => {
        const esEntrada = m.tipo === "entrada";
        const esSalida = m.tipo === "salida";
        const costoUnit = m.costo_unitario ?? 0;

        if (esEntrada) {
          valorAcumulado = valorAcumulado + costoUnit * m.cantidad;
          saldo = saldo + m.cantidad;
        } else if (esSalida) {
          const costoSalida = saldo > 0 ? (valorAcumulado / saldo) * m.cantidad : 0;
          valorAcumulado = Math.max(0, valorAcumulado - costoSalida);
          saldo = Math.max(0, saldo - m.cantidad);
        } else {
          if (m.cantidad > 0) {
            valorAcumulado = valorAcumulado + costoUnit * m.cantidad;
            saldo = saldo + m.cantidad;
          } else {
            const costoSalida = saldo > 0 ? (valorAcumulado / saldo) * Math.abs(m.cantidad) : 0;
            valorAcumulado = Math.max(0, valorAcumulado - costoSalida);
            saldo = Math.max(0, saldo - Math.abs(m.cantidad));
          }
        }

        const costoPromedio = saldo > 0 ? valorAcumulado / saldo : 0;

        return {
          id: m.id,
          fecha: new Date(m.created_at).toLocaleString(),
          tipo: m.tipo,
          referencia: m.motivo + (m.factura_id ? ` (Factura)` : ""),
          costoUnitario: costoUnit,
          entradas: esEntrada || (m.tipo === "ajuste" && m.cantidad > 0) ? m.cantidad : 0,
          salidas: esSalida || (m.tipo === "ajuste" && m.cantidad < 0) ? Math.abs(m.cantidad) : 0,
          saldo,
          costoPromedio,
          valorInventario: valorAcumulado,
        };
      });
  }, [movimientos, desde, hasta]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4"
      onClick={onClose}
    >
      <div
        className="mt-8 w-full max-w-5xl rounded-xl border border-slate-200 bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold">Kardex — {nombreProducto}</h2>
            <p className="text-xs text-slate-500">Historial con costo promedio ponderado</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50"
          >
            Cerrar ✕
          </button>
        </div>

        <div className="flex gap-4 border-b border-slate-200 px-5 py-3">
          <label className="flex items-center gap-2 text-xs text-slate-600">
            <span>Desde</span>
            <input
              type="date"
              value={desde}
              onChange={(e) => setDesde(e.target.value)}
              className="rounded border border-slate-300 px-2 py-1 text-xs"
            />
          </label>
          <label className="flex items-center gap-2 text-xs text-slate-600">
            <span>Hasta</span>
            <input
              type="date"
              value={hasta}
              onChange={(e) => setHasta(e.target.value)}
              className="rounded border border-slate-300 px-2 py-1 text-xs"
            />
          </label>
          {(desde || hasta) ? (
            <button
              type="button"
              onClick={() => { setDesde(""); setHasta(""); }}
              className="text-xs text-slate-400 hover:text-slate-700"
            >
              Limpiar filtros
            </button>
          ) : null}
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <p className="px-5 py-8 text-center text-sm text-slate-400">Cargando movimientos...</p>
          ) : kardexRows.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-slate-400">Sin movimientos en el rango seleccionado.</p>
          ) : (
            <table className="min-w-full text-xs">
              <thead className="bg-slate-50 text-left">
                <tr>
                  <th className="px-3 py-2">Fecha</th>
                  <th className="px-3 py-2">Tipo</th>
                  <th className="px-3 py-2">Referencia</th>
                  <th className="px-3 py-2 text-right">Costo unit.</th>
                  <th className="px-3 py-2 text-right">Entradas</th>
                  <th className="px-3 py-2 text-right">Salidas</th>
                  <th className="px-3 py-2 text-right">Saldo</th>
                  <th className="px-3 py-2 text-right">C. Prom.</th>
                  <th className="px-3 py-2 text-right">Valor inventario</th>
                </tr>
              </thead>
              <tbody>
                {kardexRows.map((row) => (
                  <tr key={row.id} className="border-t border-slate-100">
                    <td className="px-3 py-2 text-slate-500">{row.fecha}</td>
                    <td className="px-3 py-2">
                      <span
                        className={
                          row.tipo === "entrada"
                            ? "rounded bg-emerald-100 px-1.5 py-0.5 text-emerald-700"
                            : row.tipo === "salida"
                            ? "rounded bg-rose-100 px-1.5 py-0.5 text-rose-700"
                            : "rounded bg-slate-100 px-1.5 py-0.5 text-slate-600"
                        }
                      >
                        {row.tipo}
                      </span>
                    </td>
                    <td className="px-3 py-2">{row.referencia}</td>
                    <td className="px-3 py-2 text-right">{row.costoUnitario > 0 ? formatCOP(row.costoUnitario) : "-"}</td>
                    <td className="px-3 py-2 text-right text-emerald-700">{row.entradas > 0 ? row.entradas : "-"}</td>
                    <td className="px-3 py-2 text-right text-rose-700">{row.salidas > 0 ? row.salidas : "-"}</td>
                    <td className="px-3 py-2 text-right font-medium">{row.saldo}</td>
                    <td className="px-3 py-2 text-right">{row.costoPromedio > 0 ? formatCOP(row.costoPromedio) : "-"}</td>
                    <td className="px-3 py-2 text-right font-medium">{row.valorInventario > 0 ? formatCOP(row.valorInventario) : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
