"use client";

import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { format, subDays, startOfDay, endOfDay, parseISO } from "date-fns";
import { formatCOP } from "@/lib/invoice-calculations";
import { FileMinus } from "lucide-react";

type Merma = {
  id: string;
  producto_id: string;
  nombre_producto: string;
  cantidad: number;
  motivo: string;
  costo_unitario: number;
  created_at: string;
  perdida_total: number;
};

export function MermasClient() {
  const supabase = createClient();
  const [data, setData] = useState<Merma[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Por defecto últimos 30 días
  const [fechaInicio, setFechaInicio] = useState(format(subDays(new Date(), 30), "yyyy-MM-dd"));
  const [fechaFin, setFechaFin] = useState(format(new Date(), "yyyy-MM-dd"));

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      
      const start = startOfDay(parseISO(fechaInicio)).toISOString();
      const end = endOfDay(parseISO(fechaFin)).toISOString();

      const { data: movimientos, error } = await supabase
        .from("movimientos_stock")
        .select(`
          id,
          producto_id,
          cantidad,
          motivo,
          costo_unitario,
          created_at,
          producto:productos(nombre)
        `)
        .eq("tipo", "ajuste")
        .lt("cantidad", 0) // Solo mermas (ajustes negativos)
        .gte("created_at", start)
        .lte("created_at", end)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching data:", error);
      } else {
        const result = (movimientos ?? []).map((m: any) => ({
          id: m.id,
          producto_id: m.producto_id,
          nombre_producto: Array.isArray(m.producto) ? m.producto[0]?.nombre : m.producto?.nombre,
          cantidad: Math.abs(m.cantidad),
          motivo: m.motivo,
          costo_unitario: m.costo_unitario || 0,
          created_at: m.created_at,
          perdida_total: Math.abs(m.cantidad) * (m.costo_unitario || 0)
        }));
        
        setData(result);
      }
      setLoading(false);
    };

    fetchData();
  }, [fechaInicio, fechaFin, supabase]);

  const totalPerdidas = data.reduce((sum, item) => sum + item.perdida_total, 0);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <FileMinus className="h-5 w-5 text-rose-500" />
            Registro de Mermas
          </h2>
          <p className="text-xs text-slate-500 mt-1">Impacto financiero de pérdidas y ajustes negativos</p>
        </div>

        <div className="flex items-center gap-3">
          <input
            type="date"
            value={fechaInicio}
            onChange={(e) => setFechaInicio(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <span className="text-slate-400">-</span>
          <input
            type="date"
            value={fechaFin}
            onChange={(e) => setFechaFin(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="mb-6 rounded-xl border border-rose-200 bg-rose-50 p-4 max-w-sm">
        <p className="text-xs text-rose-700">Total en Pérdidas (Costo)</p>
        <p className="mt-1 text-2xl font-bold text-rose-800">{formatCOP(totalPerdidas)}</p>
      </div>

      <div className="w-full">
        {loading ? (
          <div className="flex h-[200px] items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-rose-200 border-t-rose-600" />
          </div>
        ) : data.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[200px] text-slate-500 gap-3">
            <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            </div>
            <p>¡Excelente! No hay mermas registradas en este período.</p>
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
            <table className="min-w-full text-sm text-left relative">
              <thead className="bg-slate-50 text-slate-500 sticky top-0 z-10 shadow-sm">
                <tr>
                  <th className="px-4 py-3 font-medium">Fecha</th>
                  <th className="px-4 py-3 font-medium">Producto</th>
                  <th className="px-4 py-3 font-medium">Motivo</th>
                  <th className="px-4 py-3 font-medium text-right">Cantidad</th>
                  <th className="px-4 py-3 font-medium text-right text-rose-700">Pérdida (Costo)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3 text-slate-500">{format(parseISO(item.created_at), "dd/MM/yyyy HH:mm")}</td>
                    <td className="px-4 py-3 font-medium text-slate-700">{item.nombre_producto}</td>
                    <td className="px-4 py-3 text-slate-600">{item.motivo}</td>
                    <td className="px-4 py-3 text-right">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-rose-100 text-rose-800">
                        -{item.cantidad}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-rose-600">{formatCOP(item.perdida_total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
