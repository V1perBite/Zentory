"use client";

import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { format, subDays, startOfDay, endOfDay, parseISO } from "date-fns";
import { formatCOP } from "@/lib/invoice-calculations";

type ProductoRentabilidad = {
  nombre: string;
  unidades: number;
  ingresos: number;
  costos: number;
  utilidad: number;
  margen: number;
};

export function RentabilidadClient() {
  const supabase = createClient();
  const [data, setData] = useState<ProductoRentabilidad[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Por defecto últimos 30 días
  const [fechaInicio, setFechaInicio] = useState(format(subDays(new Date(), 30), "yyyy-MM-dd"));
  const [fechaFin, setFechaFin] = useState(format(new Date(), "yyyy-MM-dd"));
  const [orden, setOrden] = useState<"utilidad" | "margen">("utilidad");

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      
      const start = startOfDay(parseISO(fechaInicio)).toISOString();
      const end = endOfDay(parseISO(fechaFin)).toISOString();

      const { data: facturasItems, error } = await supabase
        .from("factura_items")
        .select(`
          cantidad,
          subtotal,
          producto:productos(nombre, precio_costo),
          factura:facturas!inner(estado, created_at)
        `)
        .eq("factura.estado", "impresa")
        .gte("factura.created_at", start)
        .lte("factura.created_at", end);

      if (error) {
        console.error("Error fetching data:", error);
      } else {
        const map = new Map<string, ProductoRentabilidad>();
        
        for (const item of (facturasItems ?? []) as any[]) {
          const prod = Array.isArray(item.producto) ? item.producto[0] : item.producto;
          const nombre = prod?.nombre || "Desconocido";
          const precioCosto = Number(prod?.precio_costo || 0);
            
          const prev = map.get(nombre) || { nombre, unidades: 0, ingresos: 0, costos: 0, utilidad: 0, margen: 0 };
          const unidades = prev.unidades + item.cantidad;
          const ingresos = prev.ingresos + Number(item.subtotal);
          const costos = prev.costos + (item.cantidad * precioCosto);
          const utilidad = ingresos - costos;
          const margen = ingresos > 0 ? (utilidad / ingresos) * 100 : 0;

          map.set(nombre, {
            nombre,
            unidades,
            ingresos,
            costos,
            utilidad,
            margen
          });
        }
        
        setData(Array.from(map.values()));
      }
      setLoading(false);
    };

    fetchData();
  }, [fechaInicio, fechaFin, supabase]);

  const sortedData = useMemo(() => {
    return [...data].sort((a, b) => b[orden] - a[orden]);
  }, [data, orden]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Rentabilidad por Producto</h2>
          <p className="text-xs text-slate-500">Métricas de utilidad y margen</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select 
            value={orden}
            onChange={(e) => setOrden(e.target.value as "utilidad" | "margen")}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
          >
            <option value="utilidad">Mayor Utilidad ($)</option>
            <option value="margen">Mayor Margen (%)</option>
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
            No hay datos para este período.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Producto</th>
                  <th className="px-4 py-3 font-medium text-right">Unidades</th>
                  <th className="px-4 py-3 font-medium text-right">Ingresos</th>
                  <th className="px-4 py-3 font-medium text-right">Costo Estimado</th>
                  <th className="px-4 py-3 font-medium text-right text-emerald-700">Utilidad Bruta</th>
                  <th className="px-4 py-3 font-medium text-right">Margen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sortedData.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3 font-medium text-slate-700">{item.nombre}</td>
                    <td className="px-4 py-3 text-right">{item.unidades}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{formatCOP(item.ingresos)}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{formatCOP(item.costos)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-emerald-600">{formatCOP(item.utilidad)}</td>
                    <td className="px-4 py-3 text-right font-semibold">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        item.margen > 40 ? 'bg-emerald-100 text-emerald-800' :
                        item.margen > 20 ? 'bg-amber-100 text-amber-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {item.margen.toFixed(1)}%
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
