"use client";

import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { format, subDays, startOfDay, endOfDay, parseISO } from "date-fns";
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
import { formatCOP } from "@/lib/invoice-calculations";

type ProductoAgrupado = {
  nombre: string;
  unidades: number;
  ingresos: number;
};

export function ProductosTopClient() {
  const supabase = createClient();
  const [data, setData] = useState<ProductoAgrupado[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Por defecto últimos 30 días
  const [fechaInicio, setFechaInicio] = useState(format(subDays(new Date(), 30), "yyyy-MM-dd"));
  const [fechaFin, setFechaFin] = useState(format(new Date(), "yyyy-MM-dd"));
  const [orden, setOrden] = useState<"unidades" | "ingresos">("unidades");

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
          producto:productos(nombre),
          factura:facturas!inner(estado, created_at)
        `)
        .eq("factura.estado", "impresa")
        .gte("factura.created_at", start)
        .lte("factura.created_at", end);

      if (error) {
        console.error("Error fetching data:", error);
      } else {
        const map = new Map<string, ProductoAgrupado>();
        
        for (const item of (facturasItems ?? []) as any[]) {
          const nombre = Array.isArray(item.producto) 
            ? (item.producto[0]?.nombre || "-") 
            : (item.producto?.nombre || "-");
            
          const prev = map.get(nombre) || { nombre, unidades: 0, ingresos: 0 };
          map.set(nombre, {
            nombre,
            unidades: prev.unidades + item.cantidad,
            ingresos: prev.ingresos + Number(item.subtotal)
          });
        }
        
        setData(Array.from(map.values()));
      }
      setLoading(false);
    };

    fetchData();
  }, [fechaInicio, fechaFin, supabase]);

  const chartData = useMemo(() => {
    return [...data]
      .sort((a, b) => b[orden] - a[orden])
      .slice(0, 10); // Top 10
  }, [data, orden]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Top 10 Productos</h2>
          <p className="text-xs text-slate-500">Métricas de rendimiento por producto</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select 
            value={orden}
            onChange={(e) => setOrden(e.target.value as "unidades" | "ingresos")}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
          >
            <option value="unidades">Más unidades vendidas</option>
            <option value="ingresos">Mayor ingreso generado</option>
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

      <div className="h-[400px] w-full">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
          </div>
        ) : chartData.length === 0 ? (
          <div className="flex h-full items-center justify-center text-slate-500">
            No hay datos de productos vendidos para este período.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart 
              data={chartData} 
              layout="vertical"
              margin={{ top: 10, right: 30, left: 100, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
              <XAxis 
                type="number" 
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#64748b', fontSize: 12 }}
                tickFormatter={(val) => orden === "ingresos" ? `$${val / 1000}k` : val}
              />
              <YAxis 
                type="category" 
                dataKey="nombre" 
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#475569', fontSize: 12, fontWeight: 500 }}
                width={120}
              />
              <Tooltip 
                cursor={{ fill: '#f8fafc' }}
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                formatter={(value: any) => [
                  orden === "ingresos" ? formatCOP(Number(value) || 0) : `${value} uds`, 
                  orden === "ingresos" ? "Ingresos" : "Unidades"
                ]}
              />
              <Bar 
                dataKey={orden} 
                radius={[0, 4, 4, 0]}
                barSize={24}
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={orden === "ingresos" ? "#10b981" : "#3b82f6"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
