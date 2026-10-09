"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useReactToPrint } from "react-to-print";
import { createClient } from "@/lib/supabase/client";
import { FACTURA_ESTADOS } from "@/lib/constants";
import type { FacturaConDetalle, Negocio } from "@/lib/types";
import { Ticket } from "@/components/printing/ticket";
import { PageHeader } from "@/components/page-header";
import { Printer, CheckCircle, AlertCircle } from "lucide-react";

type PrintCenterProps = {
  negocio?: Negocio | null;
};

type PrintLog = {
  id: string;
  numero: number | null;
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
  const watchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const processNextRef = useRef<() => Promise<void>>(() => Promise.resolve());
  const [currentFactura, setCurrentFactura] = useState<FacturaConDetalle | null>(null);
  const [status, setStatus] = useState("Escuchando facturas pendientes...");
  const [logs, setLogs] = useState<PrintLog[]>([]);

  const clearWatchdog = useCallback(() => {
    if (watchdogRef.current) {
      clearTimeout(watchdogRef.current);
      watchdogRef.current = null;
    }
  }, []);

  const addLog = useCallback((numero: number | null, logStatus: "ok" | "error") => {
    setLogs((prev) => [
      { id: crypto.randomUUID(), numero, timestamp: new Date(), status: logStatus },
      ...prev.slice(0, 19),
    ]);
  }, []);

  const markPrinted = useCallback(async (facturaId: string) => {
    // supabase-js no lanza excepciones: hay que revisar `error`.
    const { error } = await supabase.current.rpc("marcar_factura_impresa", {
      p_factura_id: facturaId,
    });
    if (error) throw new Error(error.message);
  }, []);

  const getFacturaById = useCallback(
    async (
      facturaId: string,
    ): Promise<{ factura: FacturaConDetalle | null; error: string | null }> => {
      const { data, error } = await supabase.current
        .from("facturas")
        .select(
          "id,numero_factura,cliente_id,vendedor_id,subtotal,descuento_total,total,estado,created_at,cliente:clientes(id,nombre,identificacion,telefono,direccion),vendedor:usuarios!facturas_vendedor_id_fkey(id,nombre),items:items_factura(id,factura_id,producto_id,cantidad,precio_unitario,descuento_item,tipo_descuento_item,subtotal_item,producto:productos(nombre,sku_code))",
        )
        .eq("id", facturaId)
        .single();

      if (error) return { factura: null, error: error.message };
      if (!data) return { factura: null, error: "Factura no encontrada" };
      return { factura: data as unknown as FacturaConDetalle, error: null };
    },
    [],
  );

  // useReactToPrint con onAfterPrint para avanzar la cola automáticamente
  const handlePrint = useReactToPrint({
    content: () => ticketRef.current,
    removeAfterPrint: false,
    onAfterPrint: async () => {
      const id = currentIdRef.current;
      if (!id) return;

      clearWatchdog();

      const facturaNum = currentNumeroRef.current;
      try {
        await markPrinted(id);
        if (facturaNum) {
          addLog(facturaNum, "ok");
          setStatus(`Factura #${facturaNum} impresa correctamente.`);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (facturaNum) addLog(facturaNum, "error");
        setStatus(`Error al marcar la factura #${facturaNum ?? ""} como impresa: ${msg}`);
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

    const { factura, error } = await getFacturaById(nextId);
    if (!factura) {
      console.error("No se pudo cargar la factura para imprimir:", error);
      addLog(null, "error");
      setStatus(`Error al cargar la factura para imprimir: ${error}`);
      currentIdRef.current = null;
      processingRef.current = false;
      await new Promise((resolve) => setTimeout(resolve, 1000));
      void processNextRef.current();
      return;
    }

    setCurrentFactura(factura);
    currentNumeroRef.current = factura.numero_factura;
    setStatus(`Imprimiendo factura #${factura.numero_factura}...`);

    // Dar tiempo a que React renderice el ticket antes de imprimir
    await new Promise((resolve) => setTimeout(resolve, 400));

    // Si el diálogo de impresión nunca responde, no dejamos la cola bloqueada.
    clearWatchdog();
    const watchId = factura.id;
    watchdogRef.current = setTimeout(() => {
      if (currentIdRef.current === watchId && processingRef.current) {
        console.warn("La impresión no confirmó a tiempo:", watchId);
        addLog(factura.numero_factura, "error");
        setStatus(
          `Error: la factura #${factura.numero_factura} no confirmó la impresión. Reintenta desde la lista.`,
        );
        currentIdRef.current = null;
        currentNumeroRef.current = null;
        processingRef.current = false;
        void processNextRef.current();
      }
    }, 60_000);

    try {
      handlePrint();
    } catch (e) {
      clearWatchdog();
      const msg = e instanceof Error ? e.message : String(e);
      setStatus(`Error al imprimir la factura #${factura.numero_factura}: ${msg}`);
      addLog(factura.numero_factura, "error");
      processingRef.current = false;
      currentIdRef.current = null;
      void processNextRef.current();
    }
  }, [getFacturaById, handlePrint, addLog, clearWatchdog]);

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
      const { data, error } = await client
        .from("facturas")
        .select("id")
        .eq("estado", FACTURA_ESTADOS.PENDIENTE_IMPRESION)
        .order("created_at", { ascending: true })
        .limit(100);

      if (error) {
        console.error("Error consultando la cola de impresión:", error.message);
        if (!processingRef.current) {
          setStatus(`Error consultando la cola de impresión: ${error.message}`);
        }
        return;
      }

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
      if (watchdogRef.current) clearTimeout(watchdogRef.current);
      processingRef.current = false;
    };
  }, []);

  return (
    <section className="space-y-4">
      <PageHeader
        back="/facturas"
        backLabel="Volver a facturas"
        title="Centro de impresión"
        subtitle="Impresión automática · no cierres esta pestaña"
        icon={
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-accent-foreground">
            <Printer className="h-5 w-5" />
          </span>
        }
      />

      <div
        role="status"
        aria-live="polite"
        className={`rounded-2xl border p-4 text-sm font-medium ${
          status.includes("Error")
            ? "border-rose-200 bg-rose-50 text-rose-700"
            : status.includes("Imprimiendo")
              ? "border-primary/30 bg-primary/10 text-primary"
              : "border-border bg-card text-foreground"
        }`}
      >
        {status}
      </div>

      {logs.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
          <div className="border-b border-border px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Registro de impresiones
            </p>
          </div>
          <div className="max-h-48 divide-y divide-border/60 overflow-y-auto">
            {logs.map((log) => (
              <div key={log.id} className="flex items-center gap-3 px-4 py-2.5">
                {log.status === "ok" ? (
                  <CheckCircle className="h-4 w-4 shrink-0 text-emerald-500" />
                ) : (
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-500" />
                )}
                <span className="text-sm font-medium text-foreground tabular-nums">
                  {log.numero ? `Factura #${log.numero}` : "Factura sin cargar"}
                </span>
                <span className="ml-auto text-xs text-muted-foreground tabular-nums">
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
          <div className="rounded-2xl border-2 border-dashed border-border bg-card p-8 text-center">
            <Printer className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
            <p className="text-sm font-medium text-muted-foreground">Sin facturas en cola</p>
            <p className="mt-1 text-xs text-muted-foreground/70">
              Las facturas aparecerán aquí automáticamente
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
