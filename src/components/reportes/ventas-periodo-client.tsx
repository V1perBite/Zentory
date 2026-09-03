"use client";

import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { format, subDays, startOfDay, endOfDay, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from "recharts";
import { formatCOP } from "@/lib/invoice-calculations";

type Factura = {
  id: string;
  total: number;
  created_at: string;
};

export function VentasPeriodoClient() {
  const supabase = createClient();
  const [data, setData] = useState<Factura[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Por defecto últimos 30 días
  const [fechaInicio, setFechaInicio] = useState(format(subDays(new Date(), 30), "yyyy-MM-dd"));
  const [fechaFin, setFechaFin] = useState(format(new Date(), "yyyy-MM-dd"));

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      
      const start = startOfDay(parseISO(fechaInicio)).toISOString();
      const end = endOfDay(parseISO(fechaFin)).toISOString();

      const { data: facturas, error } = await supabase
        .from("facturas")
        .select("id, total, created_at")
        .eq("estado", "impresa")
        .gte("created_at", start)
        .lte("created_at", end)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Error fetching data:", error);
      } else {
        setData(facturas || []);
      }
      setLoading(false);
    };

    fetchData();
  }, [fechaInicio, fechaFin, supabase]);

  const chartData = useMemo(() => {
    // Agrupar por día
    const grouped = data.reduce((acc, curr) => {
      const date = format(parseISO(curr.created_at), "dd MMM", { locale: es });
      if (!acc[date]) {
        acc[date] = 0;
      }
      acc[date] += curr.total;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(grouped).map(([date, total]) => ({
      date,
      total,
    }));
  }, [data]);

  const totalVentas = data.reduce((sum, f) => sum + f.total, 0);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Resumen de Ventas</h2>
          <p className="text-3xl font-bold text-indigo-600 mt-2">{formatCOP(totalVentas)}</p>
          <p className="text-xs text-slate-500">Total en el período seleccionado</p>
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

      <div className="h-[400px] w-full">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
          </div>
        ) : chartData.length === 0 ? (
          <div className="flex h-full items-center justify-center text-slate-500">
            No hay datos de ventas para este período.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis 
                dataKey="date" 
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#64748b', fontSize: 12 }}
                dy={10}
              />
              <YAxis 
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#64748b', fontSize: 12 }}
                tickFormatter={(value) => `$${(value / 1000)}k`}
                dx={-10}
              />
              <Tooltip 
                formatter={(value: any) => [formatCOP(Number(value) || 0), "Ventas"]}
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
              />
              <Area 
                type="monotone" 
                dataKey="total" 
                stroke="#4f46e5" 
                strokeWidth={3}
                fillOpacity={1} 
                fill="url(#colorTotal)" 
                activeDot={{ r: 6, fill: '#4f46e5', stroke: '#fff', strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
