"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useReactToPrint } from "react-to-print";
import { createClient } from "@/lib/supabase/client";
import { FACTURA_ESTADOS } from "@/lib/constants";
import type { FacturaConDetalle, Negocio } from "@/lib/types";
import { Ticket } from "@/components/printing/ticket";
import { Printer, CheckCircle, AlertCircle } from "lucide-react";

type PrintCenterProps = {
  negocio?: Negocio | null;
};

type PrintLog = {
  id: string;
  numero: number;
  timestamp: Date;
  status: "ok" | "error";
};

export function PrintCenter({ negocio }: PrintCenterProps) {
  const supabase = useRef(createClient());
  const ticketRef = useRef<HTMLDivElement>(null);
  const queueRef = useRef<string[]>([]);
  const processingRef = useRef(false);
  const currentIdRef = useRef<string | null>(null);
  const currentNumeroRef = useRef<number | null>(null);
  const processNextRef = useRef<() => Promise<void>>(() => Promise.resolve());
  const [currentFactura, setCurrentFactura] = useState<FacturaConDetalle | null>(null);
  const [status, setStatus] = useState("Escuchando facturas pendientes...");
  const [logs, setLogs] = useState<PrintLog[]>([]);

  const addLog = useCallback((numero: number, logStatus: "ok" | "error") => {
    setLogs((prev) => [
      { id: crypto.randomUUID(), numero, timestamp: new Date(), status: logStatus },
      ...prev.slice(0, 19),
    ]);
  }, []);

  const markPrinted = useCallback(async (facturaId: string) => {
    await supabase.current.rpc("marcar_factura_impresa", { p_factura_id: facturaId });
  }, []);

  const getFacturaById = useCallback(async (facturaId: string) => {
    const { data, error } = await supabase.current
      .from("facturas")
      .select(
        "id,numero_factura,cliente_id,vendedor_id,subtotal,descuento_total,total,estado,created_at,cliente:clientes(id,nombre,identificacion,telefono,direccion),vendedor:usuarios(id,nombre),items:items_factura(id,factura_id,producto_id,cantidad,precio_unitario,descuento_item,tipo_descuento_item,subtotal_item,producto:productos(nombre,sku_code))",
      )
      .eq("id", facturaId)
      .single();

    if (error || !data) return null;
    return data as unknown as FacturaConDetalle;
  }, []);

  // useReactToPrint con onAfterPrint para avanzar la cola automáticamente
  const handlePrint = useReactToPrint({
    content: () => ticketRef.current,
    removeAfterPrint: false,
    onAfterPrint: async () => {
      const id = currentIdRef.current;
      if (!id) return;

      const facturaNum = currentNumeroRef.current;
      try {
        await markPrinted(id);
        if (facturaNum) {
          addLog(facturaNum, "ok");
          setStatus(`Factura #${facturaNum} impresa correctamente.`);
        }
      } catch {
        if (facturaNum) addLog(facturaNum, "error");
        setStatus("Error al marcar factura como impresa.");
      }

      currentIdRef.current = null;
      currentNumeroRef.current = null;
      processingRef.current = false;

      // Esperar un momento antes de procesar la siguiente
      await new Promise((resolve) => setTimeout(resolve, 500));
      void processNextRef.current();
    },
  });

  const processNext = useCallback(async () => {
    if (processingRef.current) return;

    processingRef.current = true;
    const nextId = queueRef.current.shift();
    if (!nextId) {
      processingRef.current = false;
      if (!currentIdRef.current) {
        setStatus("Escuchando facturas pendientes...");
        setCurrentFactura(null);
      }
      return;
    }

    currentIdRef.current = nextId;
    currentNumeroRef.current = null;
    const factura = await getFacturaById(nextId);
    if (!factura) {
      processingRef.current = false;
      currentIdRef.current = null;
      return;
    }

    setCurrentFactura(factura);
    currentNumeroRef.current = factura.numero_factura;
    setStatus(`Imprimiendo factura #${factura.numero_factura}...`);

    // Dar tiempo a que React renderice el ticket antes de imprimir
    await new Promise((resolve) => setTimeout(resolve, 400));

    try {
      handlePrint();
    } catch {
      setStatus(`Error al imprimir factura #${factura.numero_factura}.`);
      addLog(factura.numero_factura, "error");
      processingRef.current = false;
      currentIdRef.current = null;
    }
  }, [getFacturaById, handlePrint, addLog]);

  // Mantener ref actualizada para romper la circularidad con onAfterPrint
  useEffect(() => {
    processNextRef.current = processNext;
  }, [processNext]);

  // --- Realtime subscription + Polling fallback ---
  useEffect(() => {
    const client = supabase.current;

    const enqueue = (id: string) => {
      if (!queueRef.current.includes(id) && id !== currentIdRef.current) {
        queueRef.current.push(id);
      }
      void processNextRef.current();
    };

    const loadBacklog = async () => {
      const { data } = await client
        .from("facturas")
        .select("id")
        .eq("estado", FACTURA_ESTADOS.PENDIENTE_IMPRESION)
        .order("created_at", { ascending: true })
        .limit(100);

      (data ?? []).forEach((row) => {
        if (!queueRef.current.includes(row.id) && row.id !== currentIdRef.current) {
          queueRef.current.push(row.id);
        }
      });
      void processNextRef.current();
    };

    void loadBacklog();

    // Realtime: detectar INSERT de facturas pendientes
    const channel = client
      .channel("facturas-pendientes")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "facturas",
          filter: `estado=eq.${FACTURA_ESTADOS.PENDIENTE_IMPRESION}`,
        },
        (payload) => {
          enqueue(payload.new.id as string);
        },
      )
      .subscribe();

    // Polling de respaldo: cada 10s revisa si hay facturas pendientes
    // (por si Realtime falla o se pierde la conexión)
    const pollInterval = setInterval(() => {
      void loadBacklog();
    }, 10_000);

    return () => {
      void client.removeChannel(channel);
      clearInterval(pollInterval);
      processingRef.current = false;
    };
  }, []);

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
          <Printer className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-slate-900">Centro de impresión</h1>
          <p className="text-xs font-medium text-slate-500">Impresión automática · No cierre esta pestaña</p>
        </div>
      </div>

      <div className={`rounded-2xl border p-4 text-sm font-medium ${
        status.includes("Error")
          ? "border-rose-200 bg-rose-50 text-rose-700"
          : status.includes("Imprimiendo")
            ? "border-indigo-200 bg-indigo-50 text-indigo-700"
            : "border-slate-200 bg-white text-slate-700"
      }`}>
        {status}
      </div>

      {logs.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
          <div className="border-b border-slate-100 px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Registro de impresiones</p>
          </div>
          <div className="max-h-48 overflow-y-auto divide-y divide-slate-50">
            {logs.map((log) => (
              <div key={log.id} className="flex items-center gap-3 px-4 py-2.5">
                {log.status === "ok" ? (
                  <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-rose-500 shrink-0" />
                )}
                <span className="text-sm font-medium text-slate-700">
                  Factura #{log.numero}
                </span>
                <span className="ml-auto text-xs text-slate-400">
                  {log.timestamp.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div ref={ticketRef}>
        {currentFactura ? (
          <Ticket factura={currentFactura} negocio={negocio} printMode />
        ) : (
          <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-8 text-center">
            <Printer className="mx-auto h-10 w-10 text-slate-300 mb-3" />
            <p className="text-sm font-medium text-slate-500">Sin facturas en cola</p>
            <p className="text-xs text-slate-400 mt-1">Las facturas aparecerán aquí automáticamente</p>
          </div>
        )}
      </div>
    </section>
  );
}
