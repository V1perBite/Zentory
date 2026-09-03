"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { format, parseISO } from "date-fns";
import { formatCOP } from "@/lib/invoice-calculations";
import { History, Search } from "lucide-react";

type Cliente = {
  id: string;
  nombre: string;
  numero_documento: string;
};

type FacturaHistorial = {
  id: string;
  numero_factura: number;
  total: number;
  created_at: string;
  items: {
    cantidad: number;
    subtotal: number;
    producto: {
      nombre: string;
    };
  }[];
};

export function HistorialClienteClient() {
  const supabase = createClient();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [clienteSeleccionado, setClienteSeleccionado] = useState<string>("");
  const [facturas, setFacturas] = useState<FacturaHistorial[]>([]);
  
  const [loadingClientes, setLoadingClientes] = useState(true);
  const [loadingHistorial, setLoadingHistorial] = useState(false);

  // Cargar clientes
  useEffect(() => {
    const fetchClientes = async () => {
      setLoadingClientes(true);
      const { data, error } = await supabase
        .from("clientes")
        .select("id, nombre, numero_documento")
        .order("nombre");

      if (!error && data) {
        setClientes(data);
        if (data.length > 0) {
          setClienteSeleccionado(data[0].id);
        }
      }
      setLoadingClientes(false);
    };

    fetchClientes();
  }, [supabase]);

  // Cargar historial del cliente seleccionado
  useEffect(() => {
    if (!clienteSeleccionado) return;

    const fetchHistorial = async () => {
      setLoadingHistorial(true);
      
      const { data, error } = await supabase
        .from("facturas")
        .select(`
          id,
          numero_factura,
          total,
          created_at,
          items:factura_items(
            cantidad,
            subtotal,
            producto:productos(nombre)
          )
        `)
        .eq("cliente_id", clienteSeleccionado)
        .eq("estado", "impresa")
        .order("created_at", { ascending: false });

      if (!error) {
        setData(data as any);
      }
      setLoadingHistorial(false);
    };

    fetchHistorial();
  }, [clienteSeleccionado, supabase]);

  const setData = (data: any) => {
      setFacturas(data || []);
  };

  const totalComprado = facturas.reduce((sum, f) => sum + f.total, 0);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4">
          <label htmlFor="cliente-select" className="block text-sm font-medium text-slate-700 mb-2">
            Seleccionar Cliente
          </label>
          <div className="relative max-w-md">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-slate-400" />
            </div>
            <select
              id="cliente-select"
              value={clienteSeleccionado}
              onChange={(e) => setClienteSeleccionado(e.target.value)}
              disabled={loadingClientes}
              className="block w-full pl-10 pr-3 py-2 text-base border border-slate-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-lg bg-white"
            >
              {loadingClientes ? (
                <option>Cargando clientes...</option>
              ) : clientes.length === 0 ? (
                <option>No hay clientes registrados</option>
              ) : (
                clientes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre} {c.numero_documento ? `(${c.numero_documento})` : ""}
                  </option>
                ))
              )}
            </select>
          </div>
        </div>

        {clienteSeleccionado && (
          <div className="grid grid-cols-2 gap-4 max-w-md mt-6 pt-6 border-t border-slate-100">
            <div>
              <p className="text-xs text-slate-500">Total de Facturas</p>
              <p className="text-lg font-bold text-slate-900">{facturas.length}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Valor Total Comprado</p>
              <p className="text-lg font-bold text-indigo-600">{formatCOP(totalComprado)}</p>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex items-center gap-2">
          <History className="h-5 w-5 text-teal-600" />
          <h3 className="text-base font-semibold text-slate-900">Historial de Compras</h3>
        </div>
        
        {loadingHistorial ? (
          <div className="p-8 flex justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-200 border-t-teal-600" />
          </div>
        ) : facturas.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-sm">
            Este cliente no tiene compras registradas.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {facturas.map((factura) => (
              <div key={factura.id} className="p-5 hover:bg-slate-50/50 transition-colors">
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800 mb-1">
                      Factura #{factura.numero_factura}
                    </span>
                    <p className="text-sm text-slate-500">
                      {format(parseISO(factura.created_at), "dd 'de' MMMM, yyyy - HH:mm")}
                    </p>
                  </div>
                  <div className="text-right font-bold text-slate-900">
                    {formatCOP(factura.total)}
                  </div>
                </div>

                <div className="bg-slate-50 rounded-lg p-4">
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Productos Comprados</h4>
                  <ul className="space-y-2">
                    {factura.items.map((item, idx) => {
                      const nombre = Array.isArray(item.producto) ? item.producto[0]?.nombre : item.producto?.nombre;
                      return (
                        <li key={idx} className="flex justify-between text-sm">
                          <span className="text-slate-700">
                            <span className="font-medium mr-2">{item.cantidad}x</span>
                            {nombre || "Desconocido"}
                          </span>
                          <span className="text-slate-600 font-medium">{formatCOP(item.subtotal)}</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
