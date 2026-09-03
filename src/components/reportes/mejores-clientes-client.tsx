"use client";

import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { format, subDays, startOfDay, endOfDay, parseISO } from "date-fns";
import { formatCOP } from "@/lib/invoice-calculations";
import { Star } from "lucide-react";

type ClienteRendimiento = {
  id: string;
  nombre: string;
  documento: string;
  facturas: number;
  totalComprado: number;
};

export function MejoresClientesClient() {
  const supabase = createClient();
  const [data, setData] = useState<ClienteRendimiento[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [fechaInicio, setFechaInicio] = useState(format(subDays(new Date(), 90), "yyyy-MM-dd"));
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
          cliente:clientes(id, nombre, numero_documento)
        `)
        .eq("estado", "impresa")
        .gte("created_at", start)
        .lte("created_at", end);

      if (error) {
        console.error("Error fetching data:", error);
      } else {
        const map = new Map<string, ClienteRendimiento>();
        
        for (const item of (facturas ?? []) as any[]) {
          const cli = Array.isArray(item.cliente) ? item.cliente[0] : item.cliente;
          
          if (!cli) continue;
          
          const id = cli.id;
          const prev = map.get(id) || { 
            id, 
            nombre: cli.nombre, 
            documento: cli.numero_documento, 
            facturas: 0, 
            totalComprado: 0 
          };
          
          map.set(id, {
            ...prev,
            facturas: prev.facturas + 1,
            totalComprado: prev.totalComprado + Number(item.total)
          });
        }
        
        setData(Array.from(map.values()));
      }
      setLoading(false);
    };

    fetchData();
  }, [fechaInicio, fechaFin, supabase]);

  const sortedData = useMemo(() => {
    return [...data].sort((a, b) => b.totalComprado - a.totalComprado).slice(0, 50); // Top 50
  }, [data]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Star className="h-5 w-5 text-yellow-500" />
            Top 50 Clientes
          </h2>
          <p className="text-xs text-slate-500 mt-1">Identifica a los clientes que más ingresos generan</p>
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

      <div className="w-full">
        {loading ? (
          <div className="flex h-[200px] items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
          </div>
        ) : sortedData.length === 0 ? (
          <div className="flex h-[200px] items-center justify-center text-slate-500">
            No hay compras de clientes registrados en este período.
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
            <table className="min-w-full text-sm text-left relative">
              <thead className="bg-slate-50 text-slate-500 sticky top-0 z-10 shadow-sm">
                <tr>
                  <th className="px-4 py-3 font-medium">#</th>
                  <th className="px-4 py-3 font-medium">Cliente</th>
                  <th className="px-4 py-3 font-medium">Documento</th>
                  <th className="px-4 py-3 font-medium text-right">Facturas</th>
                  <th className="px-4 py-3 font-medium text-right text-yellow-700">Total Comprado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sortedData.map((item, idx) => (
                  <tr key={item.id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3 text-slate-400 font-medium">{idx + 1}</td>
                    <td className="px-4 py-3 font-medium text-slate-700">{item.nombre}</td>
                    <td className="px-4 py-3 text-slate-500">{item.documento}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{item.facturas}</td>
                    <td className="px-4 py-3 text-right font-bold text-slate-900">{formatCOP(item.totalComprado)}</td>
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
