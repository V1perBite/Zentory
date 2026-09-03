"use client";

import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { format, subDays, startOfDay, endOfDay, parseISO } from "date-fns";
import { RefreshCw } from "lucide-react";

type ProductoRotacion = {
  id: string;
  nombre: string;
  stock_actual: number;
  unidades_vendidas: number;
  indice_rotacion: number;
};

export function RotacionClient() {
  const supabase = createClient();
  const [data, setData] = useState<ProductoRotacion[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Por defecto últimos 30 días
  const [fechaInicio, setFechaInicio] = useState(format(subDays(new Date(), 30), "yyyy-MM-dd"));
  const [fechaFin, setFechaFin] = useState(format(new Date(), "yyyy-MM-dd"));
  const [orden, setOrden] = useState<"alta" | "baja">("alta");

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      
      const start = startOfDay(parseISO(fechaInicio)).toISOString();
      const end = endOfDay(parseISO(fechaFin)).toISOString();

      // 1. Obtener productos activos
      const { data: productos, error: errProd } = await supabase
        .from("productos")
        .select("id, nombre, stock_actual")
        .eq("activo", true);

      // 2. Obtener ventas en el periodo
      const { data: facturasItems, error: errVentas } = await supabase
        .from("factura_items")
        .select(`
          producto_id,
          cantidad,
          factura:facturas!inner(estado, created_at)
        `)
        .eq("factura.estado", "impresa")
        .gte("factura.created_at", start)
        .lte("factura.created_at", end);

      if (errProd || errVentas) {
        console.error("Error fetching data:", errProd || errVentas);
      } else {
        const ventasMap = new Map<string, number>();
        for (const item of (facturasItems ?? []) as any[]) {
          const pid = item.producto_id;
          ventasMap.set(pid, (ventasMap.get(pid) || 0) + item.cantidad);
        }

        const rotacion = (productos ?? []).map(p => {
          const vendidas = ventasMap.get(p.id) || 0;
          // Índice simple: vendidas / (stock_actual + vendidas/2) -> aprox stock promedio
          // Para simplificar: si vendí 100 y me quedan 50, mi rotacion es alta.
          // Usaremos el % de ventas respecto al stock disponible inicial estimado (stock actual + vendidas)
          const stockInicialEstimado = p.stock_actual + vendidas;
          const indice = stockInicialEstimado > 0 ? (vendidas / stockInicialEstimado) * 100 : 0;

          return {
            id: p.id,
            nombre: p.nombre,
            stock_actual: p.stock_actual,
            unidades_vendidas: vendidas,
            indice_rotacion: indice
          };
        });
        
        setData(rotacion);
      }
      setLoading(false);
    };

    fetchData();
  }, [fechaInicio, fechaFin, supabase]);

  const sortedData = useMemo(() => {
    return [...data].sort((a, b) => {
      if (orden === "alta") return b.indice_rotacion - a.indice_rotacion;
      return a.indice_rotacion - b.indice_rotacion;
    });
  }, [data, orden]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-cyan-500" />
            Análisis de Rotación
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Índice = Ventas / (Stock Actual + Ventas) * 100
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select 
            value={orden}
            onChange={(e) => setOrden(e.target.value as "alta" | "baja")}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
          >
            <option value="alta">Mayor Rotación (Alta Demanda)</option>
            <option value="baja">Menor Rotación (Stock Estancado)</option>
          </select>
          
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

      <div className="w-full">
        {loading ? (
          <div className="flex h-[200px] items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
          </div>
        ) : sortedData.length === 0 ? (
          <div className="flex h-[200px] items-center justify-center text-slate-500">
            No hay productos activos.
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
            <table className="min-w-full text-sm text-left relative">
              <thead className="bg-slate-50 text-slate-500 sticky top-0 z-10 shadow-sm">
                <tr>
                  <th className="px-4 py-3 font-medium">Producto</th>
                  <th className="px-4 py-3 font-medium text-right">Unidades Vendidas</th>
                  <th className="px-4 py-3 font-medium text-right">Stock Actual</th>
                  <th className="px-4 py-3 font-medium text-right text-cyan-700">Índice de Rotación</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sortedData.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3 font-medium text-slate-700">{item.nombre}</td>
                    <td className="px-4 py-3 text-right font-medium text-emerald-600">{item.unidades_vendidas}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{item.stock_actual}</td>
                    <td className="px-4 py-3 text-right font-semibold">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        item.indice_rotacion > 50 ? 'bg-emerald-100 text-emerald-800' :
                        item.indice_rotacion > 10 ? 'bg-amber-100 text-amber-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {item.indice_rotacion.toFixed(1)}%
                      </span>
                    </td>
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
