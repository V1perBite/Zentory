"use client";

import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatCOP } from "@/lib/invoice-calculations";
import { PackageOpen, DollarSign } from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend
} from "recharts";

type ProductoValoracion = {
  id: string;
  nombre: string;
  sku_code: string;
  stock_actual: number;
  precio_costo: number;
  valor_total: number;
};

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#ec4899', '#84cc16', '#14b8a6'];

export function ValoracionInventarioClient() {
  const supabase = createClient();
  const [data, setData] = useState<ProductoValoracion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      
      const { data: productos, error } = await supabase
        .from("productos")
        .select("id, nombre, sku_code, stock_actual, precio_costo")
        .eq("activo", true)
        .gt("stock_actual", 0);

      if (error) {
        console.error("Error fetching data:", error);
      } else {
        const mapeado = (productos as ProductoValoracion[]).map(p => ({
          ...p,
          valor_total: p.stock_actual * p.precio_costo
        }));
        // Ordenar por valor
        mapeado.sort((a, b) => b.valor_total - a.valor_total);
        setData(mapeado);
      }
      setLoading(false);
    };

    fetchData();
  }, [supabase]);

  const totalCapital = data.reduce((sum, item) => sum + item.valor_total, 0);
  const totalUnidades = data.reduce((sum, item) => sum + item.stock_actual, 0);

  const chartData = useMemo(() => {
    if (data.length <= 10) return data;
    
    const top10 = data.slice(0, 9);
    const otros = data.slice(9).reduce((sum, item) => sum + item.valor_total, 0);
    
    return [
      ...top10,
      { nombre: "Otros", valor_total: otros }
    ];
  }, [data]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-emerald-200 shadow-sm flex flex-col">
          <div className="flex items-center gap-3 mb-3 text-emerald-700">
            <div className="p-2 bg-emerald-100 rounded-lg">
              <DollarSign className="w-5 h-5" />
            </div>
            <span className="text-sm font-medium">Capital Invertido Total</span>
          </div>
          <p className="text-3xl font-bold text-emerald-900 mt-auto">{formatCOP(totalCapital)}</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
          <div className="flex items-center gap-3 mb-3 text-slate-500">
            <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
              <PackageOpen className="w-5 h-5" />
            </div>
            <span className="text-sm font-medium">Unidades en Stock</span>
          </div>
          <p className="text-3xl font-bold text-slate-900 mt-auto">{totalUnidades}</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col">
          <h3 className="text-sm font-semibold mb-6 text-slate-800">Distribución de Capital (Top 10)</h3>
          
          <div className="h-[300px] w-full flex-1">
            {loading ? (
              <div className="flex h-full items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
              </div>
            ) : data.length === 0 ? (
              <div className="flex h-full items-center justify-center text-slate-400">Sin inventario valorizado</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={2}
                    dataKey="valor_total"
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: any) => [formatCOP(Number(value)), "Valor"]}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-sm font-semibold mb-4 text-slate-800">Desglose por Producto</h3>
          
          <div className="w-full">
            {loading ? (
              <div className="flex h-[200px] items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
              </div>
            ) : data.length === 0 ? (
              <div className="flex h-[200px] items-center justify-center text-slate-500">
                No hay productos activos con stock.
              </div>
            ) : (
              <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                <table className="min-w-full text-sm text-left relative">
                  <thead className="bg-slate-50 text-slate-500 sticky top-0 z-10 shadow-sm">
                    <tr>
                      <th className="px-4 py-3 font-medium">Producto</th>
                      <th className="px-4 py-3 font-medium text-center">SKU</th>
                      <th className="px-4 py-3 font-medium text-right">Stock</th>
                      <th className="px-4 py-3 font-medium text-right">Costo Unitario</th>
                      <th className="px-4 py-3 font-medium text-right text-emerald-700">Valor Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/50">
                        <td className="px-4 py-3 font-medium text-slate-700">{item.nombre}</td>
                        <td className="px-4 py-3 text-center text-slate-500">{item.sku_code || "-"}</td>
                        <td className="px-4 py-3 text-right">{item.stock_actual}</td>
                        <td className="px-4 py-3 text-right text-slate-600">{formatCOP(item.precio_costo)}</td>
                        <td className="px-4 py-3 text-right font-semibold text-emerald-600">{formatCOP(item.valor_total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
