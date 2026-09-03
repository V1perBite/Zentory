"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatCOP } from "@/lib/invoice-calculations";
import { AlertCircle } from "lucide-react";
import Link from "next/link";

type ProductoBajoStock = {
  id: string;
  nombre: string;
  sku_code: string;
  stock_actual: number;
  minimo_stock: number;
  precio_costo: number;
};

export function BajoStockClient() {
  const supabase = createClient();
  const [data, setData] = useState<ProductoBajoStock[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      
      const { data: productos, error } = await supabase
        .from("productos")
        .select("id, nombre, sku_code, stock_actual, minimo_stock, precio_costo")
        .eq("activo", true)
        .lte("stock_actual", 1000000); // we will filter in JS since we need to compare columns, wait, Supabase might not easily compare two columns without raw SQL or a view. So we fetch all and filter in JS.

      if (error) {
        console.error("Error fetching data:", error);
      } else {
        // Filtramos donde stock_actual <= minimo_stock
        const filtrados = (productos as ProductoBajoStock[]).filter(
          (p) => p.stock_actual <= p.minimo_stock
        );
        // Ordenamos por los más críticos (mayor diferencia)
        filtrados.sort((a, b) => (a.stock_actual - a.minimo_stock) - (b.stock_actual - b.minimo_stock));
        setData(filtrados);
      }
      setLoading(false);
    };

    fetchData();
  }, [supabase]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-500" />
            Productos a Reabastecer ({data.length})
          </h2>
          <p className="text-xs text-slate-500 mt-1">Comparando el stock actual con el mínimo configurado</p>
        </div>
        
        <Link 
          href="/inventario"
          className="rounded bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700 transition-colors self-start"
        >
          Gestionar Inventario
        </Link>
      </div>

      <div className="w-full">
        {loading ? (
          <div className="flex h-[200px] items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
          </div>
        ) : data.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[200px] text-slate-500 gap-3">
            <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            </div>
            <p>¡Todo en orden! Ningún producto está por debajo del mínimo.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Producto</th>
                  <th className="px-4 py-3 font-medium text-center">SKU</th>
                  <th className="px-4 py-3 font-medium text-right text-red-600">Stock Actual</th>
                  <th className="px-4 py-3 font-medium text-right">Stock Mínimo</th>
                  <th className="px-4 py-3 font-medium text-right">Déficit</th>
                  <th className="px-4 py-3 font-medium text-right">Inversión Estimada</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.map((item) => {
                  const deficit = Math.max(0, item.minimo_stock - item.stock_actual);
                  const inversion = deficit * item.precio_costo;
                  
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/50">
                      <td className="px-4 py-3 font-medium text-slate-700">{item.nombre}</td>
                      <td className="px-4 py-3 text-center text-slate-500">{item.sku_code || "-"}</td>
                      <td className="px-4 py-3 text-right">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800">
                          {item.stock_actual}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-slate-600">{item.minimo_stock}</td>
                      <td className="px-4 py-3 text-right font-medium text-amber-600">-{deficit}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{formatCOP(inversion)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
