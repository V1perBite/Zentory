"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { format, startOfDay, endOfDay, parseISO } from "date-fns";
import { formatCOP } from "@/lib/invoice-calculations";
import { FileText, Receipt, TrendingUp, Users } from "lucide-react";

type FacturaCorte = {
  id: string;
  numero_factura: number;
  total: number;
  created_at: string;
  vendedor: { nombre: string } | { nombre: string }[];
};

export function CorteCajaClient() {
  const supabase = createClient();
  const [data, setData] = useState<FacturaCorte[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Por defecto el día de hoy
  const [fecha, setFecha] = useState(format(new Date(), "yyyy-MM-dd"));

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      
      const start = startOfDay(parseISO(fecha)).toISOString();
      const end = endOfDay(parseISO(fecha)).toISOString();

      const { data: facturas, error } = await supabase
        .from("facturas")
        .select(`
          id, 
          numero_factura, 
          total, 
          created_at,
          vendedor:usuarios(nombre)
        `)
        .eq("estado", "impresa")
        .gte("created_at", start)
        .lte("created_at", end)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching data:", error);
      } else {
        setData((facturas as any) || []);
      }
      setLoading(false);
    };

    fetchData();
  }, [fecha, supabase]);

  const totalVentas = data.reduce((sum, f) => sum + f.total, 0);
  const numFacturas = data.length;
  const ticketPromedio = numFacturas > 0 ? totalVentas / numFacturas : 0;
  
  // Encontrar el vendedor con más ventas hoy
  const vendedoresMap = data.reduce((acc, curr) => {
    const nombre = Array.isArray(curr.vendedor) ? curr.vendedor[0]?.nombre : curr.vendedor?.nombre;
    const key = nombre || "Desconocido";
    acc[key] = (acc[key] || 0) + curr.total;
    return acc;
  }, {} as Record<string, number>);
  
  const mejorVendedor = Object.entries(vendedoresMap).sort((a, b) => b[1] - a[1])[0];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm w-max">
        <label htmlFor="fecha-corte" className="text-sm font-medium text-slate-700">Seleccionar Día:</label>
        <input
          id="fecha-corte"
          type="date"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm bg-slate-50"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
          <div className="flex items-center gap-3 mb-3 text-slate-500">
            <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg">
              <TrendingUp className="w-5 h-5" />
            </div>
            <span className="text-sm font-medium">Total Ingresos</span>
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-auto">{formatCOP(totalVentas)}</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
          <div className="flex items-center gap-3 mb-3 text-slate-500">
            <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
              <FileText className="w-5 h-5" />
            </div>
            <span className="text-sm font-medium">Facturas Emitidas</span>
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-auto">{numFacturas}</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
          <div className="flex items-center gap-3 mb-3 text-slate-500">
            <div className="p-2 bg-purple-100 text-purple-600 rounded-lg">
              <Receipt className="w-5 h-5" />
            </div>
            <span className="text-sm font-medium">Ticket Promedio</span>
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-auto">{formatCOP(ticketPromedio)}</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
          <div className="flex items-center gap-3 mb-3 text-slate-500">
            <div className="p-2 bg-amber-100 text-amber-600 rounded-lg">
              <Users className="w-5 h-5" />
            </div>
            <span className="text-sm font-medium">Mejor Vendedor</span>
          </div>
          <p className="text-lg font-bold text-slate-900 mt-auto line-clamp-1">{mejorVendedor ? mejorVendedor[0] : "-"}</p>
          <p className="text-xs text-slate-500">{mejorVendedor ? formatCOP(mejorVendedor[1]) : ""}</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-200">
          <h3 className="text-base font-semibold text-slate-900">Desglose de Facturas del Día</h3>
        </div>
        
        {loading ? (
          <div className="p-8 flex justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" />
          </div>
        ) : data.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-sm">
            No hay facturas registradas en esta fecha.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-medium">Hora</th>
                  <th className="px-5 py-3 font-medium">Factura #</th>
                  <th className="px-5 py-3 font-medium">Vendedor</th>
                  <th className="px-5 py-3 font-medium text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.map((factura) => (
                  <tr key={factura.id} className="hover:bg-slate-50/50">
                    <td className="px-5 py-3 text-slate-500">
                      {format(parseISO(factura.created_at), "HH:mm")}
                    </td>
                    <td className="px-5 py-3 font-medium text-indigo-600">
                      #{factura.numero_factura}
                    </td>
                    <td className="px-5 py-3">
                      {Array.isArray(factura.vendedor) ? factura.vendedor[0]?.nombre : factura.vendedor?.nombre}
                    </td>
                    <td className="px-5 py-3 font-semibold text-right">
                      {formatCOP(factura.total)}
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
