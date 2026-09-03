"use client";

import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { format, subDays, startOfDay, endOfDay, parseISO } from "date-fns";
import { formatCOP } from "@/lib/invoice-calculations";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from "recharts";

type VendedorRendimiento = {
  nombre: string;
  facturas: number;
  totalVendido: number;
  promedio: number;
};

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316'];

export function VentasVendedorClient() {
  const supabase = createClient();
  const [data, setData] = useState<VendedorRendimiento[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [fechaInicio, setFechaInicio] = useState(format(subDays(new Date(), 30), "yyyy-MM-dd"));
  const [fechaFin, setFechaFin] = useState(format(new Date(), "yyyy-MM-dd"));

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      
      const start = startOfDay(parseISO(fechaInicio)).toISOString();
      const end = endOfDay(parseISO(fechaFin)).toISOString();

      const { data: facturas, error } = await supabase
        .from("facturas")
        .select(`
          total,
          vendedor:usuarios(nombre)
        `)
        .eq("estado", "impresa")
        .gte("created_at", start)
        .lte("created_at", end);

      if (error) {
        console.error("Error fetching data:", error);
      } else {
        const map = new Map<string, VendedorRendimiento>();
        
        for (const item of (facturas ?? []) as any[]) {
          const nombre = Array.isArray(item.vendedor) 
            ? (item.vendedor[0]?.nombre || "Desconocido") 
            : (item.vendedor?.nombre || "Desconocido");
            
          const prev = map.get(nombre) || { nombre, facturas: 0, totalVendido: 0, promedio: 0 };
          
          map.set(nombre, {
            nombre,
            facturas: prev.facturas + 1,
            totalVendido: prev.totalVendido + Number(item.total),
            promedio: 0
          });
        }
        
        const result = Array.from(map.values()).map(v => ({
          ...v,
          promedio: v.totalVendido / v.facturas
        }));
        
        setData(result);
      }
      setLoading(false);
    };

    fetchData();
  }, [fechaInicio, fechaFin, supabase]);

  const sortedData = useMemo(() => {
    return [...data].sort((a, b) => b.totalVendido - a.totalVendido);
  }, [data]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Ventas por Vendedor</h2>
          <p className="text-xs text-slate-500">Volumen de ventas y transacciones por usuario</p>
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

      <div className="grid lg:grid-cols-2 gap-8">
        <div className="h-[300px]">
          {loading ? (
             <div className="flex h-full items-center justify-center">
               <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
             </div>
          ) : sortedData.length === 0 ? (
             <div className="flex h-full items-center justify-center text-slate-500">No hay datos</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sortedData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="nombre" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 12 }}
                  tickFormatter={(val) => `$${val/1000}k`}
                />
                <Tooltip 
                  formatter={(value: any) => [formatCOP(Number(value)), "Ventas Totales"]}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="totalVendido" radius={[4, 4, 0, 0]}>
                  {sortedData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
        
        <div className="overflow-x-auto">
          {loading ? (
             <div className="flex h-[300px] items-center justify-center">
               <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
             </div>
          ) : (
            <table className="min-w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Vendedor</th>
                  <th className="px-4 py-3 font-medium text-right">Facturas</th>
                  <th className="px-4 py-3 font-medium text-right">Promedio Ticket</th>
                  <th className="px-4 py-3 font-medium text-right text-indigo-600">Total Vendido</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sortedData.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3 font-medium text-slate-700 flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></div>
                      {item.nombre}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-600">{item.facturas}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{formatCOP(item.promedio)}</td>
                    <td className="px-4 py-3 text-right font-bold text-slate-900">{formatCOP(item.totalVendido)}</td>
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
